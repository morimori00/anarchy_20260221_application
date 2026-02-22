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
Use plt.show() (not plt.savefig()) for charts — figures are captured automatically."""

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
