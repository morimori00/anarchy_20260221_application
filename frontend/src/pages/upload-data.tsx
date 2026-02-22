import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, Plus, X, CloudDownload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeterRow {
  meterId: string;
  siteName: string;
  simsCode: string;
  utility: string;
  readingTime: string;
  readingValue: string;
  readingUnits: string;
}

interface WeatherRow {
  date: string;
  tempHigh: string;
  tempLow: string;
  humidity: string;
  precipitation: string;
}

interface BuildingRow {
  buildingNumber: string;
  buildingName: string;
  squareFeet: string;
  yearBuilt: string;
  primaryUse: string;
}

type DataRow = MeterRow | WeatherRow | BuildingRow;

const EMPTY_METER_ROW: MeterRow = {
  meterId: "",
  siteName: "",
  simsCode: "",
  utility: "ELECTRICITY",
  readingTime: "",
  readingValue: "",
  readingUnits: "kWh",
};

const EMPTY_BUILDING_ROW: BuildingRow = {
  buildingNumber: "",
  buildingName: "",
  squareFeet: "",
  yearBuilt: "",
  primaryUse: "",
};

const UTILITY_OPTIONS = ["ELECTRICITY", "GAS", "HEAT", "STEAM", "COOLING", "COOLING_POWER", "STEAMRATE", "OIL28SEC"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function endpointForTab(tab: string): string {
  switch (tab) {
    case "meter":
      return "/upload/meter";
    case "weather":
      return "/upload/weather";
    case "building":
      return "/upload/building";
    default:
      return "/upload/meter";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CsvDropZone({
  onFileSelected,
  file,
  onClear,
  onSubmit,
  uploading,
}: {
  onFileSelected: (f: File) => void;
  file: File | null;
  onClear: () => void;
  onSubmit: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.name.endsWith(".csv")) onFileSelected(f);
    },
    [onFileSelected],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFileSelected(f);
    },
    [onFileSelected],
  );

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mx-auto size-10 text-muted-foreground mb-4" />
        <p className="text-sm font-medium">Drag &amp; drop a CSV file here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
        <p className="text-xs text-muted-foreground mt-2">Accepted: .csv (max 250MB)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Upload className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={onClear}>
              <X className="size-4" />
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={uploading}>
              {uploading ? "Uploading..." : "Submit"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeterManualEntry({
  rows,
  setRows,
  onSubmit,
  submitting,
}: {
  rows: MeterRow[];
  setRows: React.Dispatch<React.SetStateAction<MeterRow[]>>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const updateRow = (index: number, field: keyof MeterRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-4">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-3 border rounded-lg p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Meter ID</label>
            <Input value={row.meterId} onChange={(e) => updateRow(idx, "meterId", e.target.value)} placeholder="M-001" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Site Name</label>
            <Input value={row.siteName} onChange={(e) => updateRow(idx, "siteName", e.target.value)} placeholder="Building 311" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">SIMS Code</label>
            <Input value={row.simsCode} onChange={(e) => updateRow(idx, "simsCode", e.target.value)} placeholder="SIMS-001" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Utility</label>
            <Select value={row.utility} onValueChange={(v) => updateRow(idx, "utility", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UTILITY_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>{u.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reading Time</label>
            <Input type="datetime-local" value={row.readingTime} onChange={(e) => updateRow(idx, "readingTime", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reading Value</label>
            <Input type="number" value={row.readingValue} onChange={(e) => updateRow(idx, "readingValue", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reading Units</label>
            <Input value={row.readingUnits} onChange={(e) => updateRow(idx, "readingUnits", e.target.value)} placeholder="kWh" />
          </div>
          <div className="flex items-end">
            {rows.length > 1 && (
              <Button variant="ghost" size="icon-sm" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, { ...EMPTY_METER_ROW }])}>
          <Plus className="size-4" /> Add Row
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit All"}
        </Button>
      </div>
    </div>
  );
}

function BuildingManualEntry({
  rows,
  setRows,
  onSubmit,
  submitting,
}: {
  rows: BuildingRow[];
  setRows: React.Dispatch<React.SetStateAction<BuildingRow[]>>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const updateRow = (index: number, field: keyof BuildingRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-4">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-2 md:grid-cols-3 gap-3 border rounded-lg p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Building Number</label>
            <Input value={row.buildingNumber} onChange={(e) => updateRow(idx, "buildingNumber", e.target.value)} placeholder="311" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Building Name</label>
            <Input value={row.buildingName} onChange={(e) => updateRow(idx, "buildingName", e.target.value)} placeholder="Caldwell Lab" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Square Feet</label>
            <Input type="number" value={row.squareFeet} onChange={(e) => updateRow(idx, "squareFeet", e.target.value)} placeholder="50000" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Year Built</label>
            <Input type="number" value={row.yearBuilt} onChange={(e) => updateRow(idx, "yearBuilt", e.target.value)} placeholder="1990" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Primary Use</label>
            <Input value={row.primaryUse} onChange={(e) => updateRow(idx, "primaryUse", e.target.value)} placeholder="Academic" />
          </div>
          <div className="flex items-end">
            {rows.length > 1 && (
              <Button variant="ghost" size="icon-sm" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, { ...EMPTY_BUILDING_ROW }])}>
          <Plus className="size-4" /> Add Row
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit All"}
        </Button>
      </div>
    </div>
  );
}

function WeatherApiFetcher({
  onFetched,
  fetching,
  setFetching,
}: {
  onFetched: (rows: WeatherRow[]) => void;
  fetching: boolean;
  setFetching: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!startDate || !endDate) return;
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<{ rows: WeatherRow[] }>(
        `/weather/fetch?start=${startDate}&end=${endDate}`,
      );
      onFetched(data.rows ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Coordinates</label>
          <p className="text-sm text-muted-foreground h-9 flex items-center">40.08, -83.06</p>
        </div>
      </div>
      <Button size="sm" onClick={handleFetch} disabled={fetching || !startDate || !endDate}>
        <CloudDownload className="size-4" />
        {fetching ? "Fetching..." : "Fetch Data"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DataPreview({
  tab,
  rows,
  onCancel,
  onSubmit,
  submitting,
}: {
  tab: string;
  rows: DataRow[];
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  if (rows.length === 0) return null;

  const headers = Object.keys(rows[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Data Preview ({rows.length} rows)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h) => (
                  <TableHead key={h} className="text-xs capitalize">
                    {h.replace(/([A-Z])/g, " $1").trim()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row, idx) => (
                <TableRow key={idx}>
                  {headers.map((h) => (
                    <TableCell key={h} className="text-xs">
                      {(row as Record<string, string>)[h]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > 50 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing first 50 of {rows.length} rows
          </p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : `Submit ${rows.length} rows`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function UploadData() {
  const [activeTab, setActiveTab] = useState("meter");
  const [uploadMethod, setUploadMethod] = useState("csv");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual entry state
  const [meterRows, setMeterRows] = useState<MeterRow[]>([{ ...EMPTY_METER_ROW }]);
  const [buildingRows, setBuildingRows] = useState<BuildingRow[]>([{ ...EMPTY_BUILDING_ROW }]);
  const [previewRows, setPreviewRows] = useState<DataRow[]>([]);

  const resetState = () => {
    setFile(null);
    setMessage(null);
    setPreviewRows([]);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setUploadMethod("csv");
    resetState();
  };

  const handleMethodChange = (method: string) => {
    if (!method) return;
    setUploadMethod(method);
    resetState();
  };

  // CSV upload handler
  const handleCsvSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api${endpointForTab(activeTab)}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Upload failed: ${res.status}`);
      }
      const data = await res.json();
      setMessage({ type: "success", text: data.message || `Successfully uploaded ${file.name}` });
      setFile(null);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  // Manual entry submit handlers
  const handleMeterManualSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ message: string }>("/upload/meter", {
        method: "POST",
        body: JSON.stringify({ rows: meterRows }),
      });
      setMessage({ type: "success", text: data.message || "Meter data submitted successfully" });
      setMeterRows([{ ...EMPTY_METER_ROW }]);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Submit failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuildingManualSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ message: string }>("/upload/building", {
        method: "POST",
        body: JSON.stringify({ rows: buildingRows }),
      });
      setMessage({ type: "success", text: data.message || "Building data submitted successfully" });
      setBuildingRows([{ ...EMPTY_BUILDING_ROW }]);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Submit failed" });
    } finally {
      setSubmitting(false);
    }
  };

  // Weather fetched data submit
  const handlePreviewSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ message: string }>(endpointForTab(activeTab), {
        method: "POST",
        body: JSON.stringify({ rows: previewRows }),
      });
      setMessage({ type: "success", text: data.message || "Data submitted successfully" });
      setPreviewRows([]);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Submit failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const methodOptions =
    activeTab === "weather"
      ? [
          { value: "csv", label: "CSV Upload" },
          { value: "manual", label: "Manual Entry" },
          { value: "api", label: "Fetch from API" },
        ]
      : [
          { value: "csv", label: "CSV Upload" },
          { value: "manual", label: "Manual Entry" },
        ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Upload Data" />

      <div className="pb-20">
          <h1 className="text-xl px-6">Add new meter, weather, or building data via CSV upload, manual entry, or weather API fetch (Open-Meteo).</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Status message */}
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="meter">Meter Data</TabsTrigger>
            <TabsTrigger value="weather">Weather Data</TabsTrigger>
            <TabsTrigger value="building">Building Data</TabsTrigger>
          </TabsList>

          {/* Upload method toggle */}
          <div className="mt-4">
            <ToggleGroup
              type="single"
              value={uploadMethod}
              onValueChange={handleMethodChange}
              // variant="outline"
            >
              {methodOptions.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Meter Data Tab */}
          <TabsContent value="meter" className="mt-4 space-y-6">
            {uploadMethod === "csv" && (
              <CsvDropZone
                file={file}
                onFileSelected={setFile}
                onClear={() => setFile(null)}
                onSubmit={handleCsvSubmit}
                uploading={uploading}
              />
            )}
            {uploadMethod === "manual" && (
              <MeterManualEntry
                rows={meterRows}
                setRows={setMeterRows}
                onSubmit={handleMeterManualSubmit}
                submitting={submitting}
              />
            )}
          </TabsContent>

          {/* Weather Data Tab */}
          <TabsContent value="weather" className="mt-4 space-y-6">
            {uploadMethod === "csv" && (
              <CsvDropZone
                file={file}
                onFileSelected={setFile}
                onClear={() => setFile(null)}
                onSubmit={handleCsvSubmit}
                uploading={uploading}
              />
            )}
            {uploadMethod === "manual" && (
              <p className="text-sm text-muted-foreground">
                Manual weather entry is not supported. Please use CSV upload or Fetch from API.
              </p>
            )}
            {uploadMethod === "api" && (
              <WeatherApiFetcher
                onFetched={setPreviewRows}
                fetching={fetching}
                setFetching={setFetching}
              />
            )}
            {uploadMethod === "api" && previewRows.length > 0 && (
              <DataPreview
                tab={activeTab}
                rows={previewRows}
                onCancel={() => setPreviewRows([])}
                onSubmit={handlePreviewSubmit}
                submitting={submitting}
              />
            )}
          </TabsContent>

          {/* Building Data Tab */}
          <TabsContent value="building" className="mt-4 space-y-6">
            {uploadMethod === "csv" && (
              <CsvDropZone
                file={file}
                onFileSelected={setFile}
                onClear={() => setFile(null)}
                onSubmit={handleCsvSubmit}
                uploading={uploading}
              />
            )}
            {uploadMethod === "manual" && (
              <BuildingManualEntry
                rows={buildingRows}
                setRows={setBuildingRows}
                onSubmit={handleBuildingManualSubmit}
                submitting={submitting}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
