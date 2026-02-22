import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tool,
  ToolHeader,
  ToolContent,
} from "@/components/ai-elements/tool";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
  CodeBlockContainer,
} from "@/components/ai-elements/code-block";
import { Terminal } from "@/components/ai-elements/terminal";

interface ToolInvocationBlockProps {
  toolName: string;
  state: "running" | "complete" | "error";
  args: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

/** Map our state to AI Elements ToolHeader state */
function mapState(state: ToolInvocationBlockProps["state"]) {
  switch (state) {
    case "running":
      return "input-available" as const;
    case "complete":
      return "output-available" as const;
    case "error":
      return "output-error" as const;
  }
}

// ---------------------------------------------------------------------------
// Python execution block
// ---------------------------------------------------------------------------

function PythonExecutionBlock({
  state,
  args,
  output,
  error: errorText,
}: Omit<ToolInvocationBlockProps, "toolName">) {
  const code = (args as { code?: string })?.code ?? "";
  const result = output as {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    images?: string[];
  } | undefined;

  const stdout = result?.stdout ?? "";
  const stderr = result?.stderr ?? "";
  const exitCode = result?.exitCode ?? 0;
  const images = result?.images ?? [];
  const hasError = exitCode !== 0 || !!stderr || !!errorText;
  const hasOutput = !!stdout || !!stderr || images.length > 0 || !!errorText;
  const isRunning = state === "running";

  return (
    <Tool defaultOpen>
      <ToolHeader
        title="Python"
        type="dynamic-tool"
        state={mapState(state)}
        toolName="execute_python"
      />
      <ToolContent>
        {/* Code */}
        {code && (
          <CodeBlock code={code} language="python">
            <CodeBlockHeader>
              <CodeBlockTitle>
                <CodeBlockFilename>script.py</CodeBlockFilename>
              </CodeBlockTitle>
              <CodeBlockActions>
                <CodeBlockCopyButton />
              </CodeBlockActions>
            </CodeBlockHeader>
            <CodeBlockContent code={code} language="python" />
          </CodeBlock>
        )}

        {/* Output */}
        {!isRunning && hasOutput && (
          <>
            {(stdout || (hasError && (stderr || errorText))) && (
              <Terminal
                output={hasError ? (stderr || errorText || "") : stdout}
                isStreaming={false}
              />
            )}

            {images.map((src, i) => (
              <div key={i} className="bg-white p-2 rounded-md">
                <img
                  src={src}
                  alt={`Chart ${i + 1}`}
                  className="max-w-full rounded"
                />
              </div>
            ))}
          </>
        )}
      </ToolContent>
    </Tool>
  );
}

// ---------------------------------------------------------------------------
// ML Prediction block
// ---------------------------------------------------------------------------

function PredictionBlock({
  state,
  args,
  output,
  error: errorText,
}: Omit<ToolInvocationBlockProps, "toolName">) {
  const inputArgs = args as {
    buildingNumber?: number;
    utility?: string;
  } | undefined;

  const result = output as {
    buildingNumber?: number;
    utility?: string;
    anomalyScore?: number;
    metrics?: { rmse?: number; mae?: number; meanResidual?: number };
    predictions?: Array<Record<string, unknown>>;
    summary?: string;
    error?: string;
  } | undefined;

  const toolError = result?.error || errorText;

  const anomalyScore = result?.anomalyScore;
  const metrics = result?.metrics;
  const predictions = result?.predictions;
  const buildingNumber = result?.buildingNumber ?? inputArgs?.buildingNumber;
  const utility = result?.utility ?? inputArgs?.utility ?? "ELECTRICITY";

  const getStatusColor = (score: number) => {
    if (score < 0.001) return "text-emerald-600 dark:text-emerald-400";
    if (score < 0.005) return "text-yellow-600 dark:text-yellow-400";
    if (score < 0.01) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Tool defaultOpen>
      <ToolHeader
        title="ML Prediction"
        type="dynamic-tool"
        state={mapState(state)}
        toolName="run_prediction"
      />
      <ToolContent>
        {toolError ? (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                <BarChart3 className="size-4" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600">{toolError}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Building:</span>{" "}
                <span className="font-medium">
                  {String(buildingNumber ?? "")}
                </span>
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
                  <span className="font-medium">
                    {metrics.rmse.toFixed(6)}
                  </span>
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
          </div>
        )}
      </ToolContent>
    </Tool>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ToolInvocationBlock({
  toolName,
  state,
  args,
  output,
  error: errorText,
}: ToolInvocationBlockProps) {
  if (toolName === "execute_python") {
    return (
      <PythonExecutionBlock
        state={state}
        args={args}
        output={output}
        error={errorText}
      />
    );
  }

  if (toolName === "run_prediction") {
    return (
      <PredictionBlock
        state={state}
        args={args}
        output={output}
        error={errorText}
      />
    );
  }

  // Generic fallback
  return (
    <Tool defaultOpen>
      <ToolHeader
        title={toolName}
        type="dynamic-tool"
        state={mapState(state)}
        toolName={toolName}
      />
      <ToolContent>
        {state !== "running" && output && (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(output, null, 2)}
          </pre>
        )}
      </ToolContent>
    </Tool>
  );
}
