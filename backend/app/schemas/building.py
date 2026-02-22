from pydantic import BaseModel


class BuildingMapItem(BaseModel):
    buildingNumber: int
    buildingName: str
    campusName: str
    latitude: float
    longitude: float
    grossArea: float
    anomalyScore: float | None = None
    status: str = "normal"
    utilities: list[str] = []


class BuildingsResponse(BaseModel):
    buildings: list[BuildingMapItem]
    meta: dict


class BuildingDetail(BaseModel):
    buildingNumber: int
    buildingName: str
    formalName: str = ""
    campusName: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    postalCode: str = ""
    grossArea: float = 0
    floorsAboveGround: int = 0
    floorsBelowGround: int = 0
    constructionDate: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class UtilityScore(BaseModel):
    utility: str
    units: str
    score: float
    status: str
    latestActual: float
    latestPredicted: float
    latestDiff: float
    meanResidual: float
    stdResidual: float


class AnomalyDetail(BaseModel):
    overallScore: float
    overallStatus: str
    byUtility: list[UtilityScore]


class BuildingDetailResponse(BaseModel):
    building: BuildingDetail
    anomaly: AnomalyDetail
