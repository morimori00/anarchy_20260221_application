# Backend Test Plan

> Date: 2026-02-21
> Framework: pytest + httpx (async)
> Coverage target: All API endpoints and core service logic

---

## Test Infrastructure

### Tools

- **pytest** — test runner
- **httpx** — async HTTP client for FastAPI TestClient
- **pytest-asyncio** — async test support
- **pytest-cov** — coverage reporting

### Fixtures (conftest.py)

**`test_client`**: An `httpx.AsyncClient` wrapping the FastAPI app with `ASGITransport`. Used for all endpoint tests.

**`sample_meter_data`**: A small pandas DataFrame (~100 rows) covering 2 buildings, 2 utility types, and 24 hours of 15-minute interval readings. Used for data service and scoring service tests.

**`sample_building_metadata`**: A DataFrame with 5 buildings, including complete metadata (coordinates, gross area, construction date, floors).

**`sample_weather_data`**: A DataFrame with 48 hours of hourly weather observations matching the weather CSV schema.

**`mock_model`**: A pre-trained XGBoost model trained on the sample data. Small enough to fit in test fixtures but structurally identical to the production model (same 25 features).

---

## Unit Tests

### Data Service (`test_data_service.py`)

| Test | Description |
|---|---|
| `test_load_meter_data` | Verify CSV files are loaded and concatenated into a single DataFrame. Check column names, data types, and row counts. |
| `test_load_building_metadata` | Verify building metadata loads with correct types. Check latitude/longitude are float, grossarea is float. |
| `test_load_weather_data` | Verify weather data loads with correct date parsing and all expected columns present. |
| `test_get_buildings_with_meters` | Verify that only buildings appearing in meter data are returned (287 of 1287). |
| `test_get_building_by_number` | Verify single building lookup returns correct metadata. |
| `test_get_building_not_found` | Verify None is returned for a non-existent building number. |
| `test_get_meter_data_by_building` | Verify meter data filtering by building number returns only rows for that building. |
| `test_get_meter_data_by_utility` | Verify meter data filtering by utility type returns only matching rows. |
| `test_get_available_utilities` | Verify the list of utility types available for a given building. |
| `test_append_meter_data` | Verify new rows are appended to the in-memory DataFrame and queryable. |
| `test_append_weather_data` | Verify new weather rows are appended. |
| `test_append_building_data` | Verify new building metadata is appended. |

### Scoring Service (`test_scoring_service.py`)

| Test | Description |
|---|---|
| `test_compute_anomaly_scores` | Given predictions with known residuals, verify anomaly scores are computed as expected. |
| `test_score_normalization` | Verify scores are normalized to 0-1 range. |
| `test_status_classification` | Verify score-to-status mapping: < 0.3 = normal, 0.3-0.5 = caution, 0.5-0.8 = warning, >= 0.8 = anomaly. |
| `test_per_utility_scores` | Verify scores are computed independently for each utility type. |
| `test_overall_score` | Verify overall building score is computed as the maximum of per-utility scores. |
| `test_building_ranking` | Verify buildings are ranked by overall score in descending order. |
| `test_empty_data` | Verify graceful handling when no meter data exists for a building/utility. |

### Prediction Service (`test_prediction_service.py`)

| Test | Description |
|---|---|
| `test_load_model` | Verify XGBoost model loads from JSON file without errors. |
| `test_feature_engineering` | Verify the feature engineering pipeline produces all 25 expected features. |
| `test_predict_single_building` | Run prediction for one building and verify output contains `predicted` column (from model) and `residual` column (computed by the service as actual - predicted). |
| `test_predict_with_weather_overrides` | Verify that weather overrides replace original weather values in the feature DataFrame. |
| `test_predict_unknown_building` | Verify appropriate error when building has no meter data. |
| `test_lag_feature_computation` | Verify lag features (1h, 6h, 24h, 1w) are computed correctly by spot-checking known values. |
| `test_rolling_feature_computation` | Verify rolling mean and std are computed correctly over the expected windows. |
| `test_interaction_features` | Verify temperature*area and humidity*area interaction features. |

### Code Execution Service (`test_code_execution_service.py`)

| Test | Description |
|---|---|
| `test_execute_simple_code` | Execute `print("hello")` and verify stdout contains "hello". |
| `test_execute_with_imports` | Execute code using pandas and numpy imports. Verify no import errors. |
| `test_execute_error_handling` | Execute code with a runtime error (e.g., `1/0`). Verify stderr contains traceback and exit code is non-zero. |
| `test_execution_timeout` | Execute an infinite loop. Verify the execution is terminated after the timeout period and returns a timeout error. |
| `test_matplotlib_output` | Execute code that creates a matplotlib plot and saves to a buffer. Verify the image is captured in the result. |

### Upload Service (`test_upload_service.py`)

| Test | Description |
|---|---|
| `test_validate_meter_csv` | Provide a valid CSV and verify all rows pass validation. |
| `test_validate_meter_csv_missing_columns` | Provide a CSV missing required columns. Verify validation error. |
| `test_validate_meter_csv_bad_types` | Provide a CSV with string values in numeric columns. Verify row-level warnings. |
| `test_validate_weather_csv` | Validate a correct weather CSV. |
| `test_validate_building_csv` | Validate a correct building metadata CSV. |
| `test_ingest_meter_rows` | Verify validated rows are passed to data service for storage. |

### Weather Service (`test_weather_service.py`)

| Test | Description |
|---|---|
| `test_fetch_weather_success` | Mock the Open-Meteo API response. Verify the data is transformed to the application's weather schema. |
| `test_fetch_weather_date_range` | Verify the correct date range is sent to the API. |
| `test_fetch_weather_api_error` | Mock a 500 response from Open-Meteo. Verify an appropriate error is returned. |
| `test_fetch_weather_unit_conversion` | Verify temperature is returned in Fahrenheit (Open-Meteo returns Celsius by default unless configured). |

---

## API Endpoint Tests

### Buildings Endpoints (`test_buildings.py`)

| Test | Description |
|---|---|
| `test_get_buildings_default` | `GET /api/buildings` returns 200 with a list of buildings and default utility (ELECTRICITY). |
| `test_get_buildings_with_utility` | `GET /api/buildings?utility=STEAM` returns scores for STEAM. |
| `test_get_buildings_invalid_utility` | `GET /api/buildings?utility=INVALID` returns 400. |
| `test_get_building_detail` | `GET /api/buildings/311` returns 200 with complete building detail. |
| `test_get_building_detail_not_found` | `GET /api/buildings/999999` returns 404. |
| `test_get_timeseries_default` | `GET /api/buildings/311/timeseries` returns hourly ELECTRICITY data. |
| `test_get_timeseries_with_params` | `GET /api/buildings/311/timeseries?utility=STEAM&resolution=daily&start=2025-09-01&end=2025-09-07` returns correctly filtered data. |
| `test_get_timeseries_resolution_15min` | Verify 15min resolution returns raw interval data (4x more points than hourly). |

### Upload Endpoints (`test_upload.py`)

| Test | Description |
|---|---|
| `test_upload_meter_csv` | `POST /api/upload/meter` with a valid CSV file returns 200 with row counts. |
| `test_upload_meter_json` | `POST /api/upload/meter` with JSON body containing rows returns 200. |
| `test_upload_meter_invalid_csv` | Upload a CSV with wrong columns. Returns 422. |
| `test_upload_weather_csv` | `POST /api/upload/weather` with valid CSV returns 200. |
| `test_upload_building_json` | `POST /api/upload/building` with JSON rows returns 200. |

### Weather Endpoint (`test_weather.py`)

| Test | Description |
|---|---|
| `test_fetch_weather` | `GET /api/weather/fetch?start=2025-11-01&end=2025-11-07` returns 200 with weather data. |
| `test_fetch_weather_missing_params` | `GET /api/weather/fetch` without required params returns 422. |
| `test_fetch_weather_invalid_dates` | `GET /api/weather/fetch?start=2025-11-07&end=2025-11-01` (end before start) returns 400. |

### Chat Endpoint (`test_chat.py`)

| Test | Description |
|---|---|
| `test_chat_stream_response` | `POST /api/chat` returns SSE stream with `text/event-stream` content type and `x-vercel-ai-ui-message-stream: v1` header. |
| `test_chat_message_format` | Verify stream contains `message-start`, at least one `text-delta`, and `finish` events. |
| `test_chat_empty_messages` | `POST /api/chat` with empty messages array. Verify graceful handling. |

### Predict Endpoint (`test_predict.py`)

| Test | Description |
|---|---|
| `test_predict_default` | `POST /api/predict` with building number and utility returns 200 with predictions. |
| `test_predict_with_weather_override` | `POST /api/predict` with weather overrides returns modified predictions. |
| `test_predict_unknown_building` | `POST /api/predict` with non-existent building returns 404. |

---

## Test Data Strategy

Tests use small, synthetic datasets that are deterministic. The sample meter data covers:
- 2 buildings (building 311 and 376)
- 2 utility types (ELECTRICITY, STEAM)
- 24 hours of 15-minute readings (96 rows per building per utility = 384 rows total)
- Known patterns (e.g., building 311 has higher anomaly scores than 376)

This keeps tests fast (< 1 second per test) while covering all code paths.

---

## Running Tests

```bash
# Run all tests
cd backend && python -m pytest tests/ -v

# Run with coverage
cd backend && python -m pytest tests/ --cov=app --cov-report=term-missing

# Run a specific test file
cd backend && python -m pytest tests/test_buildings.py -v

# Run tests matching a pattern
cd backend && python -m pytest tests/ -k "test_predict" -v
```
