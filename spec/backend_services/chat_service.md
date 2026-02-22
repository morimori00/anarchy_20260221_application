# Chat Service — Detailed Design

> File: `backend/app/services/chat_service.py`

## Responsibility

Orchestrate the chatbot: receive user messages, call the LLM API with tool definitions, execute tool calls (Python code execution, ML prediction), and produce an SSE stream conforming to the Vercel AI SDK UI Message Stream Protocol (v1).

---

## Dependencies

- **Code Execution Service**: Executes Python code.
- **Prediction Service**: Runs ML model predictions.
- **Data Service**: Provides data context for the system prompt.
- **OpenAI API**: GPT-4o via the `openai` Python SDK. Requires `OPENAI_API_KEY` environment variable.

---

## Architecture

The chat service follows a tool-use loop pattern:

1. Receive user messages from the frontend.
2. Construct a system prompt with data context.
3. Call the LLM API with messages and tool definitions.
4. If the LLM response includes a tool call, execute it and feed the result back to the LLM.
5. Repeat steps 3-4 until the LLM produces a final text response.
6. Stream the entire interaction (text chunks, tool calls, tool results, final text) to the frontend as SSE events.

---

## LLM Configuration

### Provider

The service uses OpenAI GPT-4o via the `openai` Python SDK. The API key is read from the `OPENAI_API_KEY` environment variable. The model ID is `gpt-4o`.

Chat completions use `client.chat.completions.create()` with `stream=True` and `tools` parameter for tool definitions.

### System Prompt

The system prompt provides the LLM with context about the available data and tools:

```
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
```

---

## Tool Definitions

### Tool: `execute_python`

**Description**: Execute Python code for data analysis. The code runs in a sandboxed environment with pandas, numpy, matplotlib, and other scientific libraries available. Data files are accessible at `/app/data/`.

**Input Schema**:
```json
{
  "code": "string — Python code to execute"
}
```

**Execution**: Delegates to the Code Execution Service. Captures stdout, stderr, exit code, and any generated images (matplotlib figures saved to buffer).

**Output Schema**:
```json
{
  "stdout": "string",
  "stderr": "string",
  "exitCode": "number",
  "images": ["base64-encoded PNG strings"]
}
```

### Tool: `run_prediction`

**Description**: Run the XGBoost energy prediction model for a specific building. Optionally override weather parameters to simulate hypothetical scenarios (e.g., "What if temperature was 90F?").

**Input Schema**:
```json
{
  "buildingNumber": "string — Building identifier (SIMS code)",
  "utility": "string — Utility type (default: ELECTRICITY)",
  "weatherOverrides": "object | null — Weather feature overrides, e.g. {\"temperature_2m\": 90.0}"
}
```

**Execution**: Delegates to the Prediction Service's `predict_building()` method.

**Output Schema**:
```json
{
  "buildingNumber": "string",
  "utility": "string",
  "anomalyScore": "number (0-1)",
  "metrics": {
    "rmse": "number",
    "mae": "number",
    "meanResidual": "number"
  },
  "summary": "string — Human-readable summary of the prediction results"
}
```

---

## SSE Stream Format

The service produces an SSE stream conforming to the Vercel AI SDK v1 protocol. Each event is a `data:` line followed by a JSON object, terminated by `\n\n`. The stream ends with `data: [DONE]\n\n`.

### Event Sequence for a Simple Text Response

```
data: {"type":"message-start","messageId":"msg-001"}
data: {"type":"text-start","textId":"t-001"}
data: {"type":"text-delta","textId":"t-001","delta":"Here is "}
data: {"type":"text-delta","textId":"t-001","delta":"my analysis..."}
data: {"type":"text-end","textId":"t-001"}
data: {"type":"finish"}
data: [DONE]
```

### Event Sequence for a Response with Tool Call

```
data: {"type":"message-start","messageId":"msg-001"}
data: {"type":"text-start","textId":"t-001"}
data: {"type":"text-delta","textId":"t-001","delta":"Let me query the data."}
data: {"type":"text-end","textId":"t-001"}
data: {"type":"start-step"}
data: {"type":"tool-input-start","toolCallId":"tc-001","toolName":"execute_python"}
data: {"type":"tool-input-delta","toolCallId":"tc-001","delta":"{\"code\":\"import pandas as pd\\n...\"}"}
data: {"type":"tool-input-available","toolCallId":"tc-001","input":{"code":"import pandas as pd\n..."}}
data: {"type":"tool-output-available","toolCallId":"tc-001","output":{"stdout":"...","stderr":"","exitCode":0,"images":[]}}
data: {"type":"finish-step"}
data: {"type":"text-start","textId":"t-002"}
data: {"type":"text-delta","textId":"t-002","delta":"Based on the results..."}
data: {"type":"text-end","textId":"t-002"}
data: {"type":"finish"}
data: [DONE]
```

### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
x-vercel-ai-ui-message-stream: v1
```

---

## Tool Execution Loop

The service implements a multi-step loop:

1. Send messages + tool definitions to the LLM.
2. Read the LLM's response (streamed).
3. If the response contains a tool call:
   a. Stream the tool input events to the frontend.
   b. Execute the tool.
   c. Stream the tool output event to the frontend.
   d. Append the tool call and result to the message history.
   e. Call the LLM again with the updated history (go to step 1).
4. If the response is text only, stream it and finish.

Maximum loop iterations: 5 (to prevent infinite tool-calling loops). After 5 iterations, the service forces a text-only response.

---

## Error Handling

- **LLM API error**: Stream an error event `{"type":"error","error":"LLM API error: ..."}` and close the stream.
- **Tool execution error**: Include the error in the tool output (stderr or error message). The LLM can decide how to respond to the error.
- **Timeout**: If the LLM takes longer than 60 seconds per step, abort and stream an error event.
- **Invalid tool call**: If the LLM calls a tool with invalid input, return a validation error as tool output and let the LLM retry.
