import type { AnomalyStatus } from "@/types/utility";

export const MAP_CENTER: [number, number] = [40.0016, -83.0197];
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
  { value: "size_normalized", label: "Size-Normalized" },
  { value: "percentile_rank", label: "Percentile Rank" },
  { value: "absolute_threshold", label: "Absolute Threshold" },
] as const;
