# Data Service — Detailed Design

> File: `backend/app/services/data_service.py`

## Responsibility

Load, cache, query, and manage all application data: meter readings, building metadata, and weather observations. Acts as the single source of truth for all other services.

---

## Lifecycle

The Data Service is initialized once during the FastAPI application's lifespan event. It loads all CSV files from the `data/` directory into pandas DataFrames and holds them in memory for the duration of the process. It is injected into route handlers and other services via FastAPI's dependency injection (`Depends()`).

### Startup Sequence

1. Load `data/building_metadata.csv` into `self._buildings` DataFrame.
2. Load `data/meter-data-sept-2025.csv` and `data/meter-data-oct-2025.csv`, concatenate into `self._meter_data` DataFrame.
3. Load `data/weather-sept-oct-2025.csv` into `self._weather` DataFrame.
4. Parse datetime columns: `readingtime` in meter data, `date` in weather data, `constructiondate` in building metadata.
5. Build index: `self._buildings_with_meters` — set of building numbers that appear in meter data (join on `simscode`).
6. Log summary: total buildings, buildings with meters, total meter readings, utility type counts.

---

## Internal State

| Attribute | Type | Description |
|---|---|---|
| `_buildings` | `pd.DataFrame` | Building metadata (1,287 rows) |
| `_meter_data` | `pd.DataFrame` | All meter readings (~1.5M rows) |
| `_weather` | `pd.DataFrame` | Weather observations (~1,464 rows) |
| `_buildings_with_meters` | `set[str]` | Building numbers appearing in meter data |
| `_data_dir` | `Path` | Path to the data directory |

---

## Public Methods

### `get_all_buildings() -> list[dict]`

Returns metadata for all buildings that have meter data. Joins `_buildings` with `_buildings_with_meters` to filter. Returns a list of dicts with fields: `buildingNumber`, `buildingName`, `campusName`, `latitude`, `longitude`, `grossArea`, `constructionDate`, `floorsAboveGround`, `floorsBelowGround`.

Buildings without latitude/longitude are excluded (38 of 1,287 are missing coordinates; none of these have meter data in the current dataset, but the filter provides safety).

### `get_building(building_number: str) -> dict | None`

Returns a single building's full metadata as a dict, or None if not found.

### `get_building_utilities(building_number: str) -> list[str]`

Returns the list of unique utility types that have meter data for the given building. Queries `_meter_data` filtered by `simscode == building_number` and returns unique values of the `utility` column.

### `get_meter_data(building_number: str, utility: str, start: datetime | None, end: datetime | None) -> pd.DataFrame`

Returns a filtered subset of meter data for the specified building and utility. Optional `start` and `end` parameters filter the `readingtime` column. Returns the DataFrame with all original columns.

### `get_aggregated_meter_data(building_number: str, utility: str, resolution: str, start: datetime | None, end: datetime | None) -> pd.DataFrame`

Returns aggregated meter data. The `resolution` parameter controls the aggregation period:

- `15min`: No aggregation, returns raw rows.
- `hourly`: Groups by floor of `readingtime` to the nearest hour. Sums `readingvalue`. Averages window statistics.
- `daily`: Groups by date. Sums `readingvalue`. Averages window statistics.

Returns a DataFrame with columns: `timestamp`, `readingvalue_sum`, `readingvalue_mean`, `count`.

### `get_weather(start: datetime | None, end: datetime | None) -> pd.DataFrame`

Returns weather data, optionally filtered by date range.

### `get_all_meter_data_for_utility(utility: str) -> pd.DataFrame`

Returns meter data for all buildings for a single utility type. Used by the scoring service to compute portfolio-wide anomaly scores.

### `append_meter_data(df: pd.DataFrame) -> int`

Appends new meter data rows to `_meter_data` in memory. Updates `_buildings_with_meters` if new buildings appear. Data is not persisted to disk — it is lost on restart. Returns the number of rows appended.

### `append_weather_data(df: pd.DataFrame) -> int`

Appends new weather data rows to `_weather` in memory. Returns row count.

### `append_building_data(df: pd.DataFrame) -> int`

Appends new building metadata rows to `_buildings` in memory. Updates `_buildings_with_meters`. Returns row count.

---

## Performance Considerations

- The full meter dataset (~1.5M rows, ~450MB CSV) loads into approximately 800MB of memory as a pandas DataFrame. This is acceptable for a single-server deployment.
- Queries use pandas boolean indexing, which is efficient for column-level filtering.
- For the map overview (all buildings + scores), the scoring service pre-computes and caches scores at startup, so the data service only needs to provide the building list.
- No concurrent write protection is implemented. The application assumes a single user.
- Uploaded data is stored in-memory only and lost on restart. This is acceptable for the hackathon prototype.
