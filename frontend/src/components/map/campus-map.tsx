import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import { StatusBadge } from "@/components/shared/status-badge";
import { MAP_CENTER, MAP_ZOOM, getStatusBg } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { BuildingMapData } from "@/types/building";
import type { AnomalyStatus } from "@/types/utility";

interface CampusMapProps {
  buildings: BuildingMapData[];
  onBuildingClick: (buildingNumber: string) => void;
}

function getMarkerStyles(score: number | null): { bg: string; size: string } {
  const s = score ?? 0;
  if (s >= 0.8) return { bg: "bg-red-500", size: "w-7 h-7" };
  if (s >= 0.5) return { bg: "bg-orange-400", size: "w-6 h-6" };
  if (s >= 0.3) return { bg: "bg-yellow-400", size: "w-5 h-5" };
  return { bg: "bg-emerald-500", size: "w-4 h-4" };
}

function formatArea(area: number): string {
  return area.toLocaleString() + " sqft";
}

export function CampusMap({ buildings, onBuildingClick }: CampusMapProps) {
  return (
    <Map center={MAP_CENTER} zoom={MAP_ZOOM}>
      <MapControls position="bottom-right" showZoom showFullscreen />
      {buildings.map((building) => {
        const { bg, size } = getMarkerStyles(building.anomalyScore);
        const score = building.anomalyScore ?? 0;

        return (
          <MapMarker
            key={building.buildingNumber}
            longitude={building.longitude}
            latitude={building.latitude}
          >
            <MarkerContent>
              <div
                className={`${size} ${bg} rounded-full border-2 border-white drop-shadow cursor-pointer hover:scale-125 transition`}
              />
            </MarkerContent>

            <MarkerTooltip>
              <div className="text-xs font-medium">{building.buildingName}</div>
              <div className="text-xs">Score: {score.toFixed(2)}</div>
            </MarkerTooltip>

            <MarkerPopup className="w-64">
              <div className="space-y-2">
                <div>
                  <div className="font-bold text-sm">{building.buildingName}</div>
                  <div className="text-xs text-muted-foreground">
                    #{building.buildingNumber}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Anomaly Score</span>
                  <span className="font-medium">{score.toFixed(2)}</span>

                  <span className="text-muted-foreground">Gross Area</span>
                  <span className="font-medium">{formatArea(building.grossArea)}</span>

                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={building.status} />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onBuildingClick(building.buildingNumber)}
                >
                  View Details
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </Map>
  );
}
