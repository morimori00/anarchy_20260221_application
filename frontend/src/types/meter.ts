export interface TimeSeriesDataPoint {
  timestamp: string;
  actual: number;
  predicted: number | null;
  residual: number | null;
}

export interface TimeSeriesResponse {
  buildingNumber: string;
  utility: string;
  units: string;
  resolution: string;
  data: TimeSeriesDataPoint[];
}
