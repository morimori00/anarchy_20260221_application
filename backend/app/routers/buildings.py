from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_data_service, get_scoring_service
from app.services.data_service import DataService
from app.services.scoring_service import ScoringService

router = APIRouter(tags=["buildings"])


@router.get("/buildings")
async def list_buildings(
    utility: str = Query("ELECTRICITY"),
    scoring: str = Query("multi_signal_weighted"),
    data_service: DataService = Depends(get_data_service),
    scoring_service: ScoringService = Depends(get_scoring_service),
):
    buildings = data_service.get_all_buildings()
    scores = scoring_service.get_building_scores(utility, scoring)
    score_map = {s.building_number: s for s in scores}

    result = []
    for b in buildings:
        bn = b["buildingNumber"]
        sc = score_map.get(bn)
        result.append(
            {
                "buildingNumber": bn,
                "buildingName": b["buildingName"],
                "campusName": b["campusName"],
                "latitude": b["latitude"],
                "longitude": b["longitude"],
                "grossArea": b["grossArea"],
                "anomalyScore": sc.score if sc else None,
                "status": sc.status if sc else "normal",
                "investmentScore": sc.investment_score if sc else None,
                "confidence": sc.confidence if sc else "medium",
                "rank": sc.rank if sc else None,
                "utilities": data_service.get_building_utilities(bn),
            }
        )

    return {
        "buildings": result,
        "meta": {
            "totalBuildings": len(result),
            "selectedUtility": utility,
            "scoringMethod": scoring,
        },
    }


@router.get("/buildings/{building_number}")
async def get_building(
    building_number: int,
    data_service: DataService = Depends(get_data_service),
    scoring_service: ScoringService = Depends(get_scoring_service),
):
    building = data_service.get_building(building_number)
    if building is None:
        raise HTTPException(status_code=404, detail=f"Building {building_number} not found")

    detail_scores = scoring_service.get_building_detail_scores(building_number)

    return {
        "building": building,
        "anomaly": detail_scores,
    }


@router.get("/buildings/{building_number}/timeseries")
async def get_timeseries(
    building_number: int,
    utility: str = Query("ELECTRICITY"),
    start: str | None = Query(None),
    end: str | None = Query(None),
    resolution: str = Query("hourly"),
    data_service: DataService = Depends(get_data_service),
    scoring_service: ScoringService = Depends(get_scoring_service),
):
    from datetime import datetime

    start_dt = datetime.fromisoformat(start) if start else None
    end_dt = datetime.fromisoformat(end) if end else None

    building = data_service.get_building(building_number)
    if building is None:
        raise HTTPException(status_code=404, detail=f"Building {building_number} not found")

    agg = data_service.get_aggregated_meter_data(building_number, utility, resolution, start_dt, end_dt)

    # Get predictions for this building/utility
    from app.dependencies import get_prediction_service

    prediction_service = get_prediction_service()
    try:
        pred_df = prediction_service.predict_building(building_number, utility)
    except Exception:
        pred_df = None

    data_points = []
    if pred_df is not None and not pred_df.empty:
        # Aggregate predictions similarly
        pred_df = pred_df.copy()
        pred_df["timestamp"] = pred_df["readingtime"]

        if resolution == "hourly":
            pred_df["bucket"] = pred_df["timestamp"].dt.floor("h")
        elif resolution == "daily":
            pred_df["bucket"] = pred_df["timestamp"].dt.floor("D")
        else:
            pred_df["bucket"] = pred_df["timestamp"]

        pred_agg = pred_df.groupby("bucket").agg(
            actual=("energy_per_sqft", "sum"),
            predicted=("predicted", "sum"),
        ).reset_index()
        pred_agg["residual"] = pred_agg["actual"] - pred_agg["predicted"]

        # Get grossArea to convert back from per_sqft
        gross_area = building.get("grossArea", 1)

        for _, row in pred_agg.iterrows():
            data_points.append(
                {
                    "timestamp": row["bucket"].isoformat(),
                    "actual": round(row["actual"] * gross_area, 2),
                    "predicted": round(row["predicted"] * gross_area, 2),
                    "residual": round(row["residual"] * gross_area, 2),
                }
            )
    else:
        # Fallback: return actual data only
        for _, row in agg.iterrows():
            data_points.append(
                {
                    "timestamp": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
                    "actual": round(row["readingvalue_sum"], 2) if "readingvalue_sum" in agg.columns else round(row.get("readingvalue", 0), 2),
                    "predicted": None,
                    "residual": None,
                }
            )

    utilities = data_service.get_building_utilities(building_number)
    units_map = {
        "ELECTRICITY": "kWh", "GAS": "varies", "HEAT": "varies",
        "STEAM": "kg", "COOLING": "ton-hours", "COOLING_POWER": "tons",
        "STEAMRATE": "varies", "OIL28SEC": "varies",
    }

    return {
        "buildingNumber": building_number,
        "utility": utility,
        "units": units_map.get(utility, "varies"),
        "resolution": resolution,
        "data": data_points,
    }
