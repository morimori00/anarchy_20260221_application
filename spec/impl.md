# Implementation Plan

> Date: 2026-02-21

Each phase is designed to produce a working, testable increment. Phases are sequential — later phases depend on earlier ones. Within each phase, tasks can be parallelized where marked.

---

## Phase 1: Project Scaffolding

Set up the project structure, toolchain, and container configuration so both frontend and backend can start independently.

### Tasks

1. Create `frontend/` with Vite + React + TypeScript (`npm create vite@latest`).
2. Install and configure Tailwind CSS, shadcn/ui (`npx shadcn@latest init`).
3. Install mapcn map components (`npx shadcn@latest add @mapcn/map`).
4. Install frontend dependencies: `react-router-dom`, `recharts`, `react-markdown`, `remark-gfm`, `@ai-sdk/react`, `lucide-react`.
5. Create `backend/` with FastAPI project structure (`app/main.py`, `app/config.py`, routers/, services/, schemas/).
6. Create `requirements.txt` with: `fastapi`, `uvicorn`, `pandas`, `numpy`, `xgboost`, `openai`, `httpx`, `python-multipart`.
7. Create `docker-compose.yml` with backend (port 8000) and frontend (port 3000) services. Mount `data/` and `model/` as volumes on backend.
8. Create `.env` with `OPENAI_API_KEY` placeholder.
9. Verify both containers start: backend serves `GET /` health check, frontend shows Vite default page.

### References

- `spec/directry.spec.md` — full directory tree for both containers
- `spec/overview.md` — stack decisions (FastAPI, React+Vite+TS+Tailwind+shadcn)

### Deliverable

Both containers running. Frontend accessible at localhost:3000, backend at localhost:8000.

---

## Phase 2: Backend Data Layer

Load all CSV data at startup, expose it via a Data Service, and wire up FastAPI dependency injection.

### Tasks

1. Implement `app/services/data_service.py` — load meter CSVs, building metadata, weather data into pandas DataFrames at startup.
2. Implement `app/dependencies.py` — create a singleton DataService instance via FastAPI's lifespan event and `Depends()`.
3. Implement `app/config.py` — settings via pydantic-settings (data directory path, model path).
4. Implement Pydantic schemas for building and meter data (`app/schemas/building.py`, `app/schemas/meter.py`).
5. Write unit tests: `tests/test_data_service.py` — verify loading, filtering, querying.

### References

- `spec/backend_services/data_service.md` — lifecycle, internal state, all public methods
- `spec/data-dictionary.md` — CSV schemas, column types, joins
- `spec/questions.md` Q4 — in-memory only, no persistence

### Deliverable

DataService loads ~1.5M meter rows + metadata at startup. Queryable by building, utility, time range.

---

## Phase 3: Backend Prediction & Scoring

Load the XGBoost model, run feature engineering, compute predictions, then compute anomaly scores for all buildings.

### Tasks

1. Implement `app/utils/feature_engineering.py` — the 25-feature pipeline (weather join, temporal features, lag, rolling, interaction).
2. Implement `app/services/prediction_service.py` — model loading, `predict_all()`, `predict_building()`.
3. Implement `app/services/scoring_service.py` — three scoring methods (percentile_rank, absolute_threshold, size_normalized), status classification, caching.
4. Wire up startup: DataService → PredictionService → ScoringService initialization in lifespan.
5. Write unit tests: `tests/test_prediction_service.py`, `tests/test_scoring_service.py`.

### References

- `spec/model-reference.md` — model input (25 features), output (predicted only), feature column order, hyperparameters
- `spec/backend_services/prediction_service.md` — feature engineering steps, model discovery, weather overrides
- `spec/backend_services/scoring_service.md` — three scoring methods, status thresholds, BuildingScore structure
- `spec/questions.md` Q1 — scoring methods are UI-selectable, default size_normalized

### Deliverable

At startup, all ELECTRICITY buildings have precomputed anomaly scores. `ScoringService.get_building_scores("ELECTRICITY", "size_normalized")` returns ranked list.

---

## Phase 4: Backend Buildings API

Expose building data and scores via REST endpoints.

### Tasks

1. Implement `app/routers/buildings.py`:
   - `GET /api/buildings` — returns all buildings with scores for selected utility and scoring method.
   - `GET /api/buildings/{buildingNumber}` — returns building detail with per-utility breakdown.
   - `GET /api/buildings/{buildingNumber}/timeseries` — returns time series data (actual, predicted, residual) with resolution aggregation.
2. Implement Pydantic response schemas (`app/schemas/building.py` — BuildingSummary, BuildingDetail, TimeSeriesResponse).
3. Write endpoint tests: `tests/test_buildings.py`.

### References

- `spec/api.spec.md` — sections 1 (Buildings): URL paths, query parameters, response JSON shapes
- `spec/backend_services/data_service.md` — `get_aggregated_meter_data()` for resolution support

### Deliverable

All three buildings endpoints return correct JSON. Testable via `curl` or Swagger UI at `/docs`.

---

## Phase 5: Frontend Layout & Routing

Build the app shell: sidebar navigation, page header, routing, and theme toggle.

### Tasks

1. Set up React Router in `App.tsx` with routes: `/`, `/buildings/:buildingNumber`, `/upload`, `/chat`.
2. Implement `components/layout/app-layout.tsx` — sidebar + content area wrapper.
3. Implement `components/layout/sidebar.tsx` — navigation links, active state, collapse behavior, theme toggle.
4. Implement `components/layout/page-header.tsx` — title + optional right-side controls slot.
5. Implement shared components: `components/shared/status-badge.tsx`, `score-display.tsx`, `utility-icon.tsx`.
6. Set up `lib/api.ts` — fetch wrapper with base URL pointing to backend.
7. Set up `lib/constants.ts` — utility types, score thresholds, map center coordinates.
8. Set up `types/` — TypeScript interfaces mirroring backend schemas.
9. Configure CSS variables for light/dark theme in `index.css`.

### References

- `spec/ui.spec.md` — Global Layout, Sidebar, Page Header, Shared Components, Theme, Routing
- `spec/ux.design.md` — responsive breakpoints, navigation design
- `spec/directry.spec.md` — frontend file placement

### Deliverable

Navigable app shell with sidebar, theme toggle, and four empty page stubs.

---

## Phase 6: Map Overview Page

Build the landing page with the interactive campus map and building markers.

### Tasks

1. Implement `hooks/use-buildings.ts` — fetch `GET /api/buildings` with utility and scoring params.
2. Implement `components/map/utility-selector.tsx` — dropdown for 8 utility types.
3. Implement scoring method selector in the page header (dropdown: Percentile Rank / Absolute Threshold / Size-Normalized).
4. Implement `components/map/campus-map.tsx` — mapcn Map centered on OSU, with MapControls.
5. Implement `components/map/building-marker.tsx` — MarkerContent (colored circle by status), MarkerTooltip (name + score), MarkerPopup (detail card + "View Details" link).
6. Implement `components/map/map-legend.tsx` — horizontal status legend below map.
7. Assemble in `pages/map-overview.tsx`.

### References

- `spec/ui.spec.md` — Page 1: Map Overview (utility selector, scoring selector, map, markers, tooltips, popups, legend)
- `spec/pre-research/mapcn.md` — Map/MapMarker/MarkerContent/MarkerPopup/MarkerTooltip API, campus map implementation examples
- `spec/ux.design.md` — Flow 1: Portfolio Screening, marker hover/click patterns, utility switch loading

### Deliverable

Interactive map with ~287 colored markers. Utility and scoring dropdowns update markers. Clicking a marker shows popup with "View Details" link.

---

## Phase 7: Building Detail Page

Build the single-building dashboard with metadata, anomaly scores, charts, and anomaly table.

### Tasks

1. Implement `hooks/use-building-detail.ts` — fetch `GET /api/buildings/{id}`.
2. Implement `hooks/use-time-series.ts` — fetch `GET /api/buildings/{id}/timeseries` with utility, resolution, date range.
3. Implement `components/building/building-info-card.tsx` — 2-column metadata grid.
4. Implement `components/building/anomaly-summary-card.tsx` — overall score, status, highest/lowest utility.
5. Implement `components/building/utility-cards.tsx` — horizontally scrollable cards per utility.
6. Implement `components/building/time-series-chart.tsx` — recharts line chart with actual/predicted/residual, utility tabs, date range presets.
7. Implement `components/building/anomaly-detail-table.tsx` — sortable table of highest-anomaly time periods.
8. Assemble in `pages/building-detail.tsx` with back button.

### References

- `spec/ui.spec.md` — Page 2: Building Detail (all component specs)
- `spec/api.spec.md` — `GET /api/buildings/{id}`, `GET /api/buildings/{id}/timeseries` response shapes
- `spec/ux.design.md` — Flow 2: Building Investigation, loading states (skeleton loaders)

### Deliverable

Full building dashboard. User can navigate from map → building detail → back to map.

---

## Phase 8: Upload Data

Build the data upload pipeline: backend validation + ingestion endpoints, frontend upload UI.

### Tasks (backend)

1. Implement `app/services/upload_service.py` — CSV parsing, row validation, ingestion.
2. Implement `app/services/weather_service.py` — Open-Meteo API proxy.
3. Implement `app/routers/upload.py` — `POST /api/upload/meter`, `/weather`, `/building`.
4. Implement `app/routers/weather.py` — `GET /api/weather/fetch`.
5. Write endpoint tests: `tests/test_upload.py`, `tests/test_weather.py`.

### Tasks (frontend — parallel with backend)

6. Implement `components/upload/data-type-tabs.tsx` — meter/weather/building tab selector.
7. Implement `components/upload/upload-method-toggle.tsx` — CSV / Manual / API toggle.
8. Implement `components/upload/csv-upload-zone.tsx` — drag-and-drop file upload.
9. Implement `components/upload/manual-entry-form.tsx` — per-data-type form fields.
10. Implement `components/upload/weather-api-fetcher.tsx` — date range + fetch button.
11. Implement `components/upload/data-preview.tsx` — preview table + validation summary + submit button.
12. Assemble in `pages/upload-data.tsx`.

### References

- `spec/api.spec.md` — sections 2 (Upload) and 3 (Weather): endpoints, request/response shapes
- `spec/backend_services/upload_service.md` — CSV parsing, validation rules, ingestion flow
- `spec/backend_services/weather_service.md` — Open-Meteo API parameters, response transformation
- `spec/ui.spec.md` — Page 3: Upload Data (all component specs)
- `spec/ux.design.md` — Flow 3: Data Upload, form validation, CSV upload states
- `spec/data-dictionary.md` — CSV schemas for validation

### Deliverable

User can upload CSVs, manually enter data, or fetch weather from API. Data is validated, previewed, and ingested into the in-memory data store.

---

## Phase 9: Chatbot

Build the AI chat interface: backend LLM orchestration with tools, SSE streaming, frontend chat UI.

### Tasks (backend)

1. Implement `app/services/code_execution_service.py` — Python exec with timeout, stdout/image capture.
2. Implement `app/services/chat_service.py` — OpenAI GPT-4o integration, tool definitions (execute_python, run_prediction), tool execution loop, SSE stream builder.
3. Implement `app/utils/stream_builder.py` — Vercel AI SDK v1 protocol SSE event formatting.
4. Implement `app/routers/chat.py` — `POST /api/chat` returning StreamingResponse.
5. Implement `app/routers/predict.py` — `POST /api/predict` for direct prediction access.
6. Write endpoint tests: `tests/test_chat.py`, `tests/test_predict.py`.

### Tasks (frontend — parallel with backend)

7. Implement `components/chat/chat-container.tsx` — full-height flex layout with useChat hook.
8. Implement `components/chat/empty-state.tsx` — welcome screen with clickable suggestion chips.
9. Implement `components/chat/message-bubble.tsx` — user/assistant message rendering with markdown.
10. Implement `components/chat/tool-invocation-block.tsx` — Python code+output display, ML prediction card.
11. Implement `components/chat/chat-input.tsx` — auto-resize textarea, send/stop buttons.
12. Implement `components/chat/streaming-indicator.tsx` — thinking/executing animation.
13. Assemble in `pages/chatbot.tsx`.

### References

- `spec/api.spec.md` — sections 4 (Chat) and 5 (Prediction): SSE stream format, tool schemas, predict endpoint
- `spec/backend_services/chat_service.md` — LLM config (OpenAI GPT-4o), tool definitions, SSE event sequence, tool execution loop
- `spec/backend_services/code_execution_service.md` — exec environment, available libraries, timeout, image capture
- `spec/backend_services/prediction_service.md` — `predict_building()` for the run_prediction tool, weather overrides
- `spec/pre-research/vercel-ai-sdk.md` — useChat hook API, transport config, message parts rendering, tool invocation states, FastAPI integration patterns
- `spec/ui.spec.md` — Page 4: Chatbot (all component specs)
- `spec/ux.design.md` — Flow 4: AI-Assisted Analysis, streaming indicator, chat auto-scroll

### Deliverable

Fully functional chatbot. User can ask questions, see streamed responses, view Python code execution results and ML prediction outputs inline.

---

## Phase 10: Integration & Polish

End-to-end testing, cross-page state consistency, error handling, and visual polish.

### Tasks

1. Verify map → building detail → back navigation preserves utility and scoring selections.
2. Verify uploaded data is reflected in map scores and building detail (after scoring recomputation).
3. Verify chatbot tools can access uploaded data.
4. Add toast notifications for upload success/error.
5. Add error boundaries and 404 page for invalid building numbers.
6. Verify dark mode across all pages (map tiles, charts, code blocks).
7. Verify responsive behavior at lg/md/sm breakpoints.
8. Performance check: map load < 2s, building detail < 1.5s, chat first token < 1s.

### References

- `spec/ux.design.md` — error handling patterns, loading states, performance targets, responsive adaptations, accessibility
- `spec/backend.test.plan.md` — full test matrix for all endpoints and services
- `spec/ui.spec.md` — Theme (dark mode), Responsive Behavior

### Deliverable

Production-ready prototype. All pages functional, error states handled, responsive, dark mode working.

---

## Phase Dependency Graph

```
Phase 1 (Scaffolding)
  ├── Phase 2 (Data Layer)
  │     └── Phase 3 (Prediction & Scoring)
  │           └── Phase 4 (Buildings API)
  │                 ├── Phase 6 (Map Overview) ←── Phase 5 (Layout)
  │                 ├── Phase 7 (Building Detail) ←── Phase 5 (Layout)
  │                 └── Phase 8 (Upload) ←── Phase 5 (Layout)
  └── Phase 5 (Frontend Layout)
        └── Phase 9 (Chatbot) ←── Phase 3 (Prediction)
              └── Phase 10 (Integration & Polish)
```

Phase 5 (Frontend Layout) can start in parallel with Phases 2-4 (backend). Within Phases 8 and 9, backend and frontend tasks can proceed in parallel.
