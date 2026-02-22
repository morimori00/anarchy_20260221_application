import { useState } from "react";
import { ChevronRight, ChevronLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { getStatusFromScore, SCORING_METHODS } from "@/lib/constants";
import type { BuildingMapData } from "@/types/building";

interface RankingPanelProps {
  buildings: BuildingMapData[];
  scoringMethod: string;
  isInvestmentView: boolean;
  onBuildingClick: (buildingNumber: string) => void;
}

export function RankingPanel({
  buildings,
  scoringMethod,
  isInvestmentView,
  onBuildingClick,
}: RankingPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = [...buildings]
    .filter((b) => {
      const score = isInvestmentView ? b.investmentScore : b.anomalyScore;
      return score != null;
    })
    .sort((a, b) => {
      const sa = isInvestmentView ? (a.investmentScore ?? 0) : (a.anomalyScore ?? 0);
      const sb = isInvestmentView ? (b.investmentScore ?? 0) : (b.anomalyScore ?? 0);
      return sb - sa;
    })
    .slice(0, 10);

  const methodLabel = SCORING_METHODS.find((m) => m.value === scoringMethod)?.label ?? scoringMethod;

  if (collapsed) {
    return (
      <div className="absolute top-2 left-2 z-10">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/95 backdrop-blur shadow"
          onClick={() => setCollapsed(false)}
        >
          <Trophy className="size-4" />
          Top 10
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-10 w-72 max-h-[calc(100%-1rem)] bg-background/95 backdrop-blur border rounded-lg shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <div>
            <div className="text-sm font-semibold">Top 10 Buildings</div>
            <div className="text-xs text-muted-foreground">{methodLabel}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(true)}>
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      <div className="overflow-y-auto flex-1">
        {sorted.map((building, idx) => {
          const score = isInvestmentView
            ? (building.investmentScore ?? 0)
            : (building.anomalyScore ?? 0);
          const status = getStatusFromScore(score);

          return (
            <button
              key={building.buildingNumber}
              onClick={() => onBuildingClick(building.buildingNumber)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-5">
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {building.buildingName}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium">{score.toFixed(2)}</span>
                    <StatusBadge status={status} size="sm" />
                    <ConfidenceBadge level={building.confidence} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
