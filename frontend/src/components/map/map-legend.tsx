interface MapLegendProps {
  isInvestmentView?: boolean;
}

export function MapLegend({ isInvestmentView = false }: MapLegendProps) {
  if (isInvestmentView) {
    return (
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-emerald-500" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-yellow-400" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-orange-400" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-red-500" />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-2 ml-4 border-l pl-4">
          <span className="size-3 rounded-full border border-muted-foreground" />
          <span className="size-4 rounded-full border border-muted-foreground" />
          <span className="size-5 rounded-full border border-muted-foreground" />
          <span>Marker size = building area</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-emerald-500" />
        <span>Normal</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-yellow-400" />
        <span>Caution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-orange-400" />
        <span>Warning</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-red-500" />
        <span>Anomaly</span>
      </div>
    </div>
  );
}
