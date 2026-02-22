import { getStatusColor, getStatusFromScore } from "@/lib/constants";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "lg";
}

export function ScoreDisplay({ score, size = "sm" }: ScoreDisplayProps) {
  const status = getStatusFromScore(score);
  const color = getStatusColor(status);
  const textClass = size === "sm" ? "text-sm font-medium" : "text-4xl font-bold";

  return <span className={`${textClass} ${color}`}>{score.toFixed(2)}</span>;
}
