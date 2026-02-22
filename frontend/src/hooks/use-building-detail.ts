import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { BuildingDetailResponse } from "@/types/building";

export function useBuildingDetail(buildingNumber: string) {
  const [data, setData] = useState<BuildingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<BuildingDetailResponse>(`/buildings/${buildingNumber}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [buildingNumber]);

  return { data, loading, error };
}
