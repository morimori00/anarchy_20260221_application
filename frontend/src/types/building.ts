import type { AnomalyStatus, UtilityType } from "./utility";

export interface BuildingMapData {
  buildingNumber: string;
  buildingName: string;
  campusName: string;
  latitude: number;
  longitude: number;
  grossArea: number;
  anomalyScore: number | null;
  status: AnomalyStatus;
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
}

export interface BuildingDetailResponse {
  building: BuildingDetail;
  anomaly: {
    overallScore: number;
    overallStatus: AnomalyStatus;
    byUtility: UtilityScore[];
  };
}
