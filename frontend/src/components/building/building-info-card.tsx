import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BuildingDetail } from "@/types/building";

interface BuildingInfoCardProps {
  building: BuildingDetail;
}

export function BuildingInfoCard({ building }: BuildingInfoCardProps) {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: building.buildingName },
    { label: "Building Number", value: building.buildingNumber },
    { label: "Campus", value: building.campusName },
    {
      label: "Address",
      value: [building.address, building.city, building.state, building.postalCode]
        .filter(Boolean)
        .join(", "),
    },
    {
      label: "Gross Area",
      value: `${building.grossArea.toLocaleString()} sqft`,
    },
    {
      label: "Floors",
      value: `${building.floorsAboveGround} above / ${building.floorsBelowGround} below`,
    },
    {
      label: "Construction Year",
      value: building.constructionDate ?? "Unknown",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Building Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-2">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
