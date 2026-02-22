# Directory Structure Specification

> Date: 2026-02-21

This document defines the directory structure for the Energy Efficiency Monitoring Application. The project consists of two containers: a FastAPI backend and a React frontend.

---

## Root Structure

```
/
├── frontend/           # React + Vite + TypeScript application
├── backend/            # FastAPI Python application
├── data/               # Source CSV data files (not committed to git)
├── model/              # Trained ML model artifacts
├── spec/               # Design documents (this directory)
├── docker-compose.yml  # Multi-container orchestration
└── .env                # Shared environment variables (API keys etc.)
```

---

## Frontend (`frontend/`)

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── map/               # mapcn map components (added via npx shadcn)
│   │   │       ├── map.tsx
│   │   │       ├── map-marker.tsx
│   │   │       ├── map-popup.tsx
│   │   │       ├── map-controls.tsx
│   │   │       └── index.ts
│   │   ├── layout/
│   │   │   ├── sidebar.tsx        # Persistent left sidebar with navigation
│   │   │   ├── page-header.tsx    # Page title bar with optional controls
│   │   │   └── app-layout.tsx     # Root layout composing sidebar + content area
│   │   ├── map/
│   │   │   ├── campus-map.tsx     # Main map component with building markers
│   │   │   ├── building-marker.tsx # Individual building marker with status color
│   │   │   ├── marker-popup.tsx   # Popup shown on marker click
│   │   │   ├── map-legend.tsx     # Color legend for anomaly status
│   │   │   └── utility-selector.tsx # Utility type dropdown
│   │   ├── building/
│   │   │   ├── building-info-card.tsx      # Building metadata card
│   │   │   ├── anomaly-summary-card.tsx    # Overall anomaly score display
│   │   │   ├── utility-cards.tsx           # Horizontal scroll row of per-utility cards
│   │   │   ├── time-series-chart.tsx       # Recharts line chart (actual/predicted/residual)
│   │   │   └── anomaly-detail-table.tsx    # Table of highest anomaly time periods
│   │   ├── upload/
│   │   │   ├── data-type-tabs.tsx          # Tab selector for meter/weather/building
│   │   │   ├── upload-method-toggle.tsx    # Toggle between CSV/manual/API fetch
│   │   │   ├── csv-upload-zone.tsx         # Drag-and-drop CSV file upload
│   │   │   ├── manual-entry-form.tsx       # Single-row data entry form
│   │   │   ├── weather-api-fetcher.tsx     # Open-Meteo API fetch interface
│   │   │   └── data-preview.tsx            # Preview table with validation summary
│   │   ├── chat/
│   │   │   ├── chat-container.tsx          # Full-page chat layout
│   │   │   ├── empty-state.tsx             # Welcome screen with suggestion chips
│   │   │   ├── message-bubble.tsx          # Single message renderer (user/assistant)
│   │   │   ├── tool-invocation-block.tsx   # Python execution / ML prediction display
│   │   │   ├── chat-input.tsx              # Auto-resizing textarea with send/stop buttons
│   │   │   └── streaming-indicator.tsx     # Typing/executing animation
│   │   └── shared/
│   │       ├── status-badge.tsx            # Colored status dot with label
│   │       ├── score-display.tsx           # Anomaly score with color coding
│   │       └── utility-icon.tsx            # Maps utility type to lucide-react icon
│   ├── pages/
│   │   ├── map-overview.tsx       # Page 1: Map overview (landing)
│   │   ├── building-detail.tsx    # Page 2: Building detail dashboard
│   │   ├── upload-data.tsx        # Page 3: Data upload
│   │   └── chatbot.tsx            # Page 4: Chatbot
│   ├── hooks/
│   │   ├── use-buildings.ts       # Fetch and cache building list with scores
│   │   ├── use-building-detail.ts # Fetch single building detail data
│   │   ├── use-time-series.ts     # Fetch time series data for a building+utility
│   │   └── use-upload.ts          # Upload form state and submission logic
│   ├── lib/
│   │   ├── api.ts                 # API client (fetch wrapper with base URL)
│   │   ├── constants.ts           # Utility types, score thresholds, map center
│   │   ├── utils.ts               # Formatting helpers (numbers, dates)
│   │   └── cn.ts                  # Tailwind class merge utility (shadcn standard)
│   ├── types/
│   │   ├── building.ts            # Building, BuildingMapData, BuildingDetail
│   │   ├── meter.ts               # MeterReading, TimeSeriesDataPoint
│   │   ├── weather.ts             # WeatherData
│   │   ├── chat.ts                # Message, ToolInvocation types
│   │   └── utility.ts             # UtilityType enum, utility metadata
│   ├── App.tsx                    # Router setup
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind directives + custom CSS variables
├── components.json                # shadcn/ui configuration
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── package.json
└── Dockerfile
```

---

## Backend (`backend/`)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory, middleware, lifespan
│   ├── config.py                  # Settings via pydantic-settings (env vars)
│   ├── dependencies.py            # Shared FastAPI dependencies (data service DI)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── buildings.py           # GET /api/buildings, GET /api/buildings/{id}, GET /api/buildings/{id}/timeseries
│   │   ├── upload.py              # POST /api/upload/meter, /weather, /building
│   │   ├── chat.py                # POST /api/chat (SSE streaming)
│   │   ├── weather.py             # GET /api/weather/fetch
│   │   └── predict.py             # POST /api/predict
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_service.py        # CSV loading, caching, querying, aggregation
│   │   ├── scoring_service.py     # Anomaly score calculation from model residuals
│   │   ├── prediction_service.py  # XGBoost model loading and inference
│   │   ├── chat_service.py        # LLM API calls, tool orchestration, SSE stream building
│   │   ├── upload_service.py      # CSV parsing, validation, data ingestion
│   │   ├── weather_service.py     # Open-Meteo API client
│   │   └── code_execution_service.py  # Python code execution sandbox
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── building.py            # BuildingSummary, BuildingDetail, BuildingMapData
│   │   ├── meter.py               # MeterReading, TimeSeriesPoint, TimeSeriesResponse
│   │   ├── weather.py             # WeatherData, WeatherFetchRequest
│   │   ├── upload.py              # UploadResponse, ValidationResult
│   │   ├── chat.py                # ChatRequest, ChatMessage
│   │   └── predict.py             # PredictRequest, PredictResponse
│   └── utils/
│       ├── __init__.py
│       ├── feature_engineering.py  # Feature computation pipeline matching model training
│       └── stream_builder.py       # SSE stream builder for Vercel AI SDK protocol
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # Fixtures: test client, sample data
│   ├── test_buildings.py          # Building endpoint tests
│   ├── test_upload.py             # Upload endpoint tests
│   ├── test_chat.py               # Chat endpoint tests
│   ├── test_weather.py            # Weather endpoint tests
│   ├── test_predict.py            # Prediction endpoint tests
│   ├── test_data_service.py       # Data service unit tests
│   ├── test_scoring_service.py    # Scoring service unit tests
│   └── test_prediction_service.py # Prediction service unit tests
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

---

## Data (`data/`)

Source data files. Not committed to git; mounted as Docker volume.

```
data/
├── meter-data-sept-2025.csv       # 735,840 rows, 15-min interval meter readings
├── meter-data-oct-2025.csv        # 760,368 rows, 15-min interval meter readings
├── building_metadata.csv          # 1,287 buildings metadata
└── weather-sept-oct-2025.csv      # 1,464 hourly weather observations
```

---

## Model (`model/`)

Trained ML model artifacts. Not committed to git; mounted as Docker volume.

```
model/
└── model_best.json                # XGBoost model in native JSON format
```

---

## Docker Compose

`docker-compose.yml` defines two services:

| Service | Build Context | Ports | Volumes |
|---|---|---|---|
| `backend` | `./backend` | `8000:8000` | `./data:/app/data:ro`, `./model:/app/model:ro` |
| `frontend` | `./frontend` | `3000:3000` | none (built static assets) |

The backend mounts `data/` and `model/` as read-only volumes. The frontend is served via Vite dev server (development) or nginx (production).

---

## Key Conventions

- **Backend**: Python files use `snake_case`. Routers map to URL path segments. Services are injected via FastAPI's `Depends()`.
- **Frontend**: TypeScript/React files use `kebab-case` for filenames, `PascalCase` for components. Each component directory groups related components by feature domain.
- **Types/Schemas**: Frontend types in `src/types/` mirror backend Pydantic schemas in `app/schemas/` to ensure API contract consistency.
- **shadcn/ui**: Components are installed via `npx shadcn@latest add <component>` and placed in `src/components/ui/`. They are customizable source files, not locked dependencies.
- **mapcn**: Map components are installed via `npx shadcn@latest add @mapcn/map` and placed in `src/components/ui/map/`.
