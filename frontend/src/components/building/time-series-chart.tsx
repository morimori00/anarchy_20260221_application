import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TimeSeriesDataPoint } from "@/types/meter";

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  units: string;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChartPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartPayloadEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-sm shadow-md">
      <p className="mb-1 font-medium">{label ? formatTimestamp(label) : ""}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(2) ?? "N/A"}
        </p>
      ))}
    </div>
  );
}

export function TimeSeriesChart({ data, units }: TimeSeriesChartProps) {
  // Split residual into positive / negative for dual-color Area
  const chartData = data.map((d) => ({
    ...d,
    residualPos: d.residual !== null && d.residual > 0 ? d.residual : 0,
    residualNeg: d.residual !== null && d.residual < 0 ? d.residual : 0,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            label={{
              value: units,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend />

          {/* Residual areas */}
          <Area
            type="monotone"
            dataKey="residualPos"
            name="Residual (+)"
            stroke="none"
            fill="#ef4444"
            fillOpacity={0.3}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="residualNeg"
            name="Residual (-)"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.3}
            isAnimationActive={false}
          />

          {/* Lines */}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
