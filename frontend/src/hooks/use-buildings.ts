import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { BuildingsResponse, BuildingMapData } from "@/types/building";

export function useBuildings(utility: string, scoring: string) {
  const [buildings, setBuildings] = useState<BuildingMapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<BuildingsResponse>(`/buildings?utility=${utility}&scoring=${scoring}`)
      .then((res) => setBuildings(res.buildings))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [utility, scoring]);

  return { buildings, loading, error };
}
