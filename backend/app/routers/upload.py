from fastapi import APIRouter, Depends, Request, HTTPException

from app.dependencies import get_upload_service
from app.services.upload_service import UploadService
from app.schemas.upload import UploadResponse

router = APIRouter(tags=["upload"])


async def _parse_request(request: Request) -> tuple[bytes | None, list[dict] | None]:
    """Determine if request is file upload (multipart) or JSON body."""
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if file is None:
            return None, None
        content = await file.read()
        return content, None
    else:
        body = await request.json()
        rows = body.get("rows", [])
        return None, rows if rows else None


@router.post("/upload/meter", response_model=UploadResponse)
async def upload_meter(
    request: Request,
    upload_service: UploadService = Depends(get_upload_service),
):
    csv_bytes, json_rows = await _parse_request(request)

    if csv_bytes is not None:
        result = upload_service.ingest_meter_csv(csv_bytes)
    elif json_rows is not None:
        result = upload_service.ingest_meter_json(json_rows)
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file or JSON rows")

    return UploadResponse(
        status="success",
        rowsIngested=result.rows_ingested,
        rowsSkipped=result.rows_skipped,
        warnings=result.warnings,
        message=f"Ingested {result.rows_ingested} meter rows",
    )


@router.post("/upload/weather", response_model=UploadResponse)
async def upload_weather(
    request: Request,
    upload_service: UploadService = Depends(get_upload_service),
):
    csv_bytes, json_rows = await _parse_request(request)

    if csv_bytes is not None:
        result = upload_service.ingest_weather_csv(csv_bytes)
    elif json_rows is not None:
        result = upload_service.ingest_weather_json(json_rows)
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file or JSON rows")

    return UploadResponse(
        status="success",
        rowsIngested=result.rows_ingested,
        rowsSkipped=result.rows_skipped,
        warnings=result.warnings,
        message=f"Ingested {result.rows_ingested} weather rows",
    )


@router.post("/upload/building", response_model=UploadResponse)
async def upload_building(
    request: Request,
    upload_service: UploadService = Depends(get_upload_service),
):
    csv_bytes, json_rows = await _parse_request(request)

    if csv_bytes is not None:
        result = upload_service.ingest_building_csv(csv_bytes)
    elif json_rows is not None:
        result = upload_service.ingest_building_json(json_rows)
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file or JSON rows")

    return UploadResponse(
        status="success",
        rowsIngested=result.rows_ingested,
        rowsSkipped=result.rows_skipped,
        warnings=result.warnings,
        message=f"Ingested {result.rows_ingested} building rows",
    )
