"""SSE stream builder for Vercel AI SDK UI Message Stream Protocol v1.

Each event is an SSE line: ``data: {json}\\n\\n``
The stream terminates with ``data: [DONE]\\n\\n``.

Required response header: ``x-vercel-ai-ui-message-stream: v1``
"""

import json
import uuid


def _gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# ── lifecycle ────────────────────────────────────────────────────────

def message_start(message_id: str | None = None) -> str:
    mid = message_id or _gen_id("msg-")
    return f"data: {json.dumps({'type': 'message-start', 'messageId': mid})}\n\n"


def start_step() -> str:
    return f"data: {json.dumps({'type': 'start-step'})}\n\n"


def finish_step() -> str:
    return f"data: {json.dumps({'type': 'finish-step'})}\n\n"


def finish() -> str:
    return f"data: {json.dumps({'type': 'finish'})}\n\n"


def done() -> str:
    return "data: [DONE]\n\n"


# ── text ─────────────────────────────────────────────────────────────

def text_start(text_id: str | None = None) -> str:
    tid = text_id or _gen_id("t-")
    return f"data: {json.dumps({'type': 'text-start', 'textId': tid})}\n\n"


def text_delta(text_id: str, delta: str) -> str:
    return f"data: {json.dumps({'type': 'text-delta', 'textId': text_id, 'delta': delta})}\n\n"


def text_end(text_id: str) -> str:
    return f"data: {json.dumps({'type': 'text-end', 'textId': text_id})}\n\n"


# ── tool invocations ────────────────────────────────────────────────

def tool_input_start(tool_call_id: str, tool_name: str) -> str:
    return f"data: {json.dumps({'type': 'tool-input-start', 'toolCallId': tool_call_id, 'toolName': tool_name})}\n\n"


def tool_input_available(tool_call_id: str, input_data: dict) -> str:
    return f"data: {json.dumps({'type': 'tool-input-available', 'toolCallId': tool_call_id, 'input': input_data})}\n\n"


def tool_output_available(tool_call_id: str, output: dict) -> str:
    return f"data: {json.dumps({'type': 'tool-output-available', 'toolCallId': tool_call_id, 'output': output})}\n\n"


# ── error ────────────────────────────────────────────────────────────

def error(message: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'error': message})}\n\n"
