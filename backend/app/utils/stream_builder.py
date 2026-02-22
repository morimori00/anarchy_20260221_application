"""SSE stream builder for Vercel AI SDK v1 protocol."""
import json


def sse_event(data: str) -> str:
    """Format a single SSE event."""
    return f"data: {data}\n\n"


def text_delta_event(text: str) -> str:
    """Create a text delta SSE event."""
    return sse_event(json.dumps({"type": "text-delta", "textDelta": text}))


def tool_call_event(tool_call_id: str, tool_name: str, args: dict) -> str:
    """Create a tool invocation SSE event."""
    return sse_event(json.dumps({
        "type": "tool-call",
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
    }))


def tool_result_event(tool_call_id: str, result: dict) -> str:
    """Create a tool result SSE event."""
    return sse_event(json.dumps({
        "type": "tool-result",
        "toolCallId": tool_call_id,
        "result": result,
    }))


def finish_event(reason: str = "stop") -> str:
    """Create a finish SSE event."""
    return sse_event(json.dumps({"type": "finish", "finishReason": reason}))


def done_event() -> str:
    """Create a done event."""
    return "data: [DONE]\n\n"
