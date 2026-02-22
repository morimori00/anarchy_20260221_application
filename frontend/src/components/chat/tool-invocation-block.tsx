import { useState } from "react";
import { Copy, Check, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ToolInvocationBlockProps {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

const isLoading = (state: string) =>
  state === "input-streaming" || state === "input-available";

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
    >
      {copied ? (
        <Check className="size-3 mr-1" />
      ) : (
        <Copy className="size-3 mr-1" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Python execution block
// ---------------------------------------------------------------------------

function PythonExecutionBlock({
  state,
  input,
  output,
  errorText,
}: Omit<ToolInvocationBlockProps, "toolName">) {
  const code = (input as { code?: string })?.code ?? "";
  const result = output as {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    images?: string[];
  } | undefined;
  const loading = isLoading(state);

  const stdout = result?.stdout ?? "";
  const stderr = result?.stderr ?? "";
  const exitCode = result?.exitCode ?? 0;
  const images = result?.images ?? [];
  const hasError = exitCode !== 0 || !!stderr || !!errorText;
  const hasOutput = !!stdout || !!stderr || images.length > 0 || !!errorText;

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 rounded-t-lg">
        <span className="text-xs font-medium text-zinc-300">Python</span>
        {code && <CopyButton text={code} />}
      </div>

      {/* Code */}
      {code && (
        <pre className="bg-zinc-950 text-zinc-50 font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
          {code}
        </pre>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 bg-muted px-4 py-3 border-t border-zinc-700">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Running...</span>
        </div>
      )}

      {/* Output */}
      {!loading && hasOutput && (
        <div className="border-t border-zinc-700">
          {stdout && (
            <pre className="bg-muted font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
              {stdout}
            </pre>
          )}

          {hasError && (stderr || errorText) && (
            <pre className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
              {stderr || errorText}
            </pre>
          )}

          {images.map((src, i) => (
            <div key={i} className="bg-white p-2">
              <img
                src={src}
                alt={`Chart ${i + 1}`}
                className="max-w-full rounded"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ML Prediction block
// ---------------------------------------------------------------------------

function PredictionBlock({
  state,
  input,
  output,
  errorText,
}: Omit<ToolInvocationBlockProps, "toolName">) {
  const loading = isLoading(state);
  const args = input as {
    buildingNumber?: number;
    utility?: string;
  } | undefined;

  if (loading) {
    return (
      <Card className="my-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="size-4" />
            ML Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Running prediction model...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const result = output as {
    buildingNumber?: number;
    utility?: string;
    anomalyScore?: number;
    metrics?: { rmse?: number; mae?: number; meanResidual?: number };
    predictions?: Array<Record<string, unknown>>;
    summary?: string;
    error?: string;
  } | undefined;

  const error = result?.error || errorText;
  if (error) {
    return (
      <Card className="my-3 border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-600">
            <BarChart3 className="size-4" />
            ML Prediction - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const anomalyScore = result?.anomalyScore;
  const metrics = result?.metrics;
  const predictions = result?.predictions;
  const buildingNumber = result?.buildingNumber ?? args?.buildingNumber;
  const utility = result?.utility ?? args?.utility ?? "ELECTRICITY";

  const getStatusColor = (score: number) => {
    if (score < 0.001) return "text-emerald-600 dark:text-emerald-400";
    if (score < 0.005) return "text-yellow-600 dark:text-yellow-400";
    if (score < 0.01) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="my-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="size-4" />
          ML Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Building:</span>{" "}
            <span className="font-medium">{String(buildingNumber ?? "")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Utility:</span>{" "}
            <span className="font-medium">{utility}</span>
          </div>
          {anomalyScore !== undefined && (
            <div>
              <span className="text-muted-foreground">Anomaly Score:</span>{" "}
              <span
                className={`font-medium ${getStatusColor(anomalyScore)}`}
              >
                {anomalyScore.toFixed(6)}
              </span>
            </div>
          )}
          {metrics?.rmse !== undefined && (
            <div>
              <span className="text-muted-foreground">RMSE:</span>{" "}
              <span className="font-medium">{metrics.rmse.toFixed(6)}</span>
            </div>
          )}
        </div>

        {result?.summary && (
          <p className="text-xs text-muted-foreground">{result.summary}</p>
        )}

        {predictions && predictions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-3 text-muted-foreground font-medium">
                    Time
                  </th>
                  <th className="text-right py-1 px-3 text-muted-foreground font-medium">
                    Actual
                  </th>
                  <th className="text-right py-1 px-3 text-muted-foreground font-medium">
                    Predicted
                  </th>
                  <th className="text-right py-1 pl-3 text-muted-foreground font-medium">
                    Residual
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-1 pr-3 font-mono">
                      {String(row.readingtime ?? "").slice(0, 16)}
                    </td>
                    <td className="text-right py-1 px-3 font-mono">
                      {Number(row.energy_per_sqft ?? 0).toFixed(6)}
                    </td>
                    <td className="text-right py-1 px-3 font-mono">
                      {Number(row.predicted ?? 0).toFixed(6)}
                    </td>
                    <td className="text-right py-1 pl-3 font-mono">
                      {Number(row.residual ?? 0).toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ToolInvocationBlock({
  toolName,
  state,
  input,
  output,
  errorText,
}: ToolInvocationBlockProps) {
  if (toolName === "execute_python") {
    return (
      <PythonExecutionBlock
        state={state}
        input={input}
        output={output}
        errorText={errorText}
      />
    );
  }

  if (toolName === "run_prediction") {
    return (
      <PredictionBlock
        state={state}
        input={input}
        output={output}
        errorText={errorText}
      />
    );
  }

  // Generic fallback
  const loading = isLoading(state);

  return (
    <Card className="my-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{toolName ?? "Tool"}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Processing...</span>
          </div>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(output, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
