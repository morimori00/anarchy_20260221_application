import json
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import numpy as np
import pytest
import pytest_asyncio
import httpx
from httpx import ASGITransport


def _make_sample_meter_data() -> pd.DataFrame:
    """Create small synthetic meter data: 2 buildings, 2 utilities, 96 intervals each."""
    rows = []
    base_time = pd.Timestamp("2025-09-01")
    for bldg in [311, 376]:
        for utility in ["ELECTRICITY", "STEAM"]:
            for i in range(96):
                ts = base_time + pd.Timedelta(minutes=15 * i)
                val = 50.0 + (bldg % 100) * 0.1 + np.sin(i / 10) * 5
                rows.append({
                    "simscode": bldg,
                    "readingtime": ts,
                    "readingvalue": val,
                    "utilitytype": utility,
                })
    return pd.DataFrame(rows)


def _make_sample_building_metadata() -> pd.DataFrame:
    return pd.DataFrame([
        {"buildingnumber": 311, "buildingname": "Test Building A",
         "latitude": 40.0, "longitude": -83.0,
         "grossarea": 10000.0, "floorsaboveground": 3,
         "constructiondate": "1990"},
        {"buildingnumber": 376, "buildingname": "Test Building B",
         "latitude": 40.01, "longitude": -83.01,
         "grossarea": 20000.0, "floorsaboveground": 5,
         "constructiondate": "2000"},
    ])


def _make_sample_weather_data() -> pd.DataFrame:
    rows = []
    base_time = pd.Timestamp("2025-09-01")
    for i in range(48):
        ts = base_time + pd.Timedelta(hours=i)
        rows.append({
            "date": ts,
            "temperature_2m": 70.0 + np.sin(i / 6) * 10,
            "relative_humidity_2m": 60.0,
            "dew_point_2m": 55.0,
            "direct_radiation": 200.0 if 6 <= (i % 24) <= 18 else 0.0,
            "wind_speed_10m": 5.0,
            "cloud_cover": 50.0,
            "apparent_temperature": 72.0,
            "precipitation": 0.0,
        })
    return pd.DataFrame(rows)


@pytest.fixture
def sample_meter_data():
    return _make_sample_meter_data()


@pytest.fixture
def sample_building_metadata():
    return _make_sample_building_metadata()


@pytest.fixture
def sample_weather_data():
    return _make_sample_weather_data()


@pytest.fixture
def mock_data_service(sample_meter_data, sample_building_metadata, sample_weather_data):
    """Create a mock DataService with sample data."""
    svc = MagicMock()
    svc._buildings = sample_building_metadata

    def get_meter_data(building_number, utility):
        df = sample_meter_data
        return df[(df["simscode"] == building_number) & (df["utilitytype"] == utility)]

    def get_all_meter_data_for_utility(utility):
        return sample_meter_data[sample_meter_data["utilitytype"] == utility]

    def get_weather():
        return sample_weather_data

    svc.get_meter_data = MagicMock(side_effect=get_meter_data)
    svc.get_all_meter_data_for_utility = MagicMock(side_effect=get_all_meter_data_for_utility)
    svc.get_weather = MagicMock(side_effect=get_weather)

    return svc


@pytest.fixture
def mock_prediction_service():
    """Create a mock PredictionService that returns synthetic results."""
    svc = MagicMock()

    def predict_building(building_number, utility, weather_overrides=None):
        if building_number == 999999:
            from app.services.prediction_service import BuildingDataNotFoundError
            raise BuildingDataNotFoundError(f"No data for building {building_number}")

        n = 20
        base_time = pd.Timestamp("2025-09-01")
        data = {
            "readingtime": [base_time + pd.Timedelta(minutes=15 * i) for i in range(n)],
            "energy_per_sqft": [0.005 + i * 0.0001 for i in range(n)],
            "predicted": [0.005 + i * 0.00009 for i in range(n)],
        }
        df = pd.DataFrame(data)
        df["residual"] = df["energy_per_sqft"] - df["predicted"]
        return df

    svc.predict_building = MagicMock(side_effect=predict_building)
    svc.get_available_utilities = MagicMock(return_value=["ELECTRICITY"])
    return svc


@pytest.fixture
def mock_chat_service():
    """Create a mock ChatService that yields a simple SSE stream."""
    svc = MagicMock()

    async def stream_chat(messages):
        yield '0:"Hello "\n'
        yield '0:"world!"\n'
        yield 'd:{"finishReason":"stop"}\n'

    svc.stream_chat = MagicMock(side_effect=stream_chat)
    return svc


@pytest_asyncio.fixture
async def test_client(mock_chat_service, mock_prediction_service):
    """AsyncClient wrapping the FastAPI app with mocked services."""
    with (
        patch("app.dependencies._chat_service", mock_chat_service),
        patch("app.dependencies._prediction_service", mock_prediction_service),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
