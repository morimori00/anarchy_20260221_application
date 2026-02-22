export function MapLegend() {
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
