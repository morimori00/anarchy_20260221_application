import { Loader2 } from "lucide-react";

interface StreamingIndicatorProps {
  toolName?: string;
}

export function StreamingIndicator({ toolName }: StreamingIndicatorProps) {
  const label = toolName === "execute_python"
    ? "Running Python code..."
    : toolName === "run_prediction"
      ? "Running prediction model..."
      : "Thinking...";

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {toolName ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </div>
      )}
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
