from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from app.dependencies import get_scoring_service
from app.services.scoring_service import ScoringService

router = APIRouter(tags=["settings"])


class ThresholdsPayload(BaseModel):
    caution: float
    warning: float
    anomaly: float

    @field_validator("caution", "warning", "anomaly")
    @classmethod
    def must_be_between_0_and_1(cls, v: float) -> float:
        if not (0 < v < 1):
            raise ValueError("Threshold must be between 0 and 1 (exclusive)")
        return v

    def model_post_init(self, __context):
        if not (self.caution < self.warning < self.anomaly):
            raise ValueError("Thresholds must satisfy: caution < warning < anomaly")


@router.get("/settings/thresholds")
async def get_thresholds(
    scoring_service: ScoringService = Depends(get_scoring_service),
):
    return scoring_service.get_thresholds()


@router.put("/settings/thresholds")
async def update_thresholds(
    payload: ThresholdsPayload,
    scoring_service: ScoringService = Depends(get_scoring_service),
):
    scoring_service.update_thresholds(payload.model_dump())
    return scoring_service.get_thresholds()
