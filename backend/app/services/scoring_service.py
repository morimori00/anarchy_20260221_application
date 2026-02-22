import logging
from dataclasses import dataclass, field

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
    investment_score: float = 0.0
    confidence: str = "medium"
    rank: int = 0
    total_buildings: int = 0
    signals: dict = field(default_factory=dict)


DEFAULT_THRESHOLDS = {"caution": 0.6, "warning": 0.8, "anomaly": 0.9}


def _status_from_score(score: float, thresholds: dict | None = None) -> str:
    t = thresholds or DEFAULT_THRESHOLDS
    if score < t["caution"]:
        return "normal"
    elif score < t["warning"]:
        return "caution"
    elif score < t["anomaly"]:
        return "warning"
    return "anomaly"


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _percentile_ranks(values: np.ndarray) -> np.ndarray:
    n = len(values)
    if n <= 1:
        return np.zeros_like(values)
    # argsort-based ranking (average method)
    order = np.argsort(np.argsort(values)).astype(float)
    return order / max(n - 1, 1)


SIGNAL_WEIGHTS = {
    "excess_ratio": 0.30,
    "consistency": 0.20,
    "peak_excess": 0.20,
    "weather_sensitivity": 0.15,
    "volatility": 0.15,
}

SIGNAL_META = {
    "excess_ratio": {
        "label": "Excess Ratio",
        "description": "How much more energy this building uses compared to what was predicted",
    },
    "positive_ratio": {
        "label": "Overconsumption Frequency",
        "description": "How often the building uses more energy than expected (higher = more frequent waste)",
    },
    "consistency": {
        "label": "Consistency",
        "description": "Whether the excess energy use is a daily pattern, not just occasional spikes",
    },
    "weather_sensitivity": {
        "label": "Weather Sensitivity",
        "description": "Whether the building's energy waste gets worse with extreme temperatures",
    },
    "peak_excess": {
        "label": "Peak Excess",
        "description": "How severe the worst energy waste moments are",
    },
    "volatility": {
        "label": "Volatility",
        "description": "How unstable the building's energy consumption pattern is",
    },
    "total_excess_energy": {
        "label": "Total Excess Energy",
        "description": "The absolute amount of energy wasted, considering building size",
    },
}


class ScoringService:
    def __init__(self, data_service: DataService, prediction_service: PredictionService):
        self._data_service = data_service
        self._prediction_service = prediction_service
        self._thresholds: dict = dict(DEFAULT_THRESHOLDS)
        # utility -> buildingNumber -> metrics dict
        self._metrics: dict[str, dict[str, dict]] = {}
        self._available_utilities: list[str] = []
        self._compute_all()

    def get_thresholds(self) -> dict:
        return dict(self._thresholds)

    def update_thresholds(self, thresholds: dict):
        self._thresholds = dict(thresholds)

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

            # Basic metrics
            mean_residual = float(residuals.mean())
            mean_abs_residual = float(residuals.abs().mean())
            std_residual = float(residuals.std()) if len(residuals) > 1 else 0.0
            positive_ratio = float((residuals > 0).mean())

            # New signals
            predicted = group["predicted"]
            safe_predicted = predicted.replace(0, np.nan)
            ratio_series = group["energy_per_sqft"] / safe_predicted - 1
            excess_ratio = float(ratio_series.mean()) if not ratio_series.isna().all() else 0.0

            # Consistency: fraction of days where daily mean residual > 0
            group_sorted = group.sort_values("readingtime").copy()
            group_sorted["date"] = group_sorted["readingtime"].dt.date
            daily_mean = group_sorted.groupby("date")["residual"].mean()
            consistency = float((daily_mean > 0).mean()) if len(daily_mean) > 0 else 0.0

            # Peak excess: 95th percentile of positive residuals
            positive_residuals = residuals[residuals > 0]
            peak_excess = float(np.percentile(positive_residuals, 95)) if len(positive_residuals) > 0 else 0.0

            # Weather sensitivity: correlation of |residual| with temperature
            weather_sensitivity = 0.0
            if "temperature_2m" in group.columns:
                temp = group["temperature_2m"]
                abs_res = residuals.abs()
                valid = temp.notna() & abs_res.notna()
                if valid.sum() > 10:
                    corr = abs_res[valid].corr(temp[valid])
                    weather_sensitivity = float(abs(corr)) if not np.isnan(corr) else 0.0

            # Total excess energy: mean_residual * grossarea
            gross_area = float(group["grossarea"].iloc[0]) if "grossarea" in group.columns else 1.0
            total_excess_energy = max(mean_residual * gross_area, 0.0)

            # Volatility: mean of rolling std of residuals
            rolling_std = residuals.rolling(window=96, min_periods=24).std()
            volatility = float(rolling_std.mean()) if not rolling_std.isna().all() else 0.0

            n_observations = len(residuals)

            self._metrics[utility][int(bn)] = {
                "mean_residual": mean_residual,
                "mean_abs_residual": mean_abs_residual,
                "std_residual": std_residual,
                "positive_ratio": positive_ratio,
                "latest_actual": float(latest["energy_per_sqft"]),
                "latest_predicted": float(latest["predicted"]),
                "latest_diff": float(latest["energy_per_sqft"] - latest["predicted"]),
                # New signals
                "excess_ratio": excess_ratio,
                "consistency": consistency,
                "peak_excess": peak_excess,
                "weather_sensitivity": weather_sensitivity,
                "total_excess_energy": total_excess_energy,
                "volatility": volatility,
                "gross_area": gross_area,
                "n_observations": n_observations,
            }

    def _compute_confidence(self, m: dict, portfolio_std: float) -> str:
        n = m["n_observations"]
        std = m["std_residual"]
        if n < 96:
            return "low"
        if n < 672 and portfolio_std > 0 and std > 2 * portfolio_std:
            return "low"
        if n < 672:
            return "medium"
        if portfolio_std > 0 and std > 1.5 * portfolio_std:
            return "medium"
        return "high"

    def _compute_signal_details(self, m: dict, all_metrics: dict) -> dict:
        """Compute signal details with percentiles for a single building."""
        signal_keys = ["excess_ratio", "positive_ratio", "consistency", "weather_sensitivity", "peak_excess"]
        building_numbers = list(all_metrics.keys())

        details = {}
        for key in signal_keys:
            all_vals = np.array([all_metrics[bn][key] for bn in building_numbers])
            val = m[key]
            pct = float(np.mean(all_vals <= val)) if len(all_vals) > 0 else 0.5
            meta = SIGNAL_META.get(key, {"label": key, "description": ""})
            details[key] = {
                "value": round(val, 6),
                "percentile": round(pct, 4),
                "label": meta["label"],
                "description": meta["description"],
            }
        return details

    def _score_multi_signal_weighted(self, metrics: dict) -> dict[int, float]:
        """Method A: Z-score 5 signals → weighted average → sigmoid."""
        building_numbers = list(metrics.keys())
        if not building_numbers:
            return {}

        signal_keys = list(SIGNAL_WEIGHTS.keys())
        weights = np.array([SIGNAL_WEIGHTS[k] for k in signal_keys])

        # Build matrix: rows=buildings, cols=signals
        matrix = np.array([
            [metrics[bn][k] for k in signal_keys]
            for bn in building_numbers
        ])

        # Z-score each column
        means = matrix.mean(axis=0)
        stds = matrix.std(axis=0)
        stds[stds == 0] = 1.0
        z_scores = (matrix - means) / stds

        # Weighted average → sigmoid
        weighted = z_scores @ weights
        scores = _sigmoid(weighted)
        return {bn: float(scores[i]) for i, bn in enumerate(building_numbers)}

    def _score_investment_impact(self, metrics: dict) -> dict[int, float]:
        """Method B: mean_residual × grossarea → clip positive → percentile rank."""
        building_numbers = list(metrics.keys())
        if not building_numbers:
            return {}

        values = np.array([
            max(metrics[bn]["mean_residual"] * metrics[bn]["gross_area"], 0.0)
            for bn in building_numbers
        ])
        scores = _percentile_ranks(values)
        return {bn: float(scores[i]) for i, bn in enumerate(building_numbers)}

    def _score_zscore_portfolio(self, metrics: dict) -> dict[int, float]:
        """Method C: mean_abs_residual Z-score from portfolio mean/std → sigmoid."""
        building_numbers = list(metrics.keys())
        if not building_numbers:
            return {}

        values = np.array([metrics[bn]["mean_abs_residual"] for bn in building_numbers])
        mu = values.mean()
        sigma = values.std()
        if sigma == 0:
            return {bn: 0.5 for bn in building_numbers}

        z_scores = (values - mu) / sigma
        scores = _sigmoid(z_scores)
        return {bn: float(scores[i]) for i, bn in enumerate(building_numbers)}

    def _score_multi_signal_percentile(self, metrics: dict) -> dict[int, float]:
        """Method D: percentile rank of 5 signals → average."""
        building_numbers = list(metrics.keys())
        if not building_numbers:
            return {}

        signal_keys = list(SIGNAL_WEIGHTS.keys())
        matrix = np.array([
            [metrics[bn][k] for k in signal_keys]
            for bn in building_numbers
        ])

        # Percentile rank each column, then average
        pct_matrix = np.column_stack([
            _percentile_ranks(matrix[:, i]) for i in range(matrix.shape[1])
        ])
        scores = pct_matrix.mean(axis=1)
        return {bn: float(scores[i]) for i, bn in enumerate(building_numbers)}

    def get_building_scores(
        self, utility: str, scoring_method: str = "multi_signal_weighted"
    ) -> list[BuildingScore]:
        if utility not in self._metrics:
            return []

        metrics = self._metrics[utility]
        if not metrics:
            return []

        building_numbers = list(metrics.keys())

        # Compute primary score based on method
        method_map = {
            "multi_signal_weighted": self._score_multi_signal_weighted,
            "investment_impact": self._score_investment_impact,
            "zscore_portfolio": self._score_zscore_portfolio,
            "multi_signal_percentile": self._score_multi_signal_percentile,
        }
        score_fn = method_map.get(scoring_method, self._score_multi_signal_weighted)
        primary_scores = score_fn(metrics)

        # Always compute investment scores (Method B)
        investment_scores = self._score_investment_impact(metrics)

        # Portfolio std for confidence
        all_stds = [metrics[bn]["std_residual"] for bn in building_numbers]
        portfolio_std = float(np.std(all_stds)) if len(all_stds) > 1 else 0.0

        # Sort by primary score descending for ranking
        sorted_bns = sorted(building_numbers, key=lambda bn: primary_scores.get(bn, 0), reverse=True)
        rank_map = {bn: i + 1 for i, bn in enumerate(sorted_bns)}

        total = len(building_numbers)

        result = []
        for bn in building_numbers:
            m = metrics[bn]
            score = float(np.clip(primary_scores.get(bn, 0), 0, 1))
            inv_score = float(np.clip(investment_scores.get(bn, 0), 0, 1))
            confidence = self._compute_confidence(m, portfolio_std)

            result.append(
                BuildingScore(
                    building_number=bn,
                    utility=utility,
                    score=round(score, 4),
                    status=_status_from_score(score, self._thresholds),
                    mean_residual=round(m["mean_residual"], 6),
                    mean_abs_residual=round(m["mean_abs_residual"], 6),
                    std_residual=round(m["std_residual"], 6),
                    positive_ratio=round(m["positive_ratio"], 4),
                    latest_actual=round(m["latest_actual"], 4),
                    latest_predicted=round(m["latest_predicted"], 4),
                    latest_diff=round(m["latest_diff"], 4),
                    investment_score=round(inv_score, 4),
                    confidence=confidence,
                    rank=rank_map[bn],
                    total_buildings=total,
                    signals=self._compute_signal_details(m, metrics),
                )
            )
        return result

    def get_building_detail_scores(self, building_number: int) -> dict:
        bn = building_number
        by_utility = []
        max_score = 0.0
        max_inv_score = 0.0
        overall_confidence = "high"
        overall_rank = None
        overall_total = 0
        overall_signals = {}
        overall_scores_by_method = {}

        confidence_order = {"low": 0, "medium": 1, "high": 2}

        for utility in self._available_utilities:
            if bn not in self._metrics.get(utility, {}):
                continue
            m = self._metrics[utility][bn]
            metrics = self._metrics[utility]
            building_numbers = list(metrics.keys())

            # Compute all 4 methods for this utility
            method_scores = {
                "multi_signal_weighted": self._score_multi_signal_weighted(metrics).get(bn, 0),
                "investment_impact": self._score_investment_impact(metrics).get(bn, 0),
                "zscore_portfolio": self._score_zscore_portfolio(metrics).get(bn, 0),
                "multi_signal_percentile": self._score_multi_signal_percentile(metrics).get(bn, 0),
            }

            # Primary score = multi_signal_weighted
            score = round(float(np.clip(method_scores["multi_signal_weighted"], 0, 1)), 4)
            inv_score = round(float(np.clip(method_scores["investment_impact"], 0, 1)), 4)

            # Confidence
            all_stds = [metrics[b]["std_residual"] for b in building_numbers]
            portfolio_std = float(np.std(all_stds)) if len(all_stds) > 1 else 0.0
            confidence = self._compute_confidence(m, portfolio_std)

            # Rank by multi_signal_weighted
            all_scores = self._score_multi_signal_weighted(metrics)
            sorted_bns = sorted(building_numbers, key=lambda b: all_scores.get(b, 0), reverse=True)
            rank = sorted_bns.index(bn) + 1 if bn in sorted_bns else len(building_numbers)

            # Signal details
            signals = self._compute_signal_details(m, metrics)

            units_map = {
                "ELECTRICITY": "kWh", "GAS": "varies", "HEAT": "varies",
                "STEAM": "kg", "COOLING": "ton-hours", "COOLING_POWER": "tons",
                "STEAMRATE": "varies", "OIL28SEC": "varies",
            }

            by_utility.append({
                "utility": utility,
                "units": units_map.get(utility, "varies"),
                "score": score,
                "status": _status_from_score(score, self._thresholds),
                "latestActual": round(m["latest_actual"], 4),
                "latestPredicted": round(m["latest_predicted"], 4),
                "latestDiff": round(m["latest_diff"], 4),
                "meanResidual": round(m["mean_residual"], 6),
                "stdResidual": round(m["std_residual"], 6),
                "investmentScore": inv_score,
                "investmentStatus": _status_from_score(inv_score, self._thresholds),
                "confidence": confidence,
                "signals": signals,
            })

            if score > max_score:
                max_score = score
                overall_rank = rank
                overall_total = len(building_numbers)
                overall_signals = signals
                overall_scores_by_method = {k: round(float(np.clip(v, 0, 1)), 4) for k, v in method_scores.items()}

            if inv_score > max_inv_score:
                max_inv_score = inv_score

            if confidence_order.get(confidence, 1) < confidence_order.get(overall_confidence, 2):
                overall_confidence = confidence

        return {
            "overallScore": round(max_score, 4),
            "overallStatus": _status_from_score(max_score, self._thresholds),
            "investmentScore": round(max_inv_score, 4),
            "investmentStatus": _status_from_score(max_inv_score, self._thresholds),
            "confidence": overall_confidence,
            "rank": overall_rank or 0,
            "totalBuildings": overall_total,
            "scoresByMethod": overall_scores_by_method,
            "signals": overall_signals,
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
