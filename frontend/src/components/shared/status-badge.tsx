import { getStatusBg, SCORE_THRESHOLDS } from "@/lib/constants";
import type { AnomalyStatus } from "@/types/utility";

interface StatusBadgeProps {
  status: AnomalyStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function StatusBadge({ status, size = "sm", showLabel = true }: StatusBadgeProps) {
  const dotSize = size === "sm" ? "size-3" : "size-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${dotSize} rounded-full ${getStatusBg(status)}`} />
      {showLabel && (
        <span className={textSize}>{SCORE_THRESHOLDS[status].label}</span>
      )}
    </span>
  );
}
