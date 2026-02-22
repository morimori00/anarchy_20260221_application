import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { getStatusColor } from "@/lib/constants";
import type { AnomalyStatus } from "@/types/utility";
import type { ConfidenceLevel, SignalDetail } from "@/types/building";

interface ScoreSummaryCardProps {
  score: number;
  status: AnomalyStatus;
  rank: number;
  totalBuildings: number;
  confidence: ConfidenceLevel;
  signals: Record<string, SignalDetail>;
}

function generateExplanation(
  score: number,
  rank: number,
  totalBuildings: number,
  signals: Record<string, SignalDetail>,
): string {
  const pctRank = totalBuildings > 0
    ? Math.round((1 - (rank - 1) / totalBuildings) * 100)
    : 0;

  // Find the signal with the highest percentile
  let topSignal: { key: string; detail: SignalDetail } | null = null;
  for (const [key, detail] of Object.entries(signals)) {
    if (!topSignal || detail.percentile > topSignal.detail.percentile) {
      topSignal = { key, detail };
    }
  }

  if (score < 0.3) {
    return "This building's energy use is close to expected levels. No significant anomalies detected.";
  }

  const topPct = topSignal ? Math.round(topSignal.detail.percentile * 100) : 0;
  const topLabel = topSignal?.detail.label ?? "energy anomalies";

  return `This building ranks in the top ${100 - pctRank}% for energy anomalies, primarily because of its ${topLabel.toLowerCase()} (${topPct}th percentile).`;
}

export function ScoreSummaryCard({
  score,
  status,
  rank,
  totalBuildings,
  confidence,
  signals,
}: ScoreSummaryCardProps) {
  const explanation = generateExplanation(score, rank, totalBuildings, signals);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <span className={`text-4xl font-bold ${getStatusColor(status)}`}>
          {score.toFixed(2)}
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} size="md" />
          <ConfidenceBadge level={confidence} />
        </div>
        {rank > 0 && (
          <p className="text-sm font-medium">
            #{rank} of {totalBuildings}
          </p>
        )}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          {explanation}
        </p>
      </CardContent>
    </Card>
  );
}
