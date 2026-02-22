import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { UtilitySelector } from "@/components/map/utility-selector";
import { CampusMap } from "@/components/map/campus-map";
import { MapLegend } from "@/components/map/map-legend";
import { useBuildings } from "@/hooks/use-buildings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCORING_METHODS } from "@/lib/constants";

export default function MapOverview() {
  const [selectedUtility, setSelectedUtility] = useState("ELECTRICITY");
  const [scoringMethod, setScoringMethod] = useState("size_normalized");
  const { buildings, loading } = useBuildings(selectedUtility, scoringMethod);
  const navigate = useNavigate();

  const handleBuildingClick = (buildingNumber: string) => {
    navigate(`/buildings/${buildingNumber}`);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Map Overview">
        <UtilitySelector value={selectedUtility} onValueChange={setSelectedUtility} />
        <Select value={scoringMethod} onValueChange={setScoringMethod}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Scoring method" />
          </SelectTrigger>
          <SelectContent>
            {SCORING_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="flex-1 relative w-full" style={{ height: "calc(100vh - 14rem)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        ) : (
          <CampusMap buildings={buildings} onBuildingClick={handleBuildingClick} />
        )}
      </div>

      <div className="flex items-center justify-center py-3 border-t">
        <MapLegend />
      </div>
    </div>
  );
}
