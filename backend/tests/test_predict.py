"""Tests for the predict endpoint (POST /api/predict)."""

import json
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
import httpx
from httpx import ASGITransport

from app.services.prediction_service import (
    BuildingDataNotFoundError,
    ModelNotAvailableError,
    InsufficientDataError,
)


@pytest.mark.asyncio
async def test_predict_default(test_client):
    """POST /api/predict with building number and utility returns predictions."""
    response = await test_client.post(
        "/api/predict",
        json={"buildingNumber": 311, "utility": "ELECTRICITY"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["buildingNumber"] == 311
    assert data["utility"] == "ELECTRICITY"
    assert "predictions" in data
    assert "anomalyScore" in data
    assert "metrics" in data
    assert isinstance(data["predictions"], list)
    assert len(data["predictions"]) > 0
    assert "rmse" in data["metrics"]
    assert "mae" in data["metrics"]
    assert "meanResidual" in data["metrics"]


@pytest.mark.asyncio
async def test_predict_response_structure(test_client):
    """Verify the prediction response contains the expected fields."""
    response = await test_client.post(
        "/api/predict",
        json={"buildingNumber": 311, "utility": "ELECTRICITY"},
    )

    data = response.json()
    # Check prediction row structure
    row = data["predictions"][0]
    assert "readingtime" in row
    assert "energy_per_sqft" in row
    assert "predicted" in row
    assert "residual" in row


@pytest.mark.asyncio
async def test_predict_with_weather_override(test_client):
    """POST /api/predict with weather overrides returns modified predictions."""
    response = await test_client.post(
        "/api/predict",
        json={
            "buildingNumber": 311,
            "utility": "ELECTRICITY",
            "weatherOverrides": {
                "temperature_2m": 90.0,
                "relative_humidity_2m": 80.0,
            },
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert "anomalyScore" in data


@pytest.mark.asyncio
async def test_predict_unknown_building(test_client):
    """POST /api/predict with non-existent building returns 404."""
    response = await test_client.post(
        "/api/predict",
        json={"buildingNumber": 999999, "utility": "ELECTRICITY"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_predict_default_utility():
    """POST /api/predict without utility uses ELECTRICITY as default."""
    mock_pred_svc = MagicMock()

    n = 10
    base_time = pd.Timestamp("2025-09-01")
    df = pd.DataFrame({
        "readingtime": [base_time + pd.Timedelta(minutes=15 * i) for i in range(n)],
        "energy_per_sqft": [0.005] * n,
        "predicted": [0.005] * n,
        "residual": [0.0] * n,
    })
    mock_pred_svc.predict_building = MagicMock(return_value=df)

    with (
        patch("app.dependencies._chat_service", MagicMock()),
        patch("app.dependencies._prediction_service", mock_pred_svc),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/predict",
                json={"buildingNumber": 311},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["buildingNumber"] == 311
    assert data["utility"] == "ELECTRICITY"
    mock_pred_svc.predict_building.assert_called_once_with(311, "ELECTRICITY", None)


@pytest.mark.asyncio
async def test_predict_model_not_available():
    """POST /api/predict for unavailable utility returns 404."""
    mock_pred_svc = MagicMock()
    mock_pred_svc.predict_building = MagicMock(
        side_effect=ModelNotAvailableError("No model for GAS")
    )

    with (
        patch("app.dependencies._chat_service", MagicMock()),
        patch("app.dependencies._prediction_service", mock_pred_svc),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/predict",
                json={"buildingNumber": 311, "utility": "GAS"},
            )

    assert response.status_code == 404
    assert "No model for GAS" in response.json()["detail"]


@pytest.mark.asyncio
async def test_predict_insufficient_data():
    """POST /api/predict with insufficient data returns 422."""
    mock_pred_svc = MagicMock()
    mock_pred_svc.predict_building = MagicMock(
        side_effect=InsufficientDataError("Insufficient data for building 311")
    )

    with (
        patch("app.dependencies._chat_service", MagicMock()),
        patch("app.dependencies._prediction_service", mock_pred_svc),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/predict",
                json={"buildingNumber": 311, "utility": "ELECTRICITY"},
            )

    assert response.status_code == 422
    assert "Insufficient data" in response.json()["detail"]
