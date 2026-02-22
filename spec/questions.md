# Design Decisions

> Design decisions encountered during specification. Resolved decisions are marked with **[Decided]**.

---

## Q1: Anomaly Score Normalization Method [Decided: UI-selectable]

**Context**: The model outputs only `predicted` values per 15-minute interval per building per utility. The backend computes residuals (`actual - predicted`) and these need to be aggregated into a single 0-1 anomaly score per building per utility for the map overview.

**Decision**: All three scoring methods are implemented in the backend. The user selects the active method from a dropdown in the Map Overview page header. The default is Option C.

### Option A: Z-Score based (percentile rank across all buildings)

Compute the mean absolute residual per building per utility. Then rank all buildings by this value and convert to a percentile (0 = lowest anomaly, 1 = highest). This is a relative ranking — each building's score depends on how it compares to peers.

- Upside: Always produces a full 0-1 distribution. Intuitive for "which buildings are worst relative to others."
- Downside: Scores change when new buildings are added. A building with moderate absolute anomaly could score high if most others are low.

### Option B: Absolute threshold based

Define absolute residual thresholds per utility type (e.g., for ELECTRICITY: < 50 kWh mean residual = normal, < 100 = caution, < 200 = warning, >= 200 = anomaly). Normalize within these ranges.

- Upside: Scores are stable and interpretable in physical units. Does not change when other buildings are added.
- Downside: Requires domain knowledge to set thresholds per utility. May not generalize well across different building sizes.

### Option C: Normalized by building size (default)

Compute mean absolute residual per sqft, then use a min-max normalization across all buildings. This accounts for building size while still providing relative ranking.

- Upside: Fair comparison across buildings of different sizes. The model already predicts energy_per_sqft, so residuals are already size-normalized.
- Downside: Buildings with very small gross area may have amplified scores.

---

## Q2: SSE Protocol Version for FastAPI Chat Endpoint [Decided: C]

**Context**: The Vercel AI SDK supports multiple streaming protocols. The FastAPI backend must implement one.

**Decision**: Option C — Manual SSE implementation using FastAPI's `StreamingResponse`. The protocol is well-documented and our tool set is small (2 tools). Direct implementation gives full control and avoids fragile third-party dependencies.

---

## Q3: LLM Provider Selection [Decided: A]

**Context**: The chatbot needs an LLM provider. The backend calls the LLM API directly.

**Decision**: Option A — OpenAI (GPT-4o). Use the `openai` Python SDK directly. Requires `OPENAI_API_KEY` environment variable.

---

## Q4: Data Persistence Strategy [Decided: A]

**Context**: The application loads CSV data at startup. Uploaded data needs to be queryable alongside existing data.

**Decision**: Option A — In-memory only (pandas DataFrames). Load all CSVs into pandas DataFrames at startup. Uploaded data is appended to the in-memory DataFrames. Data is lost on restart. This is the simplest implementation with no database dependency and fast queries.

---

## Q5: Chart Library for Time Series [Decided: A]

**Context**: The building detail page needs a time series line chart.

**Decision**: Option A — Recharts. Best integration with the shadcn/ui ecosystem and sufficient for our data size (hourly aggregation = ~1,464 points max).
