# Weather Service — Detailed Design

> File: `backend/app/services/weather_service.py`

## Responsibility

Fetch weather data from the Open-Meteo Historical Forecast API and transform it into the application's weather data format. Acts as a proxy between the frontend's "Fetch from API" feature and the external weather API.

---

## Dependencies

- **httpx**: Async HTTP client for API calls.

---

## Open-Meteo API Integration

### API Endpoint

```
https://archive-api.open-meteo.com/v1/archive
```

### Request Parameters

| Parameter | Value | Description |
|---|---|---|
| `latitude` | `40.0795` | OSU campus latitude (fixed) |
| `longitude` | `-83.0732` | OSU campus longitude (fixed) |
| `start_date` | User-provided | Format: YYYY-MM-DD |
| `end_date` | User-provided | Format: YYYY-MM-DD |
| `hourly` | (see below) | Comma-separated list of weather variables |
| `temperature_unit` | `fahrenheit` | Ensures temperature is in Fahrenheit |
| `wind_speed_unit` | `mph` | Ensures wind speed is in mph |
| `timezone` | `America/New_York` | OSU timezone |

### Requested Hourly Variables

```
temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,
direct_radiation,wind_speed_10m,wind_speed_100m,wind_direction_10m,
wind_direction_100m,cloud_cover,apparent_temperature,
shortwave_radiation,diffuse_radiation,direct_normal_irradiance
```

These match the columns in the existing `weather-sept-oct-2025.csv` file.

---

## Public Methods

### `fetch_weather(start_date: str, end_date: str) -> pd.DataFrame`

Fetches weather data from Open-Meteo for the specified date range and returns a DataFrame matching the application's weather schema.

Steps:

1. Validate date range: `end_date` must be >= `start_date`. Maximum range is 90 days.
2. Construct the API URL with all parameters.
3. Make an async HTTP GET request using `httpx.AsyncClient`.
4. Parse the JSON response. The `hourly` object contains arrays of values indexed by `time`.
5. Convert to a DataFrame with one row per hour.
6. Add fixed `latitude` (40.0795) and `longitude` (-83.0732) columns.
7. Rename `time` column to `date` and parse as datetime.
8. Rename `wind_speed_100m` to match the existing schema (the CSV uses `wind_speed_100m` while the data dictionary shows `wind_speed_80m` — use the actual CSV column names).
9. Return the DataFrame.

### Response Transformation

The Open-Meteo API response structure:

```json
{
  "hourly": {
    "time": ["2025-11-01T00:00", "2025-11-01T01:00", ...],
    "temperature_2m": [55.4, 54.1, ...],
    "relative_humidity_2m": [72.0, 74.0, ...],
    ...
  }
}
```

This is transformed into a flat DataFrame:

| date | latitude | longitude | temperature_2m | relative_humidity_2m | ... |
|---|---|---|---|---|---|
| 2025-11-01T00:00:00 | 40.0795 | -83.0732 | 55.4 | 72.0 | ... |

---

## Error Handling

- **Invalid date range**: If `end_date < start_date`, raise `ValueError` with a descriptive message. If range exceeds 90 days, raise `ValueError`.
- **API timeout**: Set a 30-second timeout on the HTTP request. On timeout, raise `WeatherAPIError` with "Open-Meteo API request timed out".
- **API error response**: If the API returns a non-200 status code, raise `WeatherAPIError` with the status code and response body.
- **Missing data**: The API may return null values for some variables in some hours. These are preserved as NaN in the DataFrame. The upload service's validation step will flag them as warnings.

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `WEATHER_API_BASE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Base URL for the Open-Meteo API |
| `WEATHER_API_TIMEOUT` | `30` | Request timeout in seconds |

The location coordinates are hardcoded to OSU campus. If multi-campus support is added in the future, coordinates would be parameterized.
