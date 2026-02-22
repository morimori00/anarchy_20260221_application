import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface Thresholds {
  caution: number;
  warning: number;
  anomaly: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  caution: 0.3,
  warning: 0.5,
  anomaly: 0.8,
};

interface ThresholdsContextValue {
  thresholds: Thresholds;
  updateThresholds: (t: Thresholds) => Promise<void>;
  loading: boolean;
}

export const ThresholdsContext = createContext<ThresholdsContextValue>({
  thresholds: DEFAULT_THRESHOLDS,
  updateThresholds: async () => {},
  loading: false,
});

export function useThresholdsProvider() {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Thresholds>("/settings/thresholds")
      .then(setThresholds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateThresholds = useCallback(async (t: Thresholds) => {
    const result = await apiFetch<Thresholds>("/settings/thresholds", {
      method: "PUT",
      body: JSON.stringify(t),
    });
    setThresholds(result);
  }, []);

  return { thresholds, updateThresholds, loading };
}

export function useThresholds() {
  return useContext(ThresholdsContext);
}
