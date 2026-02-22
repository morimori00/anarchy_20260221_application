import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { TimeSeriesResponse } from "@/types/meter";

export function useTimeSeries(
  buildingNumber: string,
  utility: string,
  resolution: string = "hourly",
  start?: string,
  end?: string,
) {
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ utility, resolution });
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    apiFetch<TimeSeriesResponse>(`/buildings/${buildingNumber}/timeseries?${params}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [buildingNumber, utility, resolution, start, end]);

  return { data, loading, error };
}
