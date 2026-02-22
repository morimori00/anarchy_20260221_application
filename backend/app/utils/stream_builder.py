"""SSE stream builder — simplified custom protocol.

Each event is an SSE line: ``data: {json}\n\n``
The stream terminates with ``data: [DONE]\n\n``.

Event types:
  text-delta    Incremental text chunk
  tool-start    Tool call initiated (with args)
  tool-end      Tool call finished (with output or error)
  error         Fatal stream error
  status        Informational status update (thinking, tool-executing)
  metadata      Message-level metadata (messageId)
  [DONE]        Stream terminator
"""

import json
import uuid


def _gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def text_delta(delta: str) -> str:
    return f"data: {json.dumps({'type': 'text-delta', 'delta': delta})}\n\n"


def tool_start(tool_call_id: str, tool_name: str, args: dict) -> str:
    return f"data: {json.dumps({'type': 'tool-start', 'toolCallId': tool_call_id, 'toolName': tool_name, 'args': args})}\n\n"


def tool_end(tool_call_id: str, output: dict | None = None, error: str | None = None) -> str:
    payload: dict = {"type": "tool-end", "toolCallId": tool_call_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["output"] = output or {}
    return f"data: {json.dumps(payload)}\n\n"


def error(message: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"


def status(status_value: str, tool_name: str | None = None) -> str:
    payload: dict = {"type": "status", "status": status_value}
    if tool_name is not None:
        payload["toolName"] = tool_name
    return f"data: {json.dumps(payload)}\n\n"


def metadata(message_id: str | None = None) -> str:
    mid = message_id or _gen_id("msg-")
    return f"data: {json.dumps({'type': 'metadata', 'messageId': mid})}\n\n"


def done() -> str:
    return "data: [DONE]\n\n"
