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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Info } from "lucide-react";
import { SIGNAL_LABELS } from "@/lib/constants";
import type { SignalDetail } from "@/types/building";

interface SignalBreakdownCardProps {
  signals: Record<string, SignalDetail>;
}

function getSignalRating(percentile: number): { label: string; color: string } {
  if (percentile >= 0.9) return { label: "Very High", color: "text-red-500" };
  if (percentile >= 0.75) return { label: "High", color: "text-orange-400" };
  if (percentile >= 0.5) return { label: "Moderate", color: "text-yellow-500" };
  if (percentile >= 0.25) return { label: "Low", color: "text-emerald-500" };
  return { label: "Very Low", color: "text-emerald-600" };
}

export function SignalBreakdownCard({ signals }: SignalBreakdownCardProps) {
  const signalEntries = Object.entries(signals);

  const radarData = signalEntries.map(([key, detail]) => ({
    signal: detail.label,
    value: Math.round(detail.percentile * 100),
    baseline: 50,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Breakdown</CardTitle>
        <CardDescription>
          These 5 signals measure different aspects of energy efficiency. Higher percentiles indicate stronger anomaly signals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="signal"
                  tick={{ fontSize: 11 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickCount={5}
                />
                <Radar
                  name="Baseline (50th)"
                  dataKey="baseline"
                  stroke="#94a3b8"
                  fill="transparent"
                  strokeDasharray="4 4"
                />
                <Radar
                  name="Building"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Signal Table */}
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Percentile</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signalEntries.map(([key, detail]) => {
                  const rating = getSignalRating(detail.percentile);
                  const description =
                    SIGNAL_LABELS[key]?.description ?? detail.description;

                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-help">
                              {detail.label}
                              <Info className="size-3 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-52">
                            <p className="text-xs">{description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {detail.value.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.round(detail.percentile * 100)}th
                      </TableCell>
                      <TableCell className={`text-right font-medium ${rating.color}`}>
                        {rating.label}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
