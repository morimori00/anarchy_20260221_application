from pydantic import BaseModel


class WeatherRow(BaseModel):
    date: str
    temperature_2m: float | None = None
    relative_humidity_2m: float | None = None
    dew_point_2m: float | None = None
    direct_radiation: float | None = None
    wind_speed_10m: float | None = None
    cloud_cover: float | None = None
    apparent_temperature: float | None = None
    precipitation: float | None = None


class WeatherFetchResponse(BaseModel):
    rows: list[dict]
    count: int
