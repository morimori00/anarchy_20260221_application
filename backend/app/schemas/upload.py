from pydantic import BaseModel


class UploadResponse(BaseModel):
    status: str = "success"
    rowsIngested: int = 0
    rowsSkipped: int = 0
    warnings: list[str] = []
    message: str = ""


class MeterRowInput(BaseModel):
    meterId: str = ""
    siteName: str = ""
    simsCode: str = ""
    utility: str = "ELECTRICITY"
    readingTime: str = ""
    readingValue: float = 0
    readingUnits: str = "kWh"


class BuildingRowInput(BaseModel):
    buildingNumber: str
    buildingName: str = ""
    squareFeet: float = 0
    yearBuilt: int = 0
    primaryUse: str = ""


class ManualUploadRequest(BaseModel):
    rows: list[dict]
