"""Chat service - LLM orchestration with SSE streaming."""
import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.services.code_execution_service import CodeExecutionService
from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 5

SYSTEM_PROMPT = """You are an energy analysis assistant for Ohio State University campus buildings.

Available data:
- 287 buildings with meter data (electricity, gas, steam, heat, cooling, etc.)
- 60 days of 15-minute interval meter readings (September-October 2025)
- Hourly weather data for the same period
- XGBoost anomaly detection model for energy consumption

You can use these tools:
1. execute_python: Run Python code with access to pandas, numpy, matplotlib, seaborn, scipy, xgboost. Data files are in the DATA_DIR directory (/app/data/): building_metadata.csv, meter-data-sept-2025.csv, meter-data-oct-2025.csv, weather-sept-oct-2025.csv
2. run_prediction: Run the XGBoost prediction model for a specific building and utility type

Always explain your analysis approach and findings clearly. Use charts and visualizations when appropriate."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_python",
            "description": "Execute Python code for data analysis. Libraries available: pandas (pd), numpy (np), matplotlib.pyplot (plt), seaborn (sns), scipy. Data files at /app/data/.",
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
            "description": "Run XGBoost energy prediction model for a building. Returns predictions, anomaly score, and model metrics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "buildingNumber": {
                        "type": "integer",
                        "description": "Building number (e.g. 311)",
                    },
                    "utility": {
                        "type": "string",
                        "description": "Utility type (ELECTRICITY, GAS, STEAM, HEAT, COOLING)",
                        "default": "ELECTRICITY",
                    },
                    "weatherOverrides": {
                        "type": "object",
                        "description": "Optional weather overrides for scenario analysis",
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

    def _execute_tool(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool call and return the result as a JSON string."""
        if tool_name == "execute_python":
            code = arguments.get("code", "")
            result = self._code_service.execute(code)
            return json.dumps(result)

        elif tool_name == "run_prediction":
            building_number = int(arguments.get("buildingNumber", 0))
            utility = arguments.get("utility", "ELECTRICITY")
            weather_overrides = arguments.get("weatherOverrides")
            try:
                df = self._prediction_service.predict_building(
                    building_number, utility, weather_overrides
                )
                # Compute summary metrics
                residuals = df["residual"]
                anomaly_score = float(residuals.abs().mean())
                rmse = float((residuals ** 2).mean() ** 0.5)
                mae = float(residuals.abs().mean())
                mean_residual = float(residuals.mean())

                # Return last 10 predictions as sample
                sample = df.tail(10)[["readingtime", "energy_per_sqft", "predicted", "residual"]].copy()
                sample["readingtime"] = sample["readingtime"].astype(str)
                predictions = sample.to_dict("records")

                result = {
                    "predictions": predictions,
                    "anomalyScore": round(anomaly_score, 6),
                    "metrics": {
                        "rmse": round(rmse, 6),
                        "mae": round(mae, 6),
                        "meanResidual": round(mean_residual, 6),
                    },
                }
                return json.dumps(result)
            except Exception as e:
                return json.dumps({"error": str(e)})

        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    async def stream_chat(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """Stream chat completion with tool execution, yielding Vercel AI SDK v1 SSE events."""

        # Prepend system message
        full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

        for iteration in range(MAX_TOOL_ITERATIONS):
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=full_messages,
                tools=TOOLS,
                stream=True,
            )

            tool_calls_in_progress: dict[int, dict] = {}
            has_tool_calls = False
            assistant_content = ""

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta is None:
                    continue

                finish_reason = chunk.choices[0].finish_reason

                # Stream text content
                if delta.content:
                    assistant_content += delta.content
                    yield f"0:{json.dumps(delta.content)}\n"

                # Accumulate tool calls
                if delta.tool_calls:
                    has_tool_calls = True
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_in_progress:
                            tool_calls_in_progress[idx] = {
                                "id": tc.id or "",
                                "name": "",
                                "arguments": "",
                            }
                        if tc.id:
                            tool_calls_in_progress[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_in_progress[idx]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_in_progress[idx]["arguments"] += tc.function.arguments

                # Handle finish
                if finish_reason == "tool_calls":
                    # Execute all accumulated tool calls
                    for idx in sorted(tool_calls_in_progress.keys()):
                        tc_info = tool_calls_in_progress[idx]
                        tool_name = tc_info["name"]
                        try:
                            args = json.loads(tc_info["arguments"])
                        except json.JSONDecodeError:
                            args = {}

                        # Emit tool call event
                        tool_call_event = {
                            "toolCallId": tc_info["id"],
                            "toolName": tool_name,
                            "args": args,
                        }
                        yield f"9:{json.dumps(tool_call_event)}\n"

                        # Execute tool
                        tool_result = self._execute_tool(tool_name, args)

                        # Emit tool result event
                        tool_result_event = {
                            "toolCallId": tc_info["id"],
                            "result": json.loads(tool_result),
                        }
                        yield f"a:{json.dumps(tool_result_event)}\n"

                        # Add to messages for next iteration
                        full_messages.append({
                            "role": "assistant",
                            "content": assistant_content or None,
                            "tool_calls": [
                                {
                                    "id": tc_info["id"],
                                    "type": "function",
                                    "function": {
                                        "name": tool_name,
                                        "arguments": tc_info["arguments"],
                                    },
                                }
                            ],
                        })
                        full_messages.append({
                            "role": "tool",
                            "tool_call_id": tc_info["id"],
                            "content": tool_result,
                        })

                    # Reset for next iteration
                    assistant_content = ""
                    break

                if finish_reason == "stop":
                    break

            if not has_tool_calls:
                break

        # Emit finish event
        yield f"d:{json.dumps({'finishReason': 'stop'})}\n"
