"""Weather service - proxy to Open-Meteo API."""
import logging
from datetime import date

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
OSU_LAT = 40.0795
OSU_LON = -83.0732

HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "wind_speed_10m",
    "cloud_cover",
    "apparent_temperature",
    "direct_radiation",
    "shortwave_radiation",
    "diffuse_radiation",
    "direct_normal_irradiance",
]


class WeatherService:
    async def fetch_weather(self, start: str, end: str) -> list[dict]:
        """Fetch weather data from Open-Meteo archive API."""
        params = {
            "latitude": OSU_LAT,
            "longitude": OSU_LON,
            "start_date": start,
            "end_date": end,
            "hourly": ",".join(HOURLY_VARIABLES),
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "timezone": "America/New_York",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        rows = []
        for i, t in enumerate(times):
            row = {"date": t}
            for var in HOURLY_VARIABLES:
                row[var] = hourly.get(var, [None] * len(times))[i]
            rows.append(row)

        return rows
