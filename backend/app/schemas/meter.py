from pydantic import BaseModel


class TimeSeriesDataPoint(BaseModel):
    timestamp: str
    actual: float
    predicted: float | None = None
    residual: float | None = None


class TimeSeriesResponse(BaseModel):
    buildingNumber: int
    utility: str
    units: str
    resolution: str
    data: list[TimeSeriesDataPoint]
