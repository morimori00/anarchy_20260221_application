import { Card, CardContent } from "@/components/ui/card";
import { UtilityIcon } from "@/components/shared/utility-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusColor } from "@/lib/constants";
import type { UtilityScore } from "@/types/building";

interface UtilityCardsProps {
  utilities: UtilityScore[];
}

export function UtilityCards({ utilities }: UtilityCardsProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {utilities.map((u) => (
        <Card key={u.utility} className="w-44 flex-shrink-0">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <UtilityIcon utility={u.utility} />
              <span className="text-sm font-medium">{u.utility}</span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual</span>
                <span className="font-medium">{u.latestActual.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Predicted</span>
                <span className="font-medium">{u.latestPredicted.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difference</span>
                <span
                  className={`font-medium ${
                    u.latestDiff > 0 ? "text-red-500" : "text-green-500"
                  }`}
                >
                  {u.latestDiff > 0 ? "+" : ""}
                  {u.latestDiff.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Anomaly Score</span>
                <span className={`font-medium ${getStatusColor(u.status)}`}>
                  {u.score.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <StatusBadge status={u.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
