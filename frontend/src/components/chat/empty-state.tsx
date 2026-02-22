import { Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Show the top 10 buildings by total electricity consumption in September 2025. Creat a bar chart to visualize the results. Use log scale for the electricity consumption values.",
  "Run anomaly detection on Building 311 for electricity",
  "Predict Building 0161's electricity usage if temperature were 90°F",
];

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="rounded-full bg-primary/10 p-4 mb-6">
        <Sparkles className="size-8 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Energy Analysis Assistant</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Ask questions about building energy data, run analyses, or predict
        consumption patterns.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestionClick(text)}
            className="text-left rounded-xl border px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
