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

# LSTM gas model: 28 temporal features (order must match training checkpoint)
LSTM_GAS_TEMPORAL_COLS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "direct_radiation",
    "wind_speed_10m",
    "cloud_cover",
    "apparent_temperature",
    "precipitation",
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
    "hdd",
    "cdd",
    "elec_energy_lag_4",
    "elec_energy_lag_24",
    "elec_energy_lag_96",
    "elec_energy_lag_672",
]

LSTM_GAS_STATIC_COLS = ["grossarea", "floorsaboveground", "building_age"]

LSTM_GAS_SEQ_LENGTH = 48


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

    # Heating / Cooling Degree values (base 65 °F)
    HDD_BASE = 65.0
    df["hdd"] = (HDD_BASE - df["temperature_2m"]).clip(lower=0)
    df["cdd"] = (df["temperature_2m"] - HDD_BASE).clip(lower=0)

    # Fill remaining NaN in features
    df["floorsaboveground"] = df["floorsaboveground"].fillna(1)
    df["rolling_std_96"] = df["rolling_std_96"].fillna(0)
    df["rolling_std_672"] = df["rolling_std_672"].fillna(0)

    # Drop rows with NaN in lag features
    df = df.dropna(subset=["energy_lag_4", "energy_lag_24", "energy_lag_96", "energy_lag_672"])

    return df


def build_lstm_gas_features(
    gas_meter_df: pd.DataFrame,
    elec_meter_df: pd.DataFrame | None,
    buildings_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    weather_overrides: dict | None = None,
) -> pd.DataFrame:
    """Build features for LSTM gas model including cross-utility electricity lags.

    Returns a DataFrame with columns: simscode, readingtime, energy_per_sqft,
    plus all 28 temporal cols and 3 static cols needed by the LSTM.
    """
    # Build standard features from gas meter data
    df = build_features(gas_meter_df, buildings_df, weather_df, weather_overrides)
    if df.empty:
        return df

    # Add cross-utility electricity lag features
    if elec_meter_df is not None and not elec_meter_df.empty:
        elec = elec_meter_df.copy()
        elec = elec.dropna(subset=["simscode"])
        elec["simscode"] = elec["simscode"].astype(int)
        elec["readingtime"] = pd.to_datetime(elec["readingtime"], errors="coerce")

        # Join with building metadata to get grossarea
        bld = buildings_df.copy()
        bld = bld.dropna(subset=["buildingnumber"])
        bld["buildingnumber"] = bld["buildingnumber"].astype(int)
        elec = elec.merge(
            bld[["buildingnumber", "grossarea"]],
            left_on="simscode",
            right_on="buildingnumber",
            how="left",
        )
        elec["grossarea"] = elec["grossarea"].fillna(1)
        elec["elec_energy_per_sqft"] = elec["readingvalue"] / elec["grossarea"]

        # Compute electricity lags per building
        elec = elec.sort_values(["simscode", "readingtime"]).reset_index(drop=True)
        for lag_name, lag_periods in [
            ("elec_energy_lag_4", 4),
            ("elec_energy_lag_24", 24),
            ("elec_energy_lag_96", 96),
            ("elec_energy_lag_672", 672),
        ]:
            elec[lag_name] = elec.groupby("simscode")[
                "elec_energy_per_sqft"
            ].shift(lag_periods)

        # Merge electricity lags into gas DataFrame
        elec_lags = elec[
            ["simscode", "readingtime",
             "elec_energy_lag_4", "elec_energy_lag_24",
             "elec_energy_lag_96", "elec_energy_lag_672"]
        ].drop_duplicates(subset=["simscode", "readingtime"], keep="last")

        df = df.merge(elec_lags, on=["simscode", "readingtime"], how="left")

    # Fill missing cross-utility features with 0
    for col in ["elec_energy_lag_4", "elec_energy_lag_24",
                "elec_energy_lag_96", "elec_energy_lag_672"]:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = df[col].fillna(0.0)

    return df
