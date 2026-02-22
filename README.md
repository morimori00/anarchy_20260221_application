# Energy Efficiency Monitoring Application

An AI-powered web application for strategic energy investment prioritization across Ohio State University's campus buildings. Built for the **OSU AI Hackathon 2026**.

## Overview

Campus buildings experience similar external conditions — weather, seasonal demand, academic cycles — yet respond very differently in terms of energy consumption. This application uses **machine learning** to model expected energy behavior based on weather and building characteristics, then identifies buildings that deviate significantly from predictions. The result is a data-driven shortlist of buildings that merit deeper investigation or capital investment.

### Key Features

- **Interactive Campus Map** — Visualize ~287 buildings on an interactive map with color-coded anomaly markers. Filter by utility type (Electricity, Gas, Steam, Cooling, etc.) and scoring method.
- **Building Detail Dashboard** — Deep-dive into individual buildings with metadata, per-utility anomaly scores, time series charts (actual vs. predicted), and anomaly detail tables.
- **Data Upload** — Add new meter, weather, or building data via CSV upload, manual entry, or weather API fetch (Open-Meteo).
- **AI Chatbot** — ChatGPT-style interface for natural language data analysis. The assistant can execute Python code and run ML predictions inline, enabling "what-if" scenario analysis.

## Architecture

```
┌─────────────────┐      ┌─────────────────┐
│    Frontend      │      │    Backend       │
│  React + Vite    │◄────►│    FastAPI       │
│  TypeScript      │ REST │    Python        │
│  Tailwind CSS    │  +   │                  │
│  shadcn/ui       │ SSE  │  XGBoost Model   │
│  mapcn (maps)    │      │  OpenAI GPT-4o   │
└─────────────────┘      └─────────────────┘
     Port 3000                Port 8000
                                  │
                          ┌───────┴───────┐
                          │   data/       │
                          │   model/      │
                          └───────────────┘
```

| Layer | Stack |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, mapcn, Recharts, Vercel AI SDK |
| Backend | FastAPI, pandas, XGBoost, OpenAI API |
| ML Model | XGBoost (gradient-boosted trees) — 25 features, predicts energy per sqft |
| Containers | Docker Compose (backend:8000, frontend:3000) |

## Data

The application uses three datasets covering ~60 days of campus energy data (Sept–Oct 2025):

| Dataset | Records | Description |
|---|---|---|
| Smart Meter Data | ~1.5M rows | 15-min interval energy readings across 1,022 meters and 8 utility types |
| Building Metadata | 1,287 buildings | Area, floors, construction date, location coordinates |
| Weather Data | 1,464 hours | Hourly observations (temperature, humidity, wind, radiation, etc.) |

### Utility Types

| Utility | Type | Units |
|---|---|---|
| ELECTRICITY | Energy | kWh |
| GAS | Energy | varies |
| HEAT | Energy | varies |
| STEAM | Energy | kg |
| COOLING | Energy | ton-hours |
| COOLING_POWER | Power | tons |
| STEAMRATE | Power | varies |
| OIL28SEC | Energy | varies |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- OpenAI API key (for the chatbot feature)

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd ai_hack_20260221
   ```

2. Place data files in the `data/` directory:
   ```
   data/
   ├── meter-data-sept-2025.csv
   ├── meter-data-oct-2025.csv
   ├── building_metadata.csv
   └── weather-sept-oct-2025.csv
   ```

3. Place the trained model in the `model/` directory:
   ```
   model/
   └── model_best.json
   ```

4. Create a `.env` file in the project root:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

5. Start the application:
   ```bash
   docker-compose up --build
   ```

6. Open the app:
   - Frontend: http://localhost:3000
   - Backend API docs: http://localhost:8000/docs

## Project Structure

```
/
├── frontend/               # React + Vite + TypeScript
│   └── src/
│       ├── components/     # UI components (layout, map, building, upload, chat)
│       ├── pages/          # Map Overview, Building Detail, Upload, Chatbot
│       ├── hooks/          # Data fetching hooks
│       ├── lib/            # API client, constants, utilities
│       └── types/          # TypeScript interfaces
├── backend/                # FastAPI application
│   └── app/
│       ├── routers/        # API endpoints (buildings, upload, chat, weather, predict)
│       ├── services/       # Business logic (data, scoring, prediction, chat, upload)
│       ├── schemas/        # Pydantic models
│       └── utils/          # Feature engineering, SSE stream builder
├── data/                   # Source CSV files (not in git)
├── model/                  # Trained XGBoost model (not in git)
├── spec/                   # Design documents
└── docker-compose.yml
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/buildings` | List all buildings with anomaly scores |
| GET | `/api/buildings/{id}` | Building detail with per-utility breakdown |
| GET | `/api/buildings/{id}/timeseries` | Time series data (actual, predicted, residual) |
| POST | `/api/upload/meter` | Upload meter data (CSV or JSON) |
| POST | `/api/upload/weather` | Upload weather data |
| POST | `/api/upload/building` | Upload building metadata |
| GET | `/api/weather/fetch` | Fetch weather from Open-Meteo API |
| POST | `/api/chat` | AI chat with SSE streaming |
| POST | `/api/predict` | Run ML prediction with optional weather overrides |

## ML Model

The XGBoost model predicts energy consumption per square foot using 25 features:

- **Weather** (8): temperature, humidity, dew point, radiation, wind speed, cloud cover, apparent temperature, precipitation
- **Building** (3): gross area, floors above ground, building age
- **Temporal** (4): hour of day, minute of hour, day of week, is weekend
- **Engineered** (10): lag features (1h, 6h, 24h, 1 week), rolling mean/std (24h, 1 week), interaction terms (temp x area, humidity x area)

Anomaly scores are computed from residuals (actual - predicted) using three selectable methods:
- **Size-Normalized** (default) — Mean absolute residual per sqft, min-max normalized
- **Percentile Rank** — Z-score based ranking across all buildings
- **Absolute Threshold** — Fixed residual thresholds per utility type

## Team

Built by Team Anarchy at the OSU AI Hackathon, February 2026.
