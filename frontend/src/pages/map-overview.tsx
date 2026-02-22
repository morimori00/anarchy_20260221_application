import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { UtilitySelector } from "@/components/map/utility-selector";
import { CampusMap } from "@/components/map/campus-map";
import { MapLegend } from "@/components/map/map-legend";
import { RankingPanel } from "@/components/map/ranking-panel";
import { useBuildings } from "@/hooks/use-buildings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { SCORING_METHODS } from "@/lib/constants";
import { MapLoader } from "@/components/shared/loading-animations";
import { ThresholdSettings } from "@/components/settings/threshold-settings";
import { HelpCircle } from "lucide-react";

export default function MapOverview() {
  const [selectedUtility, setSelectedUtility] = useState("ELECTRICITY");
  const [scoringMethod, setScoringMethod] = useState("multi_signal_weighted");
  const { buildings, loading } = useBuildings(selectedUtility, scoringMethod);
  const navigate = useNavigate();

  const handleBuildingClick = (buildingNumber: string) => {
    navigate(`/buildings/${buildingNumber}`);
  };

  const currentMethod = SCORING_METHODS.find((m) => m.value === scoringMethod);
  const isInvestmentView = scoringMethod === "investment_impact";

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Map Overview">
        <UtilitySelector value={selectedUtility} onValueChange={setSelectedUtility} />
        <div className="flex items-center gap-1">
          <Select value={scoringMethod} onValueChange={setScoringMethod}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Scoring method" />
            </SelectTrigger>
            <SelectContent>
              {SCORING_METHODS.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  <div>
                    <div>{method.label}</div>
                    <div className="text-xs text-muted-foreground">{method.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="size-4" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">What is this view?</h4>
                <p className="text-xs text-muted-foreground">
                  This map shows buildings colored by their energy anomaly score. Choose a scoring
                  method to highlight different aspects of energy efficiency. Each method uses
                  AI predictions to compare actual vs. expected energy consumption.
                </p>
                {currentMethod && (
                  <p className="text-xs">
                    <span className="font-medium">{currentMethod.label}:</span>{" "}
                    {currentMethod.description}
                  </p>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
          <ThresholdSettings />
        </div>
      </PageHeader>

      <div className="flex-1 relative w-full" style={{ height: "calc(100vh - 14rem)" }}>
        {loading ? (
          <MapLoader />
        ) : (
          <>
            <CampusMap
              buildings={buildings}
              onBuildingClick={handleBuildingClick}
              isInvestmentView={isInvestmentView}
            />
            <RankingPanel
              buildings={buildings}
              scoringMethod={scoringMethod}
              isInvestmentView={isInvestmentView}
              onBuildingClick={handleBuildingClick}
            />
          </>
        )}
      </div>

      <div className="flex items-center justify-center py-3 border-t">
        <MapLegend isInvestmentView={isInvestmentView} />
      </div>
    </div>
  );
}
