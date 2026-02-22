import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.services.data_service import DataService
from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)


@dataclass
class BuildingScore:
    building_number: int
    utility: str
    score: float
    status: str
    mean_residual: float
    mean_abs_residual: float
    std_residual: float
    positive_ratio: float
    latest_actual: float
    latest_predicted: float
    latest_diff: float


def _status_from_score(score: float) -> str:
    if score < 0.3:
        return "normal"
    elif score < 0.5:
        return "caution"
    elif score < 0.8:
        return "warning"
    return "anomaly"


class ScoringService:
    def __init__(self, data_service: DataService, prediction_service: PredictionService):
        self._data_service = data_service
        self._prediction_service = prediction_service
        # utility -> buildingNumber -> metrics dict
        self._metrics: dict[str, dict[str, dict]] = {}
        self._available_utilities: list[str] = []
        self._compute_all()

    def _compute_all(self):
        for utility in self._prediction_service.get_available_utilities():
            try:
                pred_df = self._prediction_service.predict_all(utility)
                self._compute_metrics(utility, pred_df)
                self._available_utilities.append(utility)
                logger.info("Scores computed for %s: %d buildings", utility, len(self._metrics.get(utility, {})))
            except Exception as e:
                logger.error("Failed to compute scores for %s: %s", utility, e)

    def _compute_metrics(self, utility: str, pred_df: pd.DataFrame):
        self._metrics[utility] = {}

        for bn, group in pred_df.groupby("simscode"):
            residuals = group["residual"]
            latest = group.sort_values("readingtime").iloc[-1]

            self._metrics[utility][int(bn)] = {
                "mean_residual": float(residuals.mean()),
                "mean_abs_residual": float(residuals.abs().mean()),
                "std_residual": float(residuals.std()) if len(residuals) > 1 else 0.0,
                "positive_ratio": float((residuals > 0).mean()),
                "latest_actual": float(latest["energy_per_sqft"]),
                "latest_predicted": float(latest["predicted"]),
                "latest_diff": float(latest["energy_per_sqft"] - latest["predicted"]),
            }

    def get_building_scores(
        self, utility: str, scoring_method: str = "size_normalized"
    ) -> list[BuildingScore]:
        if utility not in self._metrics:
            return []

        metrics = self._metrics[utility]
        if not metrics:
            return []

        # Extract mean_abs_residual for all buildings
        building_numbers = list(metrics.keys())
        values = np.array([metrics[bn]["mean_abs_residual"] for bn in building_numbers])

        if scoring_method == "percentile_rank":
            ranks = np.argsort(np.argsort(values)).astype(float)
            scores = ranks / max(len(ranks) - 1, 1)
        elif scoring_method == "absolute_threshold":
            scores = self._absolute_threshold_scores(values, utility)
        else:  # size_normalized (default)
            v_min, v_max = values.min(), values.max()
            if v_max > v_min:
                scores = (values - v_min) / (v_max - v_min)
            else:
                scores = np.zeros_like(values)

        result = []
        for i, bn in enumerate(building_numbers):
            m = metrics[bn]
            score = float(np.clip(scores[i], 0, 1))
            result.append(
                BuildingScore(
                    building_number=bn,
                    utility=utility,
                    score=round(score, 4),
                    status=_status_from_score(score),
                    mean_residual=round(m["mean_residual"], 6),
                    mean_abs_residual=round(m["mean_abs_residual"], 6),
                    std_residual=round(m["std_residual"], 6),
                    positive_ratio=round(m["positive_ratio"], 4),
                    latest_actual=round(m["latest_actual"], 4),
                    latest_predicted=round(m["latest_predicted"], 4),
                    latest_diff=round(m["latest_diff"], 4),
                )
            )
        return result

    def _absolute_threshold_scores(self, values: np.ndarray, utility: str) -> np.ndarray:
        # Thresholds per utility (default ELECTRICITY thresholds)
        thresholds = {
            "ELECTRICITY": [0.001, 0.003, 0.008],
        }
        t = thresholds.get(utility, [0.001, 0.003, 0.008])
        scores = np.zeros_like(values, dtype=float)

        for i, v in enumerate(values):
            if v < t[0]:
                scores[i] = (v / t[0]) * 0.3
            elif v < t[1]:
                scores[i] = 0.3 + ((v - t[0]) / (t[1] - t[0])) * 0.2
            elif v < t[2]:
                scores[i] = 0.5 + ((v - t[1]) / (t[2] - t[1])) * 0.3
            else:
                scores[i] = 0.8 + min((v - t[2]) / t[2], 1.0) * 0.2

        return scores

    def get_building_detail_scores(self, building_number: int) -> dict:
        bn = building_number
        by_utility = []
        max_score = 0.0

        for utility in self._available_utilities:
            if bn not in self._metrics.get(utility, {}):
                continue
            m = self._metrics[utility][bn]
            # Use size_normalized as default for detail
            all_vals = [
                self._metrics[utility][b]["mean_abs_residual"]
                for b in self._metrics[utility]
            ]
            v_min, v_max = min(all_vals), max(all_vals)
            if v_max > v_min:
                score = (m["mean_abs_residual"] - v_min) / (v_max - v_min)
            else:
                score = 0.0
            score = round(float(np.clip(score, 0, 1)), 4)

            units_map = {
                "ELECTRICITY": "kWh", "GAS": "varies", "HEAT": "varies",
                "STEAM": "kg", "COOLING": "ton-hours", "COOLING_POWER": "tons",
                "STEAMRATE": "varies", "OIL28SEC": "varies",
            }

            by_utility.append({
                "utility": utility,
                "units": units_map.get(utility, "varies"),
                "score": score,
                "status": _status_from_score(score),
                "latestActual": round(m["latest_actual"], 4),
                "latestPredicted": round(m["latest_predicted"], 4),
                "latestDiff": round(m["latest_diff"], 4),
                "meanResidual": round(m["mean_residual"], 6),
                "stdResidual": round(m["std_residual"], 6),
            })
            if score > max_score:
                max_score = score

        return {
            "overallScore": round(max_score, 4),
            "overallStatus": _status_from_score(max_score),
            "byUtility": by_utility,
        }

    def recompute(self, utility: str | None = None):
        if utility:
            try:
                pred_df = self._prediction_service.predict_all(utility)
                self._compute_metrics(utility, pred_df)
            except Exception as e:
                logger.error("Failed to recompute scores for %s: %s", utility, e)
        else:
            self._metrics.clear()
            self._available_utilities.clear()
            self._compute_all()
