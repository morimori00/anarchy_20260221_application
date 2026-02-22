from pydantic import BaseModel


class PredictRequest(BaseModel):
    buildingNumber: int
    utility: str = "ELECTRICITY"
    weatherOverrides: dict | None = None


class PredictResponse(BaseModel):
    buildingNumber: int
    utility: str
    predictions: list[dict]
    anomalyScore: float
    metrics: dict
