"""Chat service - LLM orchestration with tool execution and SSE streaming.

Produces custom SSE events — each yield is one ``data: {json}\\n\\n`` SSE frame.
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.services.code_execution_service import CodeExecutionService
from app.services.prediction_service import (
    PredictionService,
    BuildingDataNotFoundError,
    InsufficientDataError,
    ModelNotAvailableError,
)
from app.utils import stream_builder as sse

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 5
STEP_TIMEOUT = 60  # seconds per LLM call + tool execution

SYSTEM_PROMPT = """\
You are an Energy Analysis Assistant for Ohio State University's campus buildings.

Available data:
- Meter readings for 287 buildings across 8 utility types (Sept-Oct 2025, 15-min intervals)
- Building metadata (1,287 buildings with location, area, floors, construction date)
- Weather data (hourly observations for Sept-Oct 2025)
- XGBoost prediction model trained on weather + building features to predict energy_per_sqft

When answering questions, use the available tools to query data and run analyses.
Show your work by executing Python code when doing calculations.
Use the prediction model when asked about hypothetical scenarios.
Always explain your findings clearly and note limitations of the 60-day data window.

Data files are at /app/data/. In Python code, use the pre-loaded `data` object:
- data.data_dir  → "/app/data"
- data.meter_sept → "/app/data/meter-data-sept-2025.csv"
- data.meter_oct  → "/app/data/meter-data-oct-2025.csv"
- data.buildings  → "/app/data/building_metadata.csv"
- data.weather    → "/app/data/weather-sept-oct-2025.csv"

Libraries available: pandas (pd), numpy (np), matplotlib.pyplot (plt), seaborn (sns), scipy, xgboost.
Use plt.show() (not plt.savefig()) for charts — figures are captured automatically.

Followings are the detailed information about the data tables.

```
# Data Dictionary

## Overview

Four CSV files covering ~60 days of campus energy data (Sept–Oct 2025) for Ohio State University buildings.

| File | Rows | Size | Description |
|---|---|---|---|
| `meter-data-sept-2025.csv` | 735,840 | 227 MB | 15-min interval meter readings, September 2025 |
| `meter-data-oct-2025.csv` | 760,368 | 235 MB | 15-min interval meter readings, October 2025 |
| `building_metadata.csv` | 1,287 | 246 KB | Building-level metadata (area, floors, location, vintage) |
| `weather-sept-oct-2025.csv` | 1,464 | 393 KB | Hourly weather observations, Sept 1 – Oct 31 2025 |

### Key Counts

- **1,287** buildings in metadata
- **287** buildings with meter data (linked via `simscode`/`buildingnumber`)
- **1,022** unique meters across **8** utility types
- **~1.5M** total meter readings

---

## Joins

```
building_metadata.buildingnumber ──direct──> meter_data.simscode
weather_data.date ──truncate to hour──> meter_data.readingtime
```

- Building join is exact: `buildingnumber` = `simscode`
- Weather join requires aligning hourly weather timestamps to 15-min meter intervals (e.g., truncate `readingtime` to the hour, or forward-fill)

---

## meter-data-sept-2025.csv / meter-data-oct-2025.csv

Each row is one 15-minute interval reading from a single meter. Readings are **per-interval** (not cumulative) — sum them for daily/monthly totals.

**Date range:** 2025-09-01 to 2025-11-01 (combined)

| Column | Type | Description | Example |
|---|---|---|---|
| `meterid` | int | Unique meter identifier | 292883 |
| `siteid` | int | Site identifier | 44071 |
| `sitename` | string | Human-readable site name | "Independence Hall" |
| `simscode` | int | Building code (join key to `buildingnumber`) | 338 |
| `utility` | string | Utility type (see table below) | "STEAM" |
| `readingtime` | datetime | Timestamp of the reading (ISO 8601) | 2025-09-01T05:00:00 |
| `readingvalue` | float | Consumption for this 15-min interval | 11.764 |
| `readingunits` | string | Unit of measurement | "kg" |
| `readingunitsdisplay` | string | Display-friendly unit name | "Kilograms" |
| `readingwindowstart` | datetime | Start of the rolling 24h summary window | 2025-09-01T05:00:00 |
| `readingwindowend` | datetime | End of the rolling 24h summary window | 2025-09-02T04:45:00 |
| `expectedwindowreadings` | int | Expected readings in window (96 = 24h) | 96 |
| `totalwindowreadings` | int | Actual readings received in window | 96 |
| `missingwindowreadings` | int | Missing readings in window | 0 |
| `filteredwindowreadings` | int | Readings excluded by quality filters | 0 |
| `readingwindowsum` | float | Sum of all readings in 24h window | 1103.79 |
| `readingwindowmean` | float | Mean reading in 24h window | 11.498 |
| `readingwindowstandarddeviation` | float | Std dev of readings in 24h window | 1.182 |
| `readingwindowmin` | float | Min reading in 24h window | 9.039 |
| `readingwindowmintime` | datetime | Timestamp of min reading | 2025-09-01T15:30:00 |
| `readingwindowmax` | float | Max reading in 24h window | 17.424 |
| `readingwindowmaxtime` | datetime | Timestamp of max reading | 2025-09-01T11:00:00 |
| `year` | int | Year extracted from readingtime | 2025 |
| `month` | int | Month extracted from readingtime | 09 |
| `day` | int | Day extracted from readingtime | 01 |

### Utility Types

| Utility | Category | Description | Units |
|---|---|---|---|
| **ELECTRICITY** | Energy | Electrical energy consumption | kWh |
| **GAS** | Energy | Natural gas consumption | varies |
| **HEAT** | Energy | Thermal energy delivered for heating | varies |
| **STEAM** | Energy | Thermal energy delivered as steam | kg |
| **COOLING** | Energy | Thermal energy delivered for cooling | ton-hours |
| **COOLING_POWER** | Power | Instantaneous cooling demand | tons |
| **STEAMRATE** | Power | Instantaneous steam flow rate | varies |
| **OIL28SEC** | Energy | Fuel oil consumption | varies |

**Energy** utilities (ELECTRICITY, GAS, HEAT, STEAM, COOLING) represent total consumption over the 15-min interval.
**Power** utilities (COOLING_POWER, STEAMRATE) represent instantaneous rate/demand.
Analyze utilities separately — do not sum across different utility types without explicit unit conversion.

---

## building_metadata.csv

One row per building. Not all buildings have meter data — only 287 of 1,287 appear in the meter files.

| Column | Type | Description | Completeness | Example |
|---|---|---|---|---|
| `buildingnumber` | int | Building ID (join key to `simscode`) | 1287/1287 | "356" |
| `buildingname` | string | Building name | 1287/1287 | "Twelfth Ave, 395 W (0356)" |
| `campusname` | string | Campus name | 1287/1287 | "Medical Center" |
| `address` | string | Street address | 1287/1287 | "395 W 12th Ave" |
| `city` | string | City | 1287/1287 | "Columbus" |
| `state` | string | State | 1287/1287 | "OH" |
| `postalcode` | string | ZIP code | 1287/1287 | "43210-1267" |
| `county` | string | County | 1287/1287 | "Franklin" |
| `formalname` | string | Formal building name | partial | — |
| `alsoknownas` | string | Alternate name | sparse | — |
| `grossarea` | float | Gross square footage | 1287/1287 | 90747 |
| `floorsaboveground` | float | Floors above ground | 1287/1287 | 9.0 |
| `floorsbelowground` | float | Floors below ground | 1287/1287 | 0.0 |
| `constructiondate` | date | Construction date (YYYY-MM-DD) | 982/1287 | "2007-07-01" |
| `latitude` | float | Latitude | 1249/1287 | 39.9959 |
| `longitude` | float | Longitude | 1249/1287 | -83.0179 |

---

## weather-sept-oct-2025.csv

Hourly weather observations from a single station at OSU main campus (40.08, -83.06). All rows share the same lat/lon.

**Date range:** 2025-09-01 00:00 to 2025-10-31 23:00 (1,464 hours)

| Column | Type | Units | Description | Example |
|---|---|---|---|---|
| `date` | datetime | ISO 8601 | Observation timestamp | 2025-09-01T00:00:00 |
| `latitude` | float | degrees | Station latitude (constant) | 40.0795 |
| `longitude` | float | degrees | Station longitude (constant) | -83.0732 |
| `temperature_2m` | float | °F | Air temperature at 2m | 68.2 |
| `shortwave_radiation` | int | W/m² | Shortwave radiation | 60 |
| `direct_radiation` | float | W/m² | Direct solar radiation | 35.0 |
| `diffuse_radiation` | float | W/m² | Diffuse solar radiation | 25 |
| `direct_normal_irradiance` | float | W/m² | Direct normal irradiance | 257.6 |
| `relative_humidity_2m` | float | % | Relative humidity at 2m | 58.1 |
| `dew_point_2m` | float | °F | Dew point at 2m | 52.9 |
| `precipitation` | float | mm | Total precipitation during the hour | 0.0 |
| `wind_speed_10m` | float | mph | Wind speed at 10m | 8.08 |
| `wind_speed_100m` | float | mph | Wind speed at 100m | 14.2 |
| `wind_direction_100m` | float | degrees | Wind direction at 100m | 26.2 |
| `wind_direction_10m` | float | degrees | Wind direction at 10m | 21.9 |
| `cloud_cover` | int | % | Cloud cover fraction | 0 |
| `apparent_temperature` | float | °F | Feels-like temperature | 65.7 |
| `partition_0` | string | — | Data partition label (ignorable) | "2025-01-01_2025-11-05" |

```

"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_python",
            "description": (
                "Execute Python code for data analysis. "
                "Libraries available: pandas (pd), numpy (np), matplotlib.pyplot (plt), "
                "seaborn (sns), scipy, xgboost. "
                "Data file paths are accessible via the pre-loaded `data` object."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute",
                    }
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_prediction",
            "description": (
                "Run the XGBoost energy prediction model for a specific building. "
                "Optionally override weather parameters to simulate hypothetical scenarios "
                '(e.g. "What if temperature was 90°F?").'
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "buildingNumber": {
                        "type": "integer",
                        "description": "Building number (SIMS code), e.g. 311",
                    },
                    "utility": {
                        "type": "string",
                        "description": "Utility type: ELECTRICITY, GAS, STEAM, HEAT, or COOLING. Default: ELECTRICITY",
                        "default": "ELECTRICITY",
                    },
                    "weatherOverrides": {
                        "type": "object",
                        "description": 'Optional weather feature overrides, e.g. {"temperature_2m": 90.0}',
                    },
                },
                "required": ["buildingNumber"],
            },
        },
    },
]


class ChatService:
    def __init__(
        self,
        api_key: str,
        model: str,
        code_execution_service: CodeExecutionService,
        prediction_service: PredictionService,
    ):
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._code_service = code_execution_service
        self._prediction_service = prediction_service

    # ── tool execution ──────────────────────────────────────────────

    async def _execute_tool(self, tool_name: str, arguments: dict) -> dict:
        """Execute a tool call asynchronously and return the result dict."""
        if tool_name == "execute_python":
            code = arguments.get("code", "")
            return await asyncio.to_thread(self._code_service.execute, code)

        if tool_name == "run_prediction":
            building_number = int(arguments.get("buildingNumber", 0))
            utility = arguments.get("utility", "ELECTRICITY")
            weather_overrides = arguments.get("weatherOverrides")
            try:
                df = await asyncio.to_thread(
                    self._prediction_service.predict_building,
                    building_number,
                    utility,
                    weather_overrides,
                )
                residuals = df["residual"]
                anomaly_score = float(residuals.abs().mean())
                rmse = float((residuals**2).mean() ** 0.5)
                mae = float(residuals.abs().mean())
                mean_residual = float(residuals.mean())

                sample = df.tail(10)[
                    ["readingtime", "energy_per_sqft", "predicted", "residual"]
                ].copy()
                sample["readingtime"] = sample["readingtime"].astype(str)

                return {
                    "buildingNumber": building_number,
                    "utility": utility,
                    "predictions": sample.to_dict("records"),
                    "anomalyScore": round(anomaly_score, 6),
                    "metrics": {
                        "rmse": round(rmse, 6),
                        "mae": round(mae, 6),
                        "meanResidual": round(mean_residual, 6),
                    },
                    "summary": (
                        f"Building {building_number} ({utility}): "
                        f"anomaly score {anomaly_score:.4f}, "
                        f"RMSE {rmse:.4f}, MAE {mae:.4f}"
                    ),
                }
            except (
                BuildingDataNotFoundError,
                InsufficientDataError,
                ModelNotAvailableError,
            ) as e:
                return {"error": str(e)}
            except Exception as e:
                return {"error": f"Prediction failed: {e}"}

        return {"error": f"Unknown tool: {tool_name}"}

    # ── main stream ─────────────────────────────────────────────────

    async def stream_chat(
        self, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion with tool-use loop.

        Yields custom SSE events.
        """
        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

        yield sse.metadata()

        for _iteration in range(MAX_TOOL_ITERATIONS):
            # ── call LLM ────────────────────────────────────────
            yield sse.status("thinking")

            try:
                stream = await asyncio.wait_for(
                    self._client.chat.completions.create(
                        model=self._model,
                        messages=full_messages,
                        tools=TOOLS,
                        stream=True,
                    ),
                    timeout=STEP_TIMEOUT,
                )
            except asyncio.TimeoutError:
                yield sse.error("LLM request timed out")
                yield sse.done()
                return
            except Exception as e:
                logger.error("LLM API error: %s", e)
                yield sse.error(f"LLM API error: {e}")
                yield sse.done()
                return

            # ── stream response chunks ──────────────────────────
            tool_calls_acc: dict[int, dict] = {}
            has_tool_calls = False
            assistant_content = ""

            try:
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    delta = choice.delta
                    finish_reason = choice.finish_reason
                    if delta is None:
                        continue

                    # Text delta
                    if delta.content:
                        assistant_content += delta.content
                        yield sse.text_delta(delta.content)

                    # Accumulate tool-call fragments
                    if delta.tool_calls:
                        has_tool_calls = True
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_acc:
                                tool_calls_acc[idx] = {
                                    "id": tc.id or "",
                                    "name": "",
                                    "arguments": "",
                                }
                            if tc.id:
                                tool_calls_acc[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_calls_acc[idx]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls_acc[idx]["arguments"] += (
                                        tc.function.arguments
                                    )

                    # ── LLM finished with tool calls ────────────
                    if finish_reason == "tool_calls":
                        # Build ONE assistant message with all tool_calls
                        assistant_tool_calls = []
                        for idx in sorted(tool_calls_acc.keys()):
                            tc_info = tool_calls_acc[idx]
                            assistant_tool_calls.append(
                                {
                                    "id": tc_info["id"],
                                    "type": "function",
                                    "function": {
                                        "name": tc_info["name"],
                                        "arguments": tc_info["arguments"],
                                    },
                                }
                            )
                        full_messages.append(
                            {
                                "role": "assistant",
                                "content": assistant_content or None,
                                "tool_calls": assistant_tool_calls,
                            }
                        )

                        # Execute each tool
                        for idx in sorted(tool_calls_acc.keys()):
                            tc_info = tool_calls_acc[idx]
                            tool_name = tc_info["name"]
                            try:
                                args = json.loads(tc_info["arguments"])
                            except json.JSONDecodeError:
                                args = {}

                            yield sse.tool_start(tc_info["id"], tool_name, args)
                            yield sse.status("tool-executing", tool_name)

                            try:
                                result = await asyncio.wait_for(
                                    self._execute_tool(tool_name, args),
                                    timeout=STEP_TIMEOUT,
                                )
                            except asyncio.TimeoutError:
                                yield sse.tool_end(
                                    tc_info["id"],
                                    error=f"Tool execution timed out after {STEP_TIMEOUT}s",
                                )
                                full_messages.append(
                                    {
                                        "role": "tool",
                                        "tool_call_id": tc_info["id"],
                                        "content": json.dumps({"error": f"Tool execution timed out after {STEP_TIMEOUT}s"}),
                                    }
                                )
                                continue

                            # Check if tool result itself contains an error
                            if "error" in result:
                                yield sse.tool_end(
                                    tc_info["id"], error=result["error"]
                                )
                            else:
                                yield sse.tool_end(tc_info["id"], output=result)

                            full_messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tc_info["id"],
                                    "content": json.dumps(result),
                                }
                            )

                        assistant_content = ""
                        break  # loop for next LLM turn

                    # ── LLM finished normally ───────────────────
                    if finish_reason == "stop":
                        break

            except Exception as e:
                logger.error("Stream processing error: %s", e)
                yield sse.error(f"Stream error: {e}")
                yield sse.done()
                return

            # No tool calls → we're done
            if not has_tool_calls:
                break

        yield sse.done()
