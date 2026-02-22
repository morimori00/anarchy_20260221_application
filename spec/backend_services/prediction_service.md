# Prediction Service — Detailed Design

> File: `backend/app/services/prediction_service.py`

## Responsibility

Load the XGBoost energy consumption model(s), run the feature engineering pipeline, and produce predictions. The model outputs only `predicted` values; residual computation (`actual - predicted`) is performed by this service after receiving model output. Supports both batch predictions (all buildings for scoring) and single-building predictions (for the chat tool and what-if analysis).

---

## Dependencies

- **Data Service**: Provides meter data, building metadata, and weather data.
- **XGBoost**: `xgboost` Python package for model loading and inference.

---

## Model Management

### Model Discovery

At startup, the service scans the `model/` directory for model files. The current convention:

| File | Utility | Status |
|---|---|---|
| `model/model_best.json` | ELECTRICITY | Available |
| `model/model_gas.json` | GAS | Future |
| `model/model_steam.json` | STEAM | Future |
| `model/model_heat.json` | HEAT | Future |
| `model/model_cooling.json` | COOLING | Future |

Each model is loaded as an `xgboost.XGBRegressor` using `model.load_model(path)`. Models are held in memory as a dict: `utility_type -> XGBRegressor`.

If only `model_best.json` exists, it is mapped to ELECTRICITY (the default utility per `model-reference.md`). Future model files will be auto-discovered by naming convention.

### Model Format

All models are XGBoost native JSON format. They expect the same 25-feature input described in `model-reference.md`:

- 8 weather features
- 3 building features
- 4 temporal features
- 4 lag features
- 4 rolling statistics
- 2 interaction features

The target variable is `energy_per_sqft`.

---

## Feature Engineering Pipeline

The pipeline transforms raw data into the 25-feature matrix expected by the model. It must exactly replicate the training-time feature engineering to avoid prediction drift.

### Steps

1. **Join meter data with building metadata**: Merge on `simscode` = `buildingnumber`. Add `grossarea`, `floorsaboveground`, and compute `building_age` = current_year - construction_year.

2. **Compute energy_per_sqft**: `energy_per_sqft = readingvalue / grossarea`. This is the target variable.

3. **Join with weather data**: Align meter data's `readingtime` (15-min intervals) to weather data's `date` (hourly) by truncating `readingtime` to the hour and joining.

4. **Add temporal features**:
   - `hour_of_day`: hour extracted from `readingtime` (0-23)
   - `minute_of_hour`: minute extracted from `readingtime` (0, 15, 30, 45)
   - `day_of_week`: day of week (0=Monday, 6=Sunday)
   - `is_weekend`: 1 if Saturday or Sunday, 0 otherwise

5. **Compute lag features** (grouped by `simscode`, sorted by `readingtime`):
   - `energy_lag_4`: `energy_per_sqft` shifted by 4 intervals (1 hour)
   - `energy_lag_24`: shifted by 24 intervals (6 hours)
   - `energy_lag_96`: shifted by 96 intervals (24 hours)
   - `energy_lag_672`: shifted by 672 intervals (1 week)

6. **Compute rolling statistics** (grouped by `simscode`, sorted by `readingtime`):
   - `rolling_mean_96`: rolling mean of `energy_per_sqft` over 96 intervals (24 hours)
   - `rolling_std_96`: rolling std over 96 intervals
   - `rolling_mean_672`: rolling mean over 672 intervals (1 week)
   - `rolling_std_672`: rolling std over 672 intervals

7. **Compute interaction features**:
   - `temp_x_area`: `temperature_2m * grossarea`
   - `humidity_x_area`: `relative_humidity_2m * grossarea`

8. **Drop NaN rows**: Rows at the start of each building's time series will have NaN lag/rolling features. These are dropped.

### Feature Column Order

The model expects features in this exact order:

```python
FEATURE_COLUMNS = [
    'temperature_2m', 'relative_humidity_2m', 'dew_point_2m',
    'direct_radiation', 'wind_speed_10m', 'cloud_cover',
    'apparent_temperature', 'precipitation',
    'grossarea', 'floorsaboveground', 'building_age',
    'hour_of_day', 'minute_of_hour', 'day_of_week', 'is_weekend',
    'energy_lag_4', 'energy_lag_24', 'energy_lag_96', 'energy_lag_672',
    'rolling_mean_96', 'rolling_std_96', 'rolling_mean_672', 'rolling_std_672',
    'temp_x_area', 'humidity_x_area',
]
```

---

## Public Methods

### `predict_all(utility: str) -> pd.DataFrame`

Runs batch prediction for all buildings that have data for the specified utility. Returns a DataFrame with all original columns plus `predicted` (model output) and `residual` (computed by this service as `energy_per_sqft - predicted`). Used by the Scoring Service at startup.

Steps:
1. Get all meter data for the utility from the Data Service.
2. Run the feature engineering pipeline.
3. Call `model.predict()` on the feature matrix. The model returns only predicted values.
4. Add `predicted` column from the model output.
5. Compute `residual = energy_per_sqft - predicted` in this service (positive = over-consuming).
6. Return the augmented DataFrame.

If no model is available for the utility, raises `ModelNotAvailableError`.

### `predict_building(building_number: str, utility: str, weather_overrides: dict | None = None) -> pd.DataFrame`

Runs prediction for a single building. Optionally replaces weather feature values with provided overrides (for what-if analysis). Returns the same augmented DataFrame but filtered to the single building.

Steps:
1. Get meter data for the building and utility from the Data Service.
2. If `weather_overrides` is provided, replace the relevant columns in the weather data before joining.
3. Run the feature engineering pipeline.
4. Call `model.predict()`. The model returns only predicted values.
5. Add `predicted` column and compute `residual = energy_per_sqft - predicted` in this service.
6. Return the augmented DataFrame.

### `get_available_utilities() -> list[str]`

Returns the list of utility types for which a trained model is loaded.

---

## Weather Overrides

The `weather_overrides` parameter accepts a dict of weather column names to override values. For example:

```python
weather_overrides = {
    "temperature_2m": 90.0,
    "relative_humidity_2m": 80.0
}
```

When provided, the prediction service creates a modified copy of the weather DataFrame where the specified columns are replaced with the override values for all time steps. This enables hypothetical scenario analysis: "What if the temperature was 90F every day?"

Only weather feature columns are overridable. Invalid column names are ignored with a warning.

---

## Error Handling

- **Missing building data**: If the building has no meter data for the requested utility, raise `BuildingDataNotFoundError`.
- **Insufficient data for lag features**: If a building has fewer than 672 intervals (1 week), lag features will produce NaN for early rows. These rows are dropped. If all rows are dropped, raise `InsufficientDataError`.
- **Model not available**: If no model is loaded for the requested utility, raise `ModelNotAvailableError`.

---

## Performance

- Batch prediction for all ELECTRICITY buildings (~287 buildings, ~750K rows after filtering and dropping NaNs) takes approximately 5-10 seconds on a modern CPU. This runs once at startup.
- Single-building prediction takes < 1 second.
- The feature engineering pipeline is the bottleneck (lag/rolling computations). The groupby-sort pattern in pandas is optimized by operating on pre-sorted DataFrames.
