# Scoring Service — Detailed Design

> File: `backend/app/services/scoring_service.py`

## Responsibility

Compute anomaly scores for each building per utility type by comparing actual energy consumption against model predictions. Provide status classification and portfolio-level ranking.

---

## Dependencies

- **Data Service**: Provides meter data and building metadata.
- **Prediction Service**: Provides model predictions (predicted values) and computes residuals (actual - predicted).

---

## Lifecycle

The Scoring Service is initialized during startup after the Data Service and Prediction Service have loaded. It runs a full scoring computation for all buildings and utility types that have a trained model available, then caches the results. Scores are recomputed when new data is uploaded.

### Startup Sequence

1. For each utility type that has a trained model (currently only ELECTRICITY; additional models will be loaded as they become available in the `model/` directory):
   a. Call Prediction Service to get predictions for all buildings with that utility. The Prediction Service returns both `predicted` values (from the model) and `residual` values (computed by the Prediction Service as `actual - predicted`).
   b. Compute per-building anomaly metrics from the residuals.
   c. Normalize scores to 0-1 range.
2. For utility types without a trained model, mark scores as unavailable (these buildings will show "N/A" on the UI rather than a computed score).
3. Cache the full scoring result in memory.

---

## Scoring Algorithm

The service supports three scoring methods, selectable at query time via the `scoring` parameter. All methods share a common per-building metrics computation step, then diverge in how they produce the final 0-1 score.

### Common: Per-Building Metrics

For a given building and utility type:

1. Collect all residuals from the Prediction Service output. The `residual` column is already computed by the Prediction Service as `actual_energy_per_sqft - predicted_energy_per_sqft` (the model itself only outputs `predicted`).
2. Compute the **mean absolute residual** across all time intervals.
3. Compute the **residual standard deviation** to capture variability.
4. Compute the **positive residual ratio**: fraction of time intervals where actual > predicted (over-consuming fraction).

These metrics are cached once and reused by all three scoring methods.

### Method A: `percentile_rank` (Z-Score based)

Rank all buildings by mean absolute residual and convert to a percentile: `score = rank / total_buildings`. Score 0 = lowest anomaly, 1 = highest. This is a purely relative ranking.

### Method B: `absolute_threshold`

Apply utility-specific residual thresholds. Default thresholds for ELECTRICITY:

- mean_abs_residual < 0.001 kWh/sqft → score mapped to 0.0-0.3 (normal)
- 0.001 to 0.003 → score mapped to 0.3-0.5 (caution)
- 0.003 to 0.008 → score mapped to 0.5-0.8 (warning)
- >= 0.008 → score mapped to 0.8-1.0 (anomaly)

Thresholds are defined per utility type. Within each band, the score is linearly interpolated.

### Method C: `size_normalized` (default)

Compute mean absolute residual per sqft (already inherent since the model operates on `energy_per_sqft`), then apply min-max normalization across all buildings: `score = (value - min) / (max - min)`, clamped to [0, 1]. This produces a relative ranking that is fair across buildings of different sizes.

### Status Classification

| Score Range | Status |
|---|---|
| < 0.3 | `normal` |
| 0.3 to < 0.5 | `caution` |
| 0.5 to < 0.8 | `warning` |
| >= 0.8 | `anomaly` |

### Overall Building Score

The overall anomaly score for a building is the **maximum** of its per-utility scores (across all utility types with available models). This ensures that a building with a severe anomaly in even one utility type is flagged. The overall status is derived from this maximum score.

---

## Model Availability

The system discovers available models by scanning the `model/` directory at startup. The current model file `model_best.json` covers ELECTRICITY only. Future models are expected to follow the same XGBoost JSON format and naming convention:

- `model/model_best.json` — ELECTRICITY (current)
- `model/model_gas.json` — GAS (future)
- `model/model_steam.json` — STEAM (future)
- etc.

Alternatively, a single model file may be trained per utility with a `--utility` flag and named accordingly. The prediction service maps each model to its utility type.

For utility types without a model, the scoring service returns `null` scores. The frontend handles this by showing "No model available" instead of a score.

---

## Cached State

| Attribute | Type | Description |
|---|---|---|
| `_scores` | `dict[str, dict[str, BuildingScore]]` | Nested dict: `utility -> buildingNumber -> score data` |
| `_overall_scores` | `dict[str, BuildingOverallScore]` | Per-building overall score (max across utilities) |
| `_available_utilities` | `list[str]` | Utility types that have trained models |

### BuildingScore Structure

```python
@dataclass
class BuildingScore:
    building_number: str
    utility: str
    score: float              # 0-1 normalized
    status: str               # normal/caution/warning/anomaly
    mean_residual: float      # mean(actual - predicted), signed
    mean_abs_residual: float  # mean(|actual - predicted|)
    std_residual: float
    positive_ratio: float     # fraction of intervals where actual > predicted
    latest_actual: float      # most recent interval's actual value
    latest_predicted: float   # most recent interval's predicted value
    latest_diff: float        # latest_actual - latest_predicted
```

---

## Public Methods

### `get_building_scores(utility: str, scoring_method: str = "size_normalized") -> list[BuildingScore]`

Returns anomaly scores for all buildings for a single utility type, computed using the specified scoring method (`percentile_rank`, `absolute_threshold`, or `size_normalized`). If the utility has no trained model, returns an empty list. Used by the buildings endpoint for the map overview.

### `get_building_detail_scores(building_number: str) -> BuildingDetailScores`

Returns the anomaly overview for a single building: overall score, overall status, and a list of per-utility scores (only for utilities that the building has AND that have trained models). Used by the building detail endpoint.

### `get_overall_scores() -> list[BuildingOverallScore]`

Returns all buildings ranked by overall anomaly score (descending). Used for portfolio-level ranking.

### `recompute(utility: str | None = None)`

Recomputes scores for the specified utility (or all utilities if None). Called after new data is uploaded. Clears and repopulates the relevant entries in `_scores`.

---

## Error Handling

- If the Prediction Service fails for a specific building (e.g., insufficient data for feature engineering), that building is excluded from scoring for that utility. A warning is logged.
- If no buildings have data for a utility type, the utility is excluded from `_available_utilities`.
