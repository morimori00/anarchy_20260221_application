import logging
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from app.services.data_service import DataService
from app.utils.feature_engineering import FEATURE_COLUMNS, build_features

logger = logging.getLogger(__name__)


def _get_model_feature_names(model: XGBRegressor) -> list[str] | None:
    """Extract feature names stored in the XGBoost model."""
    try:
        names = model.get_booster().feature_names
        if names:
            return names
    except Exception:
        pass
    return None

class ModelNotAvailableError(Exception):
    pass


class BuildingDataNotFoundError(Exception):
    pass


class InsufficientDataError(Exception):
    pass


class PredictionService:
    def __init__(self, data_service: DataService, model_dir: Path):
        self._data_service = data_service
        self._models: dict[str, XGBRegressor] = {}
        self._load_models(model_dir)

    def _load_models(self, model_dir: Path):
        model_map = {
            "model_best.json": "ELECTRICITY",
            "model_gas.json": "GAS",
            "model_steam.json": "STEAM",
            "model_heat.json": "HEAT",
            "model_cooling.json": "COOLING",
            "model_steamrate.json": "STEAMRATE",
        }
        for filename, utility in model_map.items():
            path = model_dir / filename
            if path.exists():
                model = XGBRegressor()
                model.load_model(str(path))
                self._models[utility] = model
                logger.info("Loaded model for %s from %s", utility, path)

        logger.info("Models available for: %s", list(self._models.keys()))

    def _predict(self, model: XGBRegressor, X: np.ndarray) -> np.ndarray:
        return model.predict(X)

    def predict_all(self, utility: str) -> pd.DataFrame:
        if utility not in self._models:
            raise ModelNotAvailableError(f"No model for {utility}")

        meter_df = self._data_service.get_all_meter_data_for_utility(utility)
        if meter_df.empty:
            raise BuildingDataNotFoundError(f"No meter data for {utility}")

        weather_df = self._data_service.get_weather()
        buildings_df = self._data_service._buildings

        df = build_features(meter_df, buildings_df, weather_df)
        if df.empty:
            raise InsufficientDataError("All rows dropped after feature engineering")

        model = self._models[utility]
        feature_cols = _get_model_feature_names(model) or FEATURE_COLUMNS

        # Fill any remaining NaN in feature columns
        for col in feature_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0)

        X = df[feature_cols].values
        df["predicted"] = self._predict(model, X)
        df["residual"] = df["energy_per_sqft"] - df["predicted"]

        return df

    def predict_building(
        self,
        building_number: int,
        utility: str,
        weather_overrides: dict | None = None,
    ) -> pd.DataFrame:
        if utility not in self._models:
            raise ModelNotAvailableError(f"No model for {utility}")

        meter_df = self._data_service.get_meter_data(building_number, utility)
        if meter_df.empty:
            raise BuildingDataNotFoundError(
                f"No data for building {building_number}, utility {utility}"
            )

        weather_df = self._data_service.get_weather()
        buildings_df = self._data_service._buildings

        df = build_features(meter_df, buildings_df, weather_df, weather_overrides)
        if df.empty:
            raise InsufficientDataError(
                f"Insufficient data for building {building_number}"
            )

        model = self._models[utility]
        feature_cols = _get_model_feature_names(model) or FEATURE_COLUMNS

        for col in feature_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0)

        X = df[feature_cols].values
        df["predicted"] = self._predict(model, X)
        df["residual"] = df["energy_per_sqft"] - df["predicted"]

        return df

    def get_available_utilities(self) -> list[str]:
        return list(self._models.keys())
