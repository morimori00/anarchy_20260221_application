import { useState } from "react";
import { Copy, Check, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: Record<string, unknown>;
}

interface ToolInvocationBlockProps {
  invocation: ToolInvocation;
}

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

function PythonExecutionBlock({ invocation }: ToolInvocationBlockProps) {
  const code = (invocation.args?.code as string) ?? "";
  const result = invocation.result;
  const isLoading =
    invocation.state !== "result" && invocation.state !== "output-available";

  const stdout = (result?.stdout as string) ?? "";
  const stderr = (result?.stderr as string) ?? "";
  const exitCode = (result?.exitCode as number) ?? 0;
  const images = (result?.images as string[]) ?? [];
  const hasError = exitCode !== 0 || !!stderr;
  const hasOutput = !!stdout || !!stderr || images.length > 0;

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 rounded-t-lg">
        <span className="text-xs font-medium text-zinc-300">Python</span>
        <CopyButton text={code} />
      </div>

      {/* Code */}
      <pre className="bg-zinc-950 text-zinc-50 font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 bg-muted px-4 py-3 border-t border-zinc-700">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Running...</span>
        </div>
      )}

      {/* Output */}
      {!isLoading && hasOutput && (
        <div className="border-t border-zinc-700">
          {stdout && (
            <pre className="bg-muted font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
              {stdout}
            </pre>
          )}

          {hasError && stderr && (
            <pre className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-mono text-sm p-4 overflow-x-auto whitespace-pre-wrap">
              {stderr}
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

function PredictionBlock({ invocation }: ToolInvocationBlockProps) {
  const result = invocation.result;
  const isLoading =
    invocation.state !== "result" && invocation.state !== "output-available";
  const args = invocation.args;

  if (isLoading) {
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

  const error = result?.error as string | undefined;
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

  const anomalyScore = result?.anomalyScore as number | undefined;
  const metrics = result?.metrics as Record<string, number> | undefined;
  const predictions = result?.predictions as Record<string, unknown>[] | undefined;

  const getStatusColor = (score: number) => {
    if (score < 0.001) return "text-green-600 dark:text-green-400";
    if (score < 0.005) return "text-yellow-600 dark:text-yellow-400";
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
            <span className="font-medium">
              {String(args?.buildingNumber ?? "")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Utility:</span>{" "}
            <span className="font-medium">
              {(args?.utility as string) ?? "ELECTRICITY"}
            </span>
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

export function ToolInvocationBlock({ invocation }: ToolInvocationBlockProps) {
  if (invocation.toolName === "execute_python") {
    return <PythonExecutionBlock invocation={invocation} />;
  }

  if (invocation.toolName === "run_prediction") {
    return <PredictionBlock invocation={invocation} />;
  }

  // Generic fallback
  const isLoading =
    invocation.state !== "result" && invocation.state !== "output-available";

  return (
    <Card className="my-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{invocation.toolName ?? "Tool"}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Processing...</span>
          </div>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(invocation.result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
