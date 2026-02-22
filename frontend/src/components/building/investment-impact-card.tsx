import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusColor, INVESTMENT_THRESHOLDS } from "@/lib/constants";
import type { AnomalyStatus } from "@/types/utility";

interface InvestmentImpactCardProps {
  investmentScore: number;
  investmentStatus: AnomalyStatus;
  grossArea: number;
  overallScore: number;
}

function generateAdvice(
  investmentScore: number,
  investmentStatus: AnomalyStatus,
  grossArea: number,
): string {
  const isLargeBuilding = grossArea > 50000;

  if (investmentScore >= 0.8) {
    if (isLargeBuilding) {
      return "This large building persistently wastes energy — improvements here could yield significant savings.";
    }
    return "Despite its smaller size, this building wastes more energy per square foot than most. Worth investigating for quick fixes.";
  }
  if (investmentScore >= 0.5) {
    if (isLargeBuilding) {
      return "This building shows moderate energy waste. Given its size, efficiency improvements could have meaningful impact.";
    }
    return "Moderate energy waste detected. Consider a targeted energy audit to identify specific improvement areas.";
  }
  if (investmentScore >= 0.3) {
    return "Some energy waste detected, but the overall impact is modest. Monitor for trends before investing in improvements.";
  }
  return "This building's energy use is close to expected levels. Lower priority for investment.";
}

export function InvestmentImpactCard({
  investmentScore,
  investmentStatus,
  grossArea,
  overallScore,
}: InvestmentImpactCardProps) {
  const advice = generateAdvice(investmentScore, investmentStatus, grossArea);
  const investmentLabel = INVESTMENT_THRESHOLDS[investmentStatus]?.label ?? investmentStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Impact</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <span className={`text-4xl font-bold ${getStatusColor(investmentStatus)}`}>
          {investmentScore.toFixed(2)}
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={investmentStatus} size="md" />
          <span className="text-xs text-muted-foreground">{investmentLabel} Priority</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1 text-xs w-full">
          <span className="text-muted-foreground">Building Area</span>
          <span className="font-medium text-right">{grossArea.toLocaleString()} sqft</span>
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          {advice}
        </p>
      </CardContent>
    </Card>
  );
}
