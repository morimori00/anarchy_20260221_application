import type { AnomalyStatus } from "@/types/utility";
import type { ConfidenceLevel } from "@/types/building";

export const MAP_CENTER: [number, number] = [-83.019707, 40.001633];
export const MAP_ZOOM = 14;

export const SCORE_THRESHOLDS = {
  normal: { max: 0.3, color: "text-emerald-500", bg: "bg-emerald-500", label: "Normal" },
  caution: { max: 0.5, color: "text-yellow-400", bg: "bg-yellow-400", label: "Caution" },
  warning: { max: 0.8, color: "text-orange-400", bg: "bg-orange-400", label: "Warning" },
  anomaly: { max: 1.0, color: "text-red-500", bg: "bg-red-500", label: "Anomaly" },
} as const;

export function getStatusFromScore(score: number): AnomalyStatus {
  if (score < 0.3) return "normal";
  if (score < 0.5) return "caution";
  if (score < 0.8) return "warning";
  return "anomaly";
}

export function getStatusColor(status: AnomalyStatus): string {
  return SCORE_THRESHOLDS[status].color;
}

export function getStatusBg(status: AnomalyStatus): string {
  return SCORE_THRESHOLDS[status].bg;
}

export const SCORING_METHODS = [
  {
    value: "multi_signal_weighted",
    label: "Anomaly Detection",
    description: "Combines 5 efficiency indicators using AI to find buildings that use more energy than expected",
  },
  {
    value: "investment_impact",
    label: "Investment Priority",
    description: "Highlights buildings where energy improvements would save the most, considering building size",
  },
  {
    value: "zscore_portfolio",
    label: "Portfolio Comparison",
    description: "Shows how each building compares to the campus average — outliers stand out",
  },
  {
    value: "multi_signal_percentile",
    label: "Consensus Ranking",
    description: "Ranks buildings by averaging multiple independent measures — stable and balanced",
  },
] as const;

export const SIGNAL_LABELS: Record<string, { label: string; description: string }> = {
  excess_ratio: {
    label: "Excess Ratio",
    description: "How much more energy this building uses compared to what was predicted",
  },
  positive_ratio: {
    label: "Overconsumption Frequency",
    description: "How often the building uses more energy than expected (higher = more frequent waste)",
  },
  consistency: {
    label: "Consistency",
    description: "Whether the excess energy use is a daily pattern, not just occasional spikes",
  },
  weather_sensitivity: {
    label: "Weather Sensitivity",
    description: "Whether the building's energy waste gets worse with extreme temperatures",
  },
  peak_excess: {
    label: "Peak Excess",
    description: "How severe the worst energy waste moments are",
  },
};

export const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; color: string; bg: string; description: string }> = {
  high: {
    label: "High",
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    description: "Based on extensive data (1+ weeks). Ranking is reliable.",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    description: "Based on moderate data. Ranking is likely accurate but may shift with more data.",
  },
  low: {
    label: "Low",
    color: "text-red-600",
    bg: "bg-red-100",
    description: "Limited data available. Treat this ranking as preliminary.",
  },
};

export const INVESTMENT_THRESHOLDS = {
  normal: { label: "Low", color: "text-emerald-500" },
  caution: { label: "Moderate", color: "text-yellow-400" },
  warning: { label: "High", color: "text-orange-400" },
  anomaly: { label: "Critical", color: "text-red-500" },
} as const;
