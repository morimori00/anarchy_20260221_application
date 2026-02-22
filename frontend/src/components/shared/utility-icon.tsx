import {
  Zap,
  Flame,
  Thermometer,
  CloudFog,
  Snowflake,
  Gauge,
  Wind,
  Droplets,
} from "lucide-react";
import type { UtilityType } from "@/types/utility";

const iconMap: Record<UtilityType, React.ComponentType<{ className?: string }>> = {
  ELECTRICITY: Zap,
  GAS: Flame,
  HEAT: Thermometer,
  STEAM: CloudFog,
  COOLING: Snowflake,
  COOLING_POWER: Gauge,
  STEAMRATE: Wind,
  OIL28SEC: Droplets,
};

interface UtilityIconProps {
  utility: UtilityType;
  className?: string;
}

export function UtilityIcon({ utility, className = "size-4" }: UtilityIconProps) {
  const Icon = iconMap[utility] || Zap;
  return <Icon className={className} />;
}
