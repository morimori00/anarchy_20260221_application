"""Upload service - parse, validate, and ingest data."""
import io
import logging
from dataclasses import dataclass, field

import pandas as pd

from app.services.data_service import DataService
from app.services.scoring_service import ScoringService

logger = logging.getLogger(__name__)

REQUIRED_METER_COLS = {"simscode", "utility", "readingtime", "readingvalue"}
REQUIRED_WEATHER_COLS = {"date", "temperature_2m"}
REQUIRED_BUILDING_COLS = {"buildingnumber"}


@dataclass
class UploadResult:
    rows_ingested: int = 0
    rows_skipped: int = 0
    warnings: list[str] = field(default_factory=list)


class UploadService:
    def __init__(self, data_service: DataService, scoring_service: ScoringService):
        self._data_service = data_service
        self._scoring_service = scoring_service

    def ingest_meter_csv(self, content: bytes) -> UploadResult:
        """Parse and ingest meter data from CSV bytes."""
        df = pd.read_csv(io.BytesIO(content))
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_meter(df)

    def ingest_meter_json(self, rows: list[dict]) -> UploadResult:
        """Parse and ingest meter data from JSON rows."""
        df = pd.DataFrame(rows)
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_meter(df)

    def _ingest_meter(self, df: pd.DataFrame) -> UploadResult:
        result = UploadResult()

        # Check required columns
        missing = REQUIRED_METER_COLS - set(df.columns)
        if missing:
            result.warnings.append(f"Missing required columns: {missing}")
            return result

        # Validate rows
        valid_mask = df["readingvalue"].notna() & df["readingtime"].notna() & df["simscode"].notna()
        invalid_count = int((~valid_mask).sum())
        if invalid_count > 0:
            result.warnings.append(f"{invalid_count} rows have missing required values")
            result.rows_skipped = invalid_count

        valid_df = df[valid_mask].copy()
        if valid_df.empty:
            return result

        # Validate readingvalue is numeric
        valid_df["readingvalue"] = pd.to_numeric(valid_df["readingvalue"], errors="coerce")
        numeric_invalid = valid_df["readingvalue"].isna().sum()
        if numeric_invalid > 0:
            result.warnings.append(f"{int(numeric_invalid)} rows have non-numeric reading values")
            valid_df = valid_df.dropna(subset=["readingvalue"])
            result.rows_skipped += int(numeric_invalid)

        if valid_df.empty:
            return result

        result.rows_ingested = self._data_service.append_meter_data(valid_df)

        # Recompute scores for affected utilities
        affected_utilities = valid_df["utility"].unique().tolist()
        for utility in affected_utilities:
            try:
                self._scoring_service.recompute(utility)
            except Exception as e:
                logger.warning("Failed to recompute scores for %s: %s", utility, e)
                result.warnings.append(f"Score recomputation warning for {utility}")

        return result

    def ingest_weather_csv(self, content: bytes) -> UploadResult:
        """Parse and ingest weather data from CSV bytes."""
        df = pd.read_csv(io.BytesIO(content))
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_weather(df)

    def ingest_weather_json(self, rows: list[dict]) -> UploadResult:
        """Parse and ingest weather data from JSON rows."""
        df = pd.DataFrame(rows)
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_weather(df)

    def _ingest_weather(self, df: pd.DataFrame) -> UploadResult:
        result = UploadResult()

        missing = REQUIRED_WEATHER_COLS - set(df.columns)
        if missing:
            result.warnings.append(f"Missing required columns: {missing}")
            return result

        valid_mask = df["date"].notna()
        invalid_count = int((~valid_mask).sum())
        if invalid_count > 0:
            result.warnings.append(f"{invalid_count} rows have missing date")
            result.rows_skipped = invalid_count

        valid_df = df[valid_mask].copy()
        if valid_df.empty:
            return result

        result.rows_ingested = self._data_service.append_weather_data(valid_df)

        # Recompute all scores since weather affects predictions
        try:
            self._scoring_service.recompute()
        except Exception as e:
            logger.warning("Failed to recompute scores after weather upload: %s", e)
            result.warnings.append("Score recomputation warning")

        return result

    def ingest_building_csv(self, content: bytes) -> UploadResult:
        """Parse and ingest building data from CSV bytes."""
        df = pd.read_csv(io.BytesIO(content))
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_building(df)

    def ingest_building_json(self, rows: list[dict]) -> UploadResult:
        """Parse and ingest building data from JSON rows."""
        df = pd.DataFrame(rows)
        df.columns = [c.strip().lower() for c in df.columns]
        return self._ingest_building(df)

    def _ingest_building(self, df: pd.DataFrame) -> UploadResult:
        result = UploadResult()

        missing = REQUIRED_BUILDING_COLS - set(df.columns)
        if missing:
            result.warnings.append(f"Missing required columns: {missing}")
            return result

        valid_mask = df["buildingnumber"].notna()
        invalid_count = int((~valid_mask).sum())
        if invalid_count > 0:
            result.warnings.append(f"{invalid_count} rows have missing building number")
            result.rows_skipped = invalid_count

        valid_df = df[valid_mask].copy()
        if valid_df.empty:
            return result

        result.rows_ingested = self._data_service.append_building_data(valid_df)
        return result
