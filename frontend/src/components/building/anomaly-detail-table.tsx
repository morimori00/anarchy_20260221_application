import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusFromScore } from "@/lib/constants";
import type { TimeSeriesDataPoint } from "@/types/meter";

interface AnomalyDetailTableProps {
  data: TimeSeriesDataPoint[];
}

const PAGE_SIZE = 20;

export function AnomalyDetailTable({ data }: AnomalyDetailTableProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(() => {
    return [...data].sort(
      (a, b) => Math.abs(b.residual ?? 0) - Math.abs(a.residual ?? 0),
    );
  }, [data]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Predicted</TableHead>
            <TableHead className="text-right">Residual</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row, idx) => {
            const absResidual = Math.abs(row.residual ?? 0);
            const status = getStatusFromScore(
              Math.min(absResidual / (Math.max(...data.map((d) => Math.abs(d.residual ?? 0))) || 1), 1),
            );

            return (
              <TableRow key={`${row.timestamp}-${idx}`}>
                <TableCell>{formatTimestamp(row.timestamp)}</TableCell>
                <TableCell className="text-right">{row.actual.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {row.predicted !== null ? row.predicted.toFixed(2) : "N/A"}
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    (row.residual ?? 0) > 0 ? "text-red-500" : "text-green-500"
                  }`}
                >
                  {row.residual !== null ? row.residual.toFixed(2) : "N/A"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
