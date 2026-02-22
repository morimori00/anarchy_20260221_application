# Upload Service — Detailed Design

> File: `backend/app/services/upload_service.py`

## Responsibility

Parse, validate, and ingest uploaded data (CSV files or JSON rows) into the application's data store. Handle three data types: meter data, weather data, and building metadata.

---

## Dependencies

- **Data Service**: Receives validated data for storage.
- **Scoring Service**: Triggered to recompute scores after new data is ingested.

---

## CSV Parsing

### `parse_csv(file: UploadFile, data_type: str) -> ParseResult`

Accepts a file upload and the target data type (`meter`, `weather`, `building`). Returns a `ParseResult` containing a pandas DataFrame of valid rows and a list of validation warnings/errors.

Steps:

1. Read the uploaded file into a pandas DataFrame using `pd.read_csv()`.
2. Normalize column names to lowercase and strip whitespace.
3. Check for required columns based on data type (see Required Columns below).
4. Validate data types per column.
5. Return the result.

### Required Columns

**Meter Data**:
- Required: `meterid` (int), `sitename` (str), `simscode` (str/int), `utility` (str), `readingtime` (datetime), `readingvalue` (float), `readingunits` (str)
- Optional: all window statistics columns (readingwindowstart, readingwindowend, etc.)

**Weather Data**:
- Required: `date` (datetime), `temperature_2m` (float), `relative_humidity_2m` (float)
- Optional: all other weather columns (dew_point_2m, precipitation, wind_speed_10m, cloud_cover, apparent_temperature, shortwave_radiation, direct_radiation, diffuse_radiation, direct_normal_irradiance)

**Building Data**:
- Required: `buildingnumber` (str/int), `buildingname` (str), `grossarea` (float)
- Optional: all other metadata columns (campusname, address, city, state, postalcode, floorsaboveground, floorsbelowground, constructiondate, latitude, longitude)

---

## Row-Level Validation

### `validate_rows(df: pd.DataFrame, data_type: str) -> ValidationResult`

Performs per-row validation on the parsed DataFrame. Returns a `ValidationResult` with counts of valid, warned, and invalid rows, plus a list of per-row warnings.

**Validation Rules**:

**All data types**:
- Required columns must not be null/NaN.
- Numeric columns must contain valid numeric values (non-negative where applicable).

**Meter data**:
- `utility` must be one of the 8 valid utility types.
- `readingvalue` must be >= 0.
- `readingtime` must be a valid ISO 8601 datetime.
- Duplicate detection: warn if a row has the same `meterid` + `readingtime` as an existing row in the data store.

**Weather data**:
- `date` must be a valid ISO 8601 datetime.
- `temperature_2m` must be within a reasonable range (-50 to 150 F).
- `relative_humidity_2m` must be between 0 and 100.

**Building data**:
- `grossarea` must be > 0.
- `buildingnumber` must not duplicate an existing building (warn, do not reject).
- `latitude` must be between -90 and 90, `longitude` between -180 and 180 (if provided).

---

## JSON Row Ingestion

### `validate_json_rows(rows: list[dict], data_type: str) -> ValidationResult`

Validates a list of dicts (from manual entry or API response). Converts to DataFrame and runs the same validation as CSV.

---

## Ingestion

### `ingest(df: pd.DataFrame, data_type: str) -> IngestResult`

After validation, passes the valid rows to the Data Service for storage.

Steps:

1. Filter to only valid rows (drop rows with errors).
2. Call the appropriate Data Service append method (`append_meter_data`, `append_weather_data`, or `append_building_data`).
3. If meter data or weather data was added, trigger Scoring Service recomputation for affected utilities.
4. Return `IngestResult` with counts: rows ingested, rows skipped, warnings list.

---

## Result Types

```python
@dataclass
class ParseResult:
    df: pd.DataFrame
    columns_found: list[str]
    columns_missing: list[str]
    total_rows: int

@dataclass
class ValidationWarning:
    row: int
    column: str
    message: str

@dataclass
class ValidationResult:
    valid_count: int
    warning_count: int
    error_count: int
    warnings: list[ValidationWarning]

@dataclass
class IngestResult:
    rows_ingested: int
    rows_skipped: int
    warnings: list[ValidationWarning]
```

---

## Error Handling

- **Unreadable CSV**: If `pd.read_csv()` fails (encoding issues, malformed data), return a 422 error with "Unable to parse CSV file" detail.
- **Missing required columns**: Return a 422 error listing the missing column names.
- **All rows invalid**: Return a 422 error with "No valid rows to ingest" detail.
- **File too large**: If the file exceeds 250MB, return a 413 error. This is enforced at the router level via FastAPI's upload size limit.
