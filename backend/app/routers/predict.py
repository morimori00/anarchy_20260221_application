import json

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_prediction_service
from app.services.prediction_service import (
    PredictionService,
    ModelNotAvailableError,
    BuildingDataNotFoundError,
    InsufficientDataError,
)
from app.schemas.predict import PredictRequest, PredictResponse

router = APIRouter(tags=["predict"])


@router.post("/predict", response_model=PredictResponse)
async def predict(
    request: PredictRequest,
    prediction_service: PredictionService = Depends(get_prediction_service),
):
    try:
        df = prediction_service.predict_building(
            request.buildingNumber,
            request.utility,
            request.weatherOverrides,
        )
    except ModelNotAvailableError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BuildingDataNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientDataError as e:
        raise HTTPException(status_code=422, detail=str(e))

    residuals = df["residual"]
    anomaly_score = float(residuals.abs().mean())
    rmse = float((residuals**2).mean() ** 0.5)
    mae = float(residuals.abs().mean())
    mean_residual = float(residuals.mean())

    sample = df.tail(20)[["readingtime", "energy_per_sqft", "predicted", "residual"]].copy()
    sample["readingtime"] = sample["readingtime"].astype(str)
    predictions = sample.to_dict("records")

    return PredictResponse(
        predictions=predictions,
        anomalyScore=round(anomaly_score, 6),
        metrics={
            "rmse": round(rmse, 6),
            "mae": round(mae, 6),
            "meanResidual": round(mean_residual, 6),
        },
    )
