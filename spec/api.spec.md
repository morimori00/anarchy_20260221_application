# API Specification

> Date: 2026-02-21
> Base URL: `http://localhost:8000`
> Format: JSON (except SSE endpoints)

All endpoints are prefixed with `/api`. Errors return `{ "detail": "..." }` with appropriate HTTP status codes.

---

## 1. Buildings

### GET /api/buildings

Returns all buildings that have meter data, with per-utility anomaly scores for the map overview.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `utility` | string | no | `ELECTRICITY` | Filter anomaly scores by utility type |
| `scoring` | string | no | `size_normalized` | Scoring method: `percentile_rank`, `absolute_threshold`, or `size_normalized` |

**Response 200:**

```json
{
  "buildings": [
    {
      "buildingNumber": "311",
      "buildingName": "Mount Hall (0311)",
      "campusName": "Columbus",
      "latitude": 40.00405648,
      "longitude": -83.0367706,
      "grossArea": 75660.0,
      "anomalyScore": 0.72,
      "status": "warning",
      "utilities": ["ELECTRICITY", "STEAM", "COOLING"]
    }
  ],
  "meta": {
    "totalBuildings": 287,
    "selectedUtility": "ELECTRICITY",
    "scoringMethod": "size_normalized",
    "computedAt": "2025-10-31T23:45:00"
  }
}
```

`anomalyScore` is a normalized value between 0 and 1. `status` is derived from score thresholds: `normal` (< 0.3), `caution` (0.3-0.5), `warning` (0.5-0.8), `anomaly` (>= 0.8).

---

### GET /api/buildings/{buildingNumber}

Returns detailed information for a single building, including per-utility breakdowns.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `buildingNumber` | string | Building identifier (SIMS code) |

**Response 200:**

```json
{
  "building": {
    "buildingNumber": "311",
    "buildingName": "Mount Hall (0311)",
    "formalName": "Mount, John T. Hall",
    "campusName": "Columbus",
    "address": "1050 Carmack Rd",
    "city": "Columbus",
    "state": "OH",
    "postalCode": "43210-1002",
    "grossArea": 75660.0,
    "floorsAboveGround": 2,
    "floorsBelowGround": 1,
    "constructionDate": "1974-07-01",
    "latitude": 40.00405648,
    "longitude": -83.0367706
  },
  "anomaly": {
    "overallScore": 0.72,
    "overallStatus": "warning",
    "byUtility": [
      {
        "utility": "ELECTRICITY",
        "units": "kWh",
        "score": 0.89,
        "status": "anomaly",
        "latestActual": 1420.5,
        "latestPredicted": 1180.2,
        "latestDiff": 240.3,
        "meanResidual": 185.7,
        "stdResidual": 42.3
      },
      {
        "utility": "STEAM",
        "units": "kg",
        "score": 0.45,
        "status": "caution",
        "latestActual": 890.1,
        "latestPredicted": 820.0,
        "latestDiff": 70.1,
        "meanResidual": 55.2,
        "stdResidual": 18.9
      }
    ]
  }
}
```

**Response 404:**

```json
{ "detail": "Building 999 not found" }
```

---

### GET /api/buildings/{buildingNumber}/timeseries

Returns time series data for a specific building and utility type. Used by the time series chart on the building detail page.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `buildingNumber` | string | Building identifier |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `utility` | string | no | `ELECTRICITY` | Utility type to retrieve |
| `start` | string (ISO 8601) | no | data start | Start of date range |
| `end` | string (ISO 8601) | no | data end | End of date range |
| `resolution` | string | no | `hourly` | Aggregation: `15min`, `hourly`, `daily` |

**Response 200:**

```json
{
  "buildingNumber": "311",
  "utility": "ELECTRICITY",
  "units": "kWh",
  "resolution": "hourly",
  "data": [
    {
      "timestamp": "2025-09-01T00:00:00",
      "actual": 142.5,
      "predicted": 135.2,
      "residual": 7.3
    }
  ]
}
```

For `15min` resolution, the values are raw interval readings. For `hourly` and `daily`, values are summed over the period. Predicted and residual values are similarly aggregated.

---

## 2. Upload

### POST /api/upload/meter

Upload meter data as CSV or JSON rows.

**Request Body (multipart/form-data for CSV):**

| Field | Type | Description |
|---|---|---|
| `file` | File | CSV file matching meter data schema |

**Request Body (application/json for manual entry):**

```json
{
  "rows": [
    {
      "meterId": 246014,
      "siteName": "East Regional Chilled Water Plant",
      "simsCode": "376",
      "utility": "ELECTRICITY",
      "readingTime": "2025-11-01T05:00:00",
      "readingValue": 151.05,
      "readingUnits": "kWh"
    }
  ]
}
```

**Response 200:**

```json
{
  "status": "success",
  "rowsIngested": 1420,
  "rowsSkipped": 3,
  "warnings": [
    { "row": 45, "message": "Missing readingValue, row skipped" }
  ]
}
```

**Response 422:** Validation errors (wrong columns, invalid types).

---

### POST /api/upload/weather

Upload weather data as CSV or JSON rows.

**Request Body (multipart/form-data for CSV):**

| Field | Type | Description |
|---|---|---|
| `file` | File | CSV file matching weather data schema |

**Request Body (application/json for manual entry):**

```json
{
  "rows": [
    {
      "date": "2025-11-01T00:00:00",
      "temperature_2m": 55.4,
      "relative_humidity_2m": 72.0,
      "dew_point_2m": 46.1,
      "precipitation": 0.0,
      "wind_speed_10m": 8.2,
      "cloud_cover": 45,
      "apparent_temperature": 52.1
    }
  ]
}
```

**Response 200:** Same structure as meter upload response.

---

### POST /api/upload/building

Upload building metadata as CSV or JSON rows.

**Request Body (application/json for manual entry):**

```json
{
  "rows": [
    {
      "buildingNumber": "999",
      "buildingName": "New Science Building",
      "campusName": "Columbus",
      "address": "100 Main St",
      "city": "Columbus",
      "state": "OH",
      "grossArea": 50000.0,
      "floorsAboveGround": 3,
      "floorsbelowground": 1,
      "constructionDate": "2020-01-01",
      "latitude": 40.0,
      "longitude": -83.0
    }
  ]
}
```

**Response 200:** Same structure as meter upload response.

---

## 3. Weather

### GET /api/weather/fetch

Fetches weather data from the Open-Meteo Historical Forecast API for the OSU campus location and returns it in the application's weather data format.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `start` | string (YYYY-MM-DD) | yes | Start date |
| `end` | string (YYYY-MM-DD) | yes | End date |

**Response 200:**

```json
{
  "status": "success",
  "rowsFetched": 168,
  "data": [
    {
      "date": "2025-11-01T00:00:00",
      "latitude": 40.0795,
      "longitude": -83.0732,
      "temperature_2m": 55.4,
      "relative_humidity_2m": 72.0,
      "dew_point_2m": 46.1,
      "precipitation": 0.0,
      "direct_radiation": 0.0,
      "wind_speed_10m": 8.2,
      "wind_direction_10m": 180.0,
      "cloud_cover": 45,
      "apparent_temperature": 52.1,
      "shortwave_radiation": 0,
      "diffuse_radiation": 0.0,
      "direct_normal_irradiance": 0.0
    }
  ]
}
```

The location is fixed to OSU campus coordinates (40.0795, -83.0732). Date range is capped at 90 days per request.

---

## 4. Chat

### POST /api/chat

Streaming chat endpoint. Accepts user messages and returns an SSE stream conforming to the Vercel AI SDK UI Message Stream Protocol (v1).

**Request Body (application/json):**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Which buildings have the highest anomaly scores for electricity?"
    }
  ]
}
```

**Response:** SSE stream with `Content-Type: text/event-stream` and header `x-vercel-ai-ui-message-stream: v1`.

Stream event types:

| Event Type | Description |
|---|---|
| `message-start` | Initialize message with ID |
| `text-start` / `text-delta` / `text-end` | Streamed text content |
| `tool-input-start` / `tool-input-delta` / `tool-input-available` | Tool call arguments |
| `tool-output-available` | Tool execution result |
| `finish` | Message complete |
| `[DONE]` | Stream terminated |

The backend manages two tools that the LLM can invoke:

**Tool: `execute_python`**
Executes arbitrary Python code in a sandboxed environment. Input: `{ "code": string }`. Output: `{ "stdout": string, "stderr": string, "exitCode": number, "images": string[] }`. Images are returned as base64-encoded data URIs.

**Tool: `run_prediction`**
Runs the XGBoost energy prediction model with custom parameters. Input: `{ "buildingNumber": string, "utility": string, "weatherOverrides": object | null }`. Output: `{ "predictions": array, "anomalyScore": number, "metrics": object }`.

---

## 5. Prediction

### POST /api/predict

Directly invokes the ML prediction model outside of the chat context. Used for programmatic "what-if" analysis.

**Request Body:**

```json
{
  "buildingNumber": "311",
  "utility": "ELECTRICITY",
  "startDate": "2025-09-01",
  "endDate": "2025-09-30",
  "weatherOverrides": {
    "temperature_2m": 90.0,
    "relative_humidity_2m": 80.0
  }
}
```

`weatherOverrides` replaces weather feature values for all time steps. When `null`, the actual weather data from the dataset is used.

**Response 200:**

```json
{
  "buildingNumber": "311",
  "utility": "ELECTRICITY",
  "anomalyScore": 0.85,
  "metrics": {
    "rmse": 24.3,
    "mae": 18.7,
    "meanResidual": 22.1
  },
  "timeseries": [
    {
      "timestamp": "2025-09-01T00:00:00",
      "actual": 142.5,
      "predicted": 120.4,
      "residual": 22.1
    }
  ]
}
```

---

## Common Types

### UtilityType (enum)

```
ELECTRICITY | GAS | HEAT | STEAM | COOLING | COOLING_POWER | STEAMRATE | OIL28SEC
```

### AnomalyStatus (enum)

```
normal | caution | warning | anomaly
```

Derived from score: `< 0.3` = normal, `0.3-0.5` = caution, `0.5-0.8` = warning, `>= 0.8` = anomaly.

### Error Response

All error responses follow the format:

```json
{
  "detail": "Human-readable error message"
}
```

| Status Code | Usage |
|---|---|
| 400 | Bad request (invalid parameters) |
| 404 | Resource not found |
| 422 | Validation error (invalid data format) |
| 500 | Internal server error |

---

## CORS

The backend enables CORS for the frontend origin (`http://localhost:3000` in development). All methods and headers are allowed. Credentials are included.

---

## Authentication

No authentication is required. The application runs in an isolated environment and is not exposed to the public internet.
