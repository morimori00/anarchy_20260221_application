import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useThresholds } from "@/hooks/use-thresholds";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/hooks/use-thresholds";

const ZONE_COLORS = {
  normal: { bg: "bg-emerald-500", label: "Normal" },
  caution: { bg: "bg-yellow-400", label: "Caution" },
  warning: { bg: "bg-orange-400", label: "Warning" },
  anomaly: { bg: "bg-red-500", label: "Anomaly" },
};

function PreviewBar({ thresholds }: { thresholds: Thresholds }) {
  const zones = [
    { key: "normal", start: 0, end: thresholds.caution },
    { key: "caution", start: thresholds.caution, end: thresholds.warning },
    { key: "warning", start: thresholds.warning, end: thresholds.anomaly },
    { key: "anomaly", start: thresholds.anomaly, end: 1 },
  ] as const;

  return (
    <div className="space-y-1">
      <div className="flex h-8 rounded-md overflow-hidden border">
        {zones.map((zone) => {
          const width = (zone.end - zone.start) * 100;
          if (width <= 0) return null;
          const config = ZONE_COLORS[zone.key];
          return (
            <div
              key={zone.key}
              className={`${config.bg} flex items-center justify-center text-xs font-medium text-white transition-all duration-200`}
              style={{ width: `${width}%` }}
            >
              {width > 12 && config.label}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
        <span>0</span>
        <span style={{ position: "relative", left: `${thresholds.caution * 100 - 50}%` }}>
          {thresholds.caution}
        </span>
        <span style={{ position: "relative", left: `${thresholds.warning * 100 - 100}%` }}>
          {thresholds.warning}
        </span>
        <span style={{ position: "relative", left: `${thresholds.anomaly * 100 - 150}%` }}>
          {thresholds.anomaly}
        </span>
        <span>1</span>
      </div>
    </div>
  );
}

function isValid(t: Thresholds): boolean {
  return (
    t.caution > 0 &&
    t.caution < t.warning &&
    t.warning < t.anomaly &&
    t.anomaly < 1
  );
}

export function ThresholdSettings() {
  const { thresholds, updateThresholds } = useThresholds();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Thresholds>(thresholds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDraft({ ...thresholds });
      setError(null);
    }
    setOpen(isOpen);
  };

  const handleChange = (key: keyof Thresholds, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setDraft((prev) => ({ ...prev, [key]: num }));
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!isValid(draft)) {
      setError("Thresholds must satisfy: 0 < Caution < Warning < Anomaly < 1");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateThresholds(draft);
      setOpen(false);
    } catch {
      setError("Failed to save thresholds");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_THRESHOLDS });
    setError(null);
  };

  const valid = isValid(draft);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Score threshold settings"
        >
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Score Threshold Settings</DialogTitle>
          <DialogDescription>
            Adjust the score thresholds that determine building status categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <PreviewBar thresholds={valid ? draft : thresholds} />

          <div className="space-y-3">
            {([
              { key: "caution" as const, label: "Normal \u2192 Caution" },
              { key: "warning" as const, label: "Caution \u2192 Warning" },
              { key: "anomaly" as const, label: "Warning \u2192 Anomaly" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium whitespace-nowrap">{label}</label>
                <Input
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={0.99}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-24 text-right"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!valid || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
