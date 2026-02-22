export function MapLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[500px] gap-4">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        className="text-muted-foreground"
      >
        {/* Grid lines - horizontal */}
        <line
          x1="10" y1="30" x2="110" y2="30"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "0ms" }}
        />
        <line
          x1="10" y1="55" x2="110" y2="55"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "200ms" }}
        />
        <line
          x1="10" y1="80" x2="110" y2="80"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "400ms" }}
        />

        {/* Grid lines - vertical */}
        <line
          x1="30" y1="10" x2="30" y2="110"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "100ms" }}
        />
        <line
          x1="60" y1="10" x2="60" y2="110"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "300ms" }}
        />
        <line
          x1="90" y1="10" x2="90" y2="110"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          className="map-grid-line"
          style={{ animationDelay: "500ms" }}
        />

        {/* Abstract road paths */}
        <path
          d="M15 95 Q40 70 60 72 T105 40"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="map-road"
        />
        <path
          d="M20 20 Q45 50 70 45 T100 90"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className="map-road"
          style={{ animationDelay: "600ms" }}
        />

        {/* Abstract area blocks */}
        <rect
          x="18" y="35" width="20" height="14" rx="2"
          fill="currentColor" fillOpacity="0.08"
          className="map-block"
          style={{ animationDelay: "300ms" }}
        />
        <rect
          x="70" y="58" width="25" height="16" rx="2"
          fill="currentColor" fillOpacity="0.08"
          className="map-block"
          style={{ animationDelay: "600ms" }}
        />
        <rect
          x="42" y="82" width="18" height="12" rx="2"
          fill="currentColor" fillOpacity="0.08"
          className="map-block"
          style={{ animationDelay: "900ms" }}
        />

        {/* Location pin */}
        <g className="map-pin" transform="translate(60, 52)">
          {/* Pin shadow */}
          <ellipse
            cx="0" cy="18" rx="6" ry="2"
            fill="currentColor" fillOpacity="0.15"
            className="map-pin-shadow"
          />
          {/* Pin body */}
          <path
            d="M0 -12 C-7 -12 -12 -7 -12 -2 C-12 5 0 16 0 16 C0 16 12 5 12 -2 C12 -7 7 -12 0 -12Z"
            fill="currentColor"
            fillOpacity="0.5"
          />
          {/* Pin dot */}
          <circle cx="0" cy="-2" r="4" fill="currentColor" fillOpacity="0.2" />
        </g>
      </svg>
      <span className="text-sm text-muted-foreground animate-pulse">
        Loading map...
      </span>
    </div>
  );
}

export function BuildingLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[500px] gap-4">
      <svg
        width="100"
        height="120"
        viewBox="0 0 100 120"
        fill="none"
        className="text-muted-foreground"
      >
        {/* Ground line */}
        <line
          x1="5" y1="110" x2="95" y2="110"
          stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"
        />

        {/* Main building body */}
        <rect
          x="25" y="20" width="50" height="90" rx="2"
          stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5"
          fill="currentColor" fillOpacity="0.04"
          className="building-body"
        />

        {/* Roof accent */}
        <rect
          x="25" y="20" width="50" height="4"
          fill="currentColor" fillOpacity="0.2"
          className="building-body"
        />

        {/* Windows - Row 1 (top) */}
        <rect x="32" y="30" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "0ms" }} />
        <rect x="46" y="30" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "100ms" }} />
        <rect x="60" y="30" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "200ms" }} />

        {/* Windows - Row 2 */}
        <rect x="32" y="42" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "150ms" }} />
        <rect x="46" y="42" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "250ms" }} />
        <rect x="60" y="42" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "350ms" }} />

        {/* Windows - Row 3 */}
        <rect x="32" y="54" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "300ms" }} />
        <rect x="46" y="54" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "400ms" }} />
        <rect x="60" y="54" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "500ms" }} />

        {/* Windows - Row 4 */}
        <rect x="32" y="66" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "450ms" }} />
        <rect x="46" y="66" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "550ms" }} />
        <rect x="60" y="66" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "650ms" }} />

        {/* Windows - Row 5 */}
        <rect x="32" y="78" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "600ms" }} />
        <rect x="46" y="78" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "700ms" }} />
        <rect x="60" y="78" width="8" height="6" rx="1"
          fill="currentColor" className="building-window" style={{ animationDelay: "800ms" }} />

        {/* Door */}
        <rect
          x="43" y="94" width="14" height="16" rx="2"
          stroke="currentColor" strokeOpacity="0.3" strokeWidth="1"
          fill="currentColor" fillOpacity="0.06"
        />

        {/* Small side building */}
        <rect
          x="75" y="70" width="18" height="40" rx="1"
          stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
          fill="currentColor" fillOpacity="0.03"
          className="building-side"
        />
        <rect x="79" y="76" width="5" height="4" rx="0.5"
          fill="currentColor" className="building-window" style={{ animationDelay: "500ms" }} />
        <rect x="79" y="86" width="5" height="4" rx="0.5"
          fill="currentColor" className="building-window" style={{ animationDelay: "700ms" }} />
        <rect x="79" y="96" width="5" height="4" rx="0.5"
          fill="currentColor" className="building-window" style={{ animationDelay: "900ms" }} />
      </svg>
      <span className="text-sm text-muted-foreground animate-pulse">
        Loading building data...
      </span>
    </div>
  );
}
