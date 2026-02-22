export type UtilityType =
  | "ELECTRICITY"
  | "GAS"
  | "HEAT"
  | "STEAM"
  | "COOLING"
  | "COOLING_POWER"
  | "STEAMRATE"
  | "OIL28SEC";

export type AnomalyStatus = "normal" | "caution" | "warning" | "anomaly";

export interface UtilityMeta {
  type: UtilityType;
  label: string;
  units: string;
}

export const UTILITY_LIST: UtilityMeta[] = [
  { type: "ELECTRICITY", label: "Electricity", units: "kWh" },
  { type: "GAS", label: "Gas", units: "varies" },
  { type: "HEAT", label: "Heat", units: "varies" },
  { type: "STEAM", label: "Steam", units: "kg" },
  { type: "COOLING", label: "Cooling", units: "ton-hours" },
  { type: "COOLING_POWER", label: "Cooling Power", units: "tons" },
  { type: "STEAMRATE", label: "Steam Rate", units: "varies" },
  { type: "OIL28SEC", label: "Oil", units: "varies" },
];
