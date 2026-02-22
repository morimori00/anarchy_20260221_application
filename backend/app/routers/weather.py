from fastapi import APIRouter, Depends, Query, HTTPException

from app.dependencies import get_weather_service
from app.services.weather_service import WeatherService

router = APIRouter(tags=["weather"])


@router.get("/weather/fetch")
async def fetch_weather(
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)"),
    weather_service: WeatherService = Depends(get_weather_service),
):
    try:
        rows = await weather_service.fetch_weather(start, end)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch weather data: {e}")

    return {
        "rows": rows,
        "count": len(rows),
    }
