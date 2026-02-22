import logging
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from app.services.data_service import DataService
from app.utils.feature_engineering import (
    FEATURE_COLUMNS,
    LSTM_GAS_SEQ_LENGTH,
    LSTM_GAS_STATIC_COLS,
    LSTM_GAS_TEMPORAL_COLS,
    build_features,
    build_lstm_gas_features,
)

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
        self._lstm_gas = None  # (model, scaler_stats, device) or None
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
                logger.info("Loaded XGBoost model for %s from %s", utility, path)

        # Load LSTM gas model
        lstm_path = model_dir / "model_gas_lstm.pt"
        if lstm_path.exists():
            try:
                from app.utils.lstm_model import load_lstm_model
                model, scaler_stats, device = load_lstm_model(lstm_path)
                self._lstm_gas = (model, scaler_stats, device)
                # Register GAS as available if not already
                if "GAS" not in self._models:
                    self._models["GAS"] = None  # placeholder
                logger.info("Loaded LSTM gas model from %s", lstm_path)
            except Exception:
                logger.exception("Failed to load LSTM gas model")

        logger.info("Models available for: %s", list(self._models.keys()))

    def _predict(self, model: XGBRegressor, X: np.ndarray) -> np.ndarray:
        return model.predict(X)

    def _predict_gas_lstm(
        self,
        df: pd.DataFrame,
    ) -> pd.DataFrame:
        """Run LSTM inference for GAS utility.

        Creates sliding windows of seq_length timesteps per building,
        normalizes features, runs model, then maps predictions back.
        """
        from app.utils.lstm_model import lstm_predict

        model, scaler_stats, device = self._lstm_gas
        seq_length = LSTM_GAS_SEQ_LENGTH
        temporal_cols = LSTM_GAS_TEMPORAL_COLS
        static_cols = LSTM_GAS_STATIC_COLS

        # Fill NaN in feature columns
        for col in temporal_cols + static_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0.0)

        # Build sliding windows per building
        windows_temporal = []
        windows_static = []
        index_keys = []  # (simscode, readingtime) for mapping back

        for code, grp in df.groupby("simscode"):
            grp = grp.sort_values("readingtime")
            temporal = grp[temporal_cols].values.astype(np.float32)
            static = grp[static_cols].iloc[0].values.astype(np.float32)
            times = grp["readingtime"].values

            n = len(grp)
            for start in range(0, n - seq_length + 1):
                end = start + seq_length
                windows_temporal.append(temporal[start:end])
                windows_static.append(static)
                index_keys.append((code, times[end - 1]))

        if not windows_temporal:
            df["predicted"] = np.nan
            df["residual"] = np.nan
            return df

        X_temporal = np.stack(windows_temporal)  # (N, seq_length, n_temporal)
        X_static = np.stack(windows_static)      # (N, n_static)

        # Normalize using training scaler stats
        t_mean = np.array(scaler_stats["temporal_mean"], dtype=np.float32)
        t_std = np.array(scaler_stats["temporal_std"], dtype=np.float32)
        s_mean = np.array(scaler_stats["static_mean"], dtype=np.float32)
        s_std = np.array(scaler_stats["static_std"], dtype=np.float32)

        X_temporal = (X_temporal - t_mean) / t_std
        X_static = (X_static - s_mean) / s_std

        # Run inference
        preds = lstm_predict(model, X_temporal, X_static, scaler_stats, device)

        # Map predictions back to DataFrame
        pred_df = pd.DataFrame({
            "simscode": [k[0] for k in index_keys],
            "readingtime": [k[1] for k in index_keys],
            "predicted": preds,
        })
        # Keep last prediction for each (simscode, readingtime)
        pred_df = pred_df.drop_duplicates(
            subset=["simscode", "readingtime"], keep="last"
        )

        df = df.merge(pred_df, on=["simscode", "readingtime"], how="left")
        df["residual"] = df["energy_per_sqft"] - df["predicted"]

        return df

    def predict_all(self, utility: str) -> pd.DataFrame:
        if utility not in self._models:
            raise ModelNotAvailableError(f"No model for {utility}")

        meter_df = self._data_service.get_all_meter_data_for_utility(utility)
        if meter_df.empty:
            raise BuildingDataNotFoundError(f"No meter data for {utility}")

        weather_df = self._data_service.get_weather()
        buildings_df = self._data_service._buildings

        # Use LSTM for GAS if available
        if utility == "GAS" and self._lstm_gas is not None:
            elec_meter_df = self._data_service.get_all_meter_data_for_utility(
                "ELECTRICITY"
            )
            df = build_lstm_gas_features(
                meter_df, elec_meter_df, buildings_df, weather_df
            )
            if df.empty:
                raise InsufficientDataError(
                    "All rows dropped after feature engineering"
                )
            return self._predict_gas_lstm(df)

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

        # Use LSTM for GAS if available
        if utility == "GAS" and self._lstm_gas is not None:
            elec_meter_df = self._data_service.get_meter_data(
                building_number, "ELECTRICITY"
            )
            df = build_lstm_gas_features(
                meter_df, elec_meter_df, buildings_df, weather_df, weather_overrides
            )
            if df.empty:
                raise InsufficientDataError(
                    f"Insufficient data for building {building_number}"
                )
            return self._predict_gas_lstm(df)

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
