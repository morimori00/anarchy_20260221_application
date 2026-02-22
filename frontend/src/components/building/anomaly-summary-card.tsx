import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusColor } from "@/lib/constants";
import type { AnomalyStatus } from "@/types/utility";
import type { UtilityScore } from "@/types/building";

interface AnomalySummaryCardProps {
  anomaly: {
    overallScore: number;
    overallStatus: AnomalyStatus;
    byUtility: UtilityScore[];
  };
}

export function AnomalySummaryCard({ anomaly }: AnomalySummaryCardProps) {
  const sorted = [...anomaly.byUtility].sort((a, b) => b.score - a.score);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <span
          className={`text-4xl font-bold ${getStatusColor(anomaly.overallStatus)}`}
        >
          {anomaly.overallScore.toFixed(2)}
        </span>
        <StatusBadge status={anomaly.overallStatus} size="md" />
        {highest && (
          <p className="text-sm text-muted-foreground">
            Highest: <span className="font-medium text-foreground">{highest.utility}</span>{" "}
            ({highest.score.toFixed(2)})
          </p>
        )}
        {lowest && (
          <p className="text-sm text-muted-foreground">
            Lowest: <span className="font-medium text-foreground">{lowest.utility}</span>{" "}
            ({lowest.score.toFixed(2)})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
