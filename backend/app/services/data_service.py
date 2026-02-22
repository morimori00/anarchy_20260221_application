import logging
from datetime import datetime
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


class DataService:
    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._buildings: pd.DataFrame = pd.DataFrame()
        self._meter_data: pd.DataFrame = pd.DataFrame()
        self._weather: pd.DataFrame = pd.DataFrame()
        self._buildings_with_meters: set[int] = set()
        self._load()

    def _load(self):
        logger.info("Loading data from %s", self._data_dir)

        # Load building metadata
        self._buildings = pd.read_csv(self._data_dir / "building_metadata.csv")
        # self._buildings["buildingnumber"] = self._buildings["buildingnumber"].astype(str)
        if "constructiondate" in self._buildings.columns:
            self._buildings["constructiondate"] = pd.to_datetime(
                self._buildings["constructiondate"], errors="coerce"
            )

        # Load meter data
        dfs = []
        for f in sorted(self._data_dir.glob("meter-data-*.csv")):
            logger.info("Loading %s", f.name)
            df = pd.read_csv(f)
            dfs.append(df)
        if dfs:
            self._meter_data = pd.concat(dfs, ignore_index=True)
            print(f"Columns in meter data: {self._meter_data.columns.tolist()}")
            # self._meter_data["simscode"] = self._meter_data["simscode"].astype(int)
            self._meter_data["readingtime"] = pd.to_datetime(
                self._meter_data["readingtime"], errors="coerce"
            )
        else:
            logger.warning("No meter data files found")

        # Load weather data
        weather_files = list(self._data_dir.glob("weather*.csv"))
        if weather_files:
            self._weather = pd.read_csv(weather_files[0])
            self._weather["date"] = pd.to_datetime(self._weather["date"], errors="coerce")
        else:
            logger.warning("No weather data file found")

        # Build index of buildings with meters
        if not self._meter_data.empty:
            self._buildings_with_meters = set(self._meter_data["simscode"].unique())

        logger.info(
            "Loaded: %d buildings, %d with meters, %d meter readings, %d weather rows",
            len(self._buildings),
            len(self._buildings_with_meters),
            len(self._meter_data),
            len(self._weather),
        )

    def get_all_buildings(self) -> list[dict]:
        mask = self._buildings["buildingnumber"].isin(self._buildings_with_meters)
        mask &= self._buildings["latitude"].notna()
        mask &= self._buildings["longitude"].notna()
        df = self._buildings[mask]

        result = []
        for _, row in df.iterrows():
            result.append(
                {
                    "buildingNumber": int(row["buildingnumber"]),
                    "buildingName": row.get("buildingname", ""),
                    "campusName": row.get("campusname", ""),
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "grossArea": row.get("grossarea", 0),
                    "constructionDate": (
                        row["constructiondate"].isoformat()
                        if pd.notna(row.get("constructiondate"))
                        else None
                    ),
                    "floorsAboveGround": row.get("floorsaboveground", 0),
                    "floorsBelowGround": row.get("floorsbelowground", 0),
                }
            )
        return result

    def get_building(self, building_number: int) -> dict | None:
        df = self._buildings[self._buildings["buildingnumber"] == building_number]
        if df.empty:
            return None
        row = df.iloc[0]
        return {
            "buildingNumber": int(row["buildingnumber"]),
            "buildingName": row.get("buildingname", ""),
            "formalName": row.get("formalname", ""),
            "campusName": row.get("campusname", ""),
            "address": row.get("address", ""),
            "city": row.get("city", ""),
            "state": row.get("state", ""),
            "postalCode": row.get("postalcode", ""),
            "grossArea": row.get("grossarea", 0),
            "floorsAboveGround": row.get("floorsaboveground", 0),
            "floorsBelowGround": row.get("floorsbelowground", 0),
            "constructionDate": (
                row["constructiondate"].isoformat()
                if pd.notna(row.get("constructiondate"))
                else None
            ),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
        }

    def get_building_utilities(self, building_number: int) -> list[str]:
        mask = self._meter_data["simscode"] == building_number
        return sorted(self._meter_data.loc[mask, "utility"].unique().tolist())

    def get_meter_data(
        self,
        building_number: int,
        utility: str,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> pd.DataFrame:
        mask = (self._meter_data["simscode"] == building_number) & (
            self._meter_data["utility"] == utility
        )
        if start:
            mask &= self._meter_data["readingtime"] >= start
        if end:
            mask &= self._meter_data["readingtime"] <= end
        return self._meter_data[mask].copy()

    def get_aggregated_meter_data(
        self,
        building_number: int,
        utility: str,
        resolution: str = "hourly",
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> pd.DataFrame:
        df = self.get_meter_data(building_number, utility, start, end)
        if df.empty:
            return pd.DataFrame(columns=["timestamp", "readingvalue_sum", "readingvalue_mean", "count"])

        if resolution == "15min":
            result = df[["readingtime", "readingvalue"]].copy()
            result = result.rename(columns={"readingtime": "timestamp"})
            result["readingvalue_sum"] = result["readingvalue"]
            result["readingvalue_mean"] = result["readingvalue"]
            result["count"] = 1
            return result

        if resolution == "hourly":
            df["bucket"] = df["readingtime"].dt.floor("h")
        else:  # daily
            df["bucket"] = df["readingtime"].dt.floor("D")

        agg = (
            df.groupby("bucket")
            .agg(
                readingvalue_sum=("readingvalue", "sum"),
                readingvalue_mean=("readingvalue", "mean"),
                count=("readingvalue", "count"),
            )
            .reset_index()
            .rename(columns={"bucket": "timestamp"})
        )
        return agg

    def get_weather(
        self, start: datetime | None = None, end: datetime | None = None
    ) -> pd.DataFrame:
        df = self._weather.copy()
        if start:
            df = df[df["date"] >= start]
        if end:
            df = df[df["date"] <= end]
        return df

    def get_all_meter_data_for_utility(self, utility: str) -> pd.DataFrame:
        return self._meter_data[self._meter_data["utility"] == utility].copy()

    def append_meter_data(self, df: pd.DataFrame) -> int:
        df = df.copy()
        df["simscode"] = df["simscode"].astype(int)
        if "readingtime" in df.columns:
            df["readingtime"] = pd.to_datetime(df["readingtime"], errors="coerce")
        self._meter_data = pd.concat([self._meter_data, df], ignore_index=True)
        self._buildings_with_meters.update(df["simscode"].unique())
        return len(df)

    def append_weather_data(self, df: pd.DataFrame) -> int:
        df = df.copy()
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
        self._weather = pd.concat([self._weather, df], ignore_index=True)
        return len(df)

    def append_building_data(self, df: pd.DataFrame) -> int:
        df = df.copy()
        df["buildingnumber"] = df["buildingnumber"].astype(int)
        self._buildings = pd.concat([self._buildings, df], ignore_index=True)
        return len(df)
