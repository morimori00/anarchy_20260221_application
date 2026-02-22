import type { AnomalyStatus, UtilityType } from "./utility";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface SignalDetail {
  value: number;
  percentile: number;
  label: string;
  description: string;
}

export interface BuildingMapData {
  buildingNumber: string;
  buildingName: string;
  campusName: string;
  latitude: number;
  longitude: number;
  grossArea: number;
  anomalyScore: number | null;
  status: AnomalyStatus;
  investmentScore: number | null;
  confidence: ConfidenceLevel;
  rank: number | null;
  utilities: UtilityType[];
}

export interface BuildingsResponse {
  buildings: BuildingMapData[];
  meta: {
    totalBuildings: number;
    selectedUtility: string;
    scoringMethod: string;
  };
}

export interface BuildingDetail {
  buildingNumber: string;
  buildingName: string;
  formalName: string;
  campusName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  grossArea: number;
  floorsAboveGround: number;
  floorsBelowGround: number;
  constructionDate: string | null;
  latitude: number;
  longitude: number;
}

export interface UtilityScore {
  utility: UtilityType;
  units: string;
  score: number;
  status: AnomalyStatus;
  latestActual: number;
  latestPredicted: number;
  latestDiff: number;
  meanResidual: number;
  stdResidual: number;
  investmentScore: number;
  investmentStatus: AnomalyStatus;
  confidence: ConfidenceLevel;
  signals: Record<string, SignalDetail>;
}

export interface BuildingDetailResponse {
  building: BuildingDetail;
  anomaly: {
    overallScore: number;
    overallStatus: AnomalyStatus;
    investmentScore: number;
    investmentStatus: AnomalyStatus;
    confidence: ConfidenceLevel;
    rank: number;
    totalBuildings: number;
    scoresByMethod: Record<string, number>;
    signals: Record<string, SignalDetail>;
    byUtility: UtilityScore[];
  };
}
