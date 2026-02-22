import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SCORING_METHODS, getStatusFromScore, getStatusColor } from "@/lib/constants";

interface MethodComparisonCardProps {
  scoresByMethod: Record<string, number>;
  rank: number;
  totalBuildings: number;
}

function generateConsistencyMessage(
  scoresByMethod: Record<string, number>,
  rank: number,
  totalBuildings: number,
): string {
  const scores = Object.values(scoresByMethod);
  if (scores.length === 0) return "";

  const allHigh = scores.every((s) => s >= 0.7);
  const allLow = scores.every((s) => s < 0.3);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const spread = maxScore - minScore;

  if (allHigh) {
    return "This building ranks highly across all methods — a strong candidate for energy audit.";
  }
  if (allLow) {
    return "This building ranks low across all methods — energy performance is likely adequate.";
  }
  if (spread > 0.4) {
    const highMethod = Object.entries(scoresByMethod).reduce((a, b) =>
      b[1] > a[1] ? b : a,
    );
    const lowMethod = Object.entries(scoresByMethod).reduce((a, b) =>
      b[1] < a[1] ? b : a,
    );
    const highLabel =
      SCORING_METHODS.find((m) => m.value === highMethod[0])?.label ?? highMethod[0];
    const lowLabel =
      SCORING_METHODS.find((m) => m.value === lowMethod[0])?.label ?? lowMethod[0];
    return `Rankings vary across methods: highest by ${highLabel} (${highMethod[1].toFixed(2)}) but lowest by ${lowLabel} (${lowMethod[1].toFixed(2)}). Consider which perspective matters most for your decision.`;
  }
  return "Rankings are fairly consistent across methods, suggesting a reliable assessment.";
}

export function MethodComparisonCard({
  scoresByMethod,
  rank,
  totalBuildings,
}: MethodComparisonCardProps) {
  const message = generateConsistencyMessage(scoresByMethod, rank, totalBuildings);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Method Comparison</CardTitle>
        <CardDescription>
          Different ranking methods highlight different aspects. Consistent high rankings across methods indicate a robust signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCORING_METHODS.map((method) => {
              const score = scoresByMethod[method.value];
              if (score == null) return null;
              const status = getStatusFromScore(score);
              return (
                <TableRow key={method.value}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{method.label}</div>
                      <div className="text-xs text-muted-foreground">{method.description}</div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${getStatusColor(status)}`}>
                    {score.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={status} size="sm" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {message && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
