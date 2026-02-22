import pandas as pd
from datetime import datetime

FEATURE_COLUMNS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "direct_radiation",
    "wind_speed_10m",
    "cloud_cover",
    "apparent_temperature",
    "precipitation",
    "grossarea",
    "floorsaboveground",
    "building_age",
    "hour_of_day",
    "minute_of_hour",
    "day_of_week",
    "is_weekend",
    "energy_lag_4",
    "energy_lag_24",
    "energy_lag_96",
    "energy_lag_672",
    "rolling_mean_96",
    "rolling_std_96",
    "rolling_mean_672",
    "rolling_std_672",
    "temp_x_area",
    "humidity_x_area",
]


def build_features(
    meter_df: pd.DataFrame,
    buildings_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    weather_overrides: dict | None = None,
) -> pd.DataFrame:
    """Build the 25-feature matrix from raw data."""
    df = meter_df.copy()

    # Join with building metadata
    bld = buildings_df.copy()
    bld = bld.dropna(subset=["buildingnumber"])
    bld["buildingnumber"] = bld["buildingnumber"].astype(int)
    df = df.dropna(subset=["simscode"])
    df["simscode"] = df["simscode"].astype(int)
    df = df.merge(
        bld[["buildingnumber", "grossarea", "floorsaboveground", "constructiondate"]],
        left_on="simscode",
        right_on="buildingnumber",
        how="left",
    )

    # Compute building_age
    current_year = datetime.now().year
    df["building_age"] = current_year - pd.to_datetime(
        df["constructiondate"], errors="coerce"
    ).dt.year
    df["building_age"] = df["building_age"].fillna(50)  # default for unknown

    # Compute energy_per_sqft
    df["grossarea"] = df["grossarea"].fillna(1)
    df["energy_per_sqft"] = df["readingvalue"] / df["grossarea"]

    # Join weather data
    df["readingtime"] = pd.to_datetime(df["readingtime"], errors="coerce")
    df["weather_hour"] = df["readingtime"].dt.floor("h")

    weather = weather_df.copy()
    weather["date"] = pd.to_datetime(weather["date"], errors="coerce")

    if weather_overrides:
        for col, val in weather_overrides.items():
            if col in weather.columns:
                weather[col] = val

    df = df.merge(weather, left_on="weather_hour", right_on="date", how="left")

    # Temporal features
    df["hour_of_day"] = df["readingtime"].dt.hour
    df["minute_of_hour"] = df["readingtime"].dt.minute
    df["day_of_week"] = df["readingtime"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # Sort for lag/rolling
    df = df.sort_values(["simscode", "readingtime"]).reset_index(drop=True)

    # Lag features
    for lag_name, lag_periods in [
        ("energy_lag_4", 4),
        ("energy_lag_24", 24),
        ("energy_lag_96", 96),
        ("energy_lag_672", 672),
    ]:
        df[lag_name] = df.groupby("simscode")["energy_per_sqft"].shift(lag_periods)

    # Rolling features
    for window, suffix in [(96, "96"), (672, "672")]:
        grouped = df.groupby("simscode")["energy_per_sqft"]
        df[f"rolling_mean_{suffix}"] = grouped.transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
        df[f"rolling_std_{suffix}"] = grouped.transform(
            lambda x: x.rolling(window, min_periods=1).std()
        )

    # Interaction features
    df["temp_x_area"] = df["temperature_2m"] * df["grossarea"]
    df["humidity_x_area"] = df["relative_humidity_2m"] * df["grossarea"]

    # Fill remaining NaN in features
    df["floorsaboveground"] = df["floorsaboveground"].fillna(1)
    df["rolling_std_96"] = df["rolling_std_96"].fillna(0)
    df["rolling_std_672"] = df["rolling_std_672"].fillna(0)

    # Drop rows with NaN in lag features
    df = df.dropna(subset=["energy_lag_4", "energy_lag_24", "energy_lag_96", "energy_lag_672"])

    return df
