import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BuildingInfoCard } from "@/components/building/building-info-card";
import { AnomalySummaryCard } from "@/components/building/anomaly-summary-card";
import { UtilityCards } from "@/components/building/utility-cards";
import { TimeSeriesChart } from "@/components/building/time-series-chart";
import { AnomalyDetailTable } from "@/components/building/anomaly-detail-table";
import { useBuildingDetail } from "@/hooks/use-building-detail";
import { useTimeSeries } from "@/hooks/use-time-series";
import { BuildingLoader } from "@/components/shared/loading-animations";

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All" },
] as const;

function getDateRange(range: string): { start?: string; end?: string } {
  if (range === "all") return {};
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Number(range));
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function BuildingDetail() {
  const { buildingNumber } = useParams<{ buildingNumber: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useBuildingDetail(buildingNumber ?? "");

  const utilities = data?.anomaly.byUtility ?? [];
  const defaultUtility = utilities[0]?.utility ?? "ELECTRICITY";

  const [selectedUtility, setSelectedUtility] = useState<string>("");
  const [dateRange, setDateRange] = useState("30");

  const activeUtility = selectedUtility || defaultUtility;
  const { start, end } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const activeUtilityMeta = utilities.find((u) => u.utility === activeUtility);

  const {
    data: tsData,
    loading: tsLoading,
  } = useTimeSeries(
    buildingNumber ?? "",
    activeUtility,
    "hourly",
    start,
    end,
  );

  if (loading) {
    return (
      <BuildingLoader />
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Building not found</p>
        <Button variant="ghost" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
          Back to Map
        </Button>
      </div>
    );
  }

  const { building, anomaly } = data;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
          Back to Map
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{building.buildingName}</h1>
        <p className="text-sm text-muted-foreground">
          Building {building.buildingNumber}
        </p>
      </div>

      {/* Info + Anomaly summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BuildingInfoCard building={building} />
        <AnomalySummaryCard anomaly={anomaly} />
      </div>

      {/* Utility cards */}
      <UtilityCards utilities={utilities} />

      {/* Time Series Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs
            value={activeUtility}
            onValueChange={setSelectedUtility}
          >
            <TabsList>
              {utilities.map((u) => (
                <TabsTrigger key={u.utility} value={u.utility}>
                  {u.utility}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Render empty TabsContent to satisfy Radix requirement */}
            {utilities.map((u) => (
              <TabsContent key={u.utility} value={u.utility} />
            ))}
          </Tabs>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tsLoading ? (
          <div className="flex items-center justify-center h-80 text-muted-foreground">
            Loading chart...
          </div>
        ) : tsData?.data.length ? (
          <TimeSeriesChart
            data={tsData.data}
            units={activeUtilityMeta?.units ?? tsData.units}
          />
        ) : (
          <div className="flex items-center justify-center h-80 text-muted-foreground">
            No data available for this selection.
          </div>
        )}
      </div>

      {/* Anomaly detail table */}
      {tsData?.data.length ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Anomaly Details</h2>
          <AnomalyDetailTable data={tsData.data} />
        </div>
      ) : null}
    </div>
  );
}
