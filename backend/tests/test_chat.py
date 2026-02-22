"""Tests for the chat endpoint (POST /api/chat) — v1 UI Message Stream protocol."""

import json
from unittest.mock import MagicMock, patch

import pytest
import httpx
from httpx import ASGITransport


def _parse_sse_events(body: str) -> list[dict | str]:
    """Parse SSE body into a list of event dicts (or raw '[DONE]' string)."""
    events = []
    for line in body.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("data: "):
            payload = line[len("data: "):]
            if payload == "[DONE]":
                events.append("[DONE]")
            else:
                events.append(json.loads(payload))
    return events


@pytest.mark.asyncio
async def test_chat_stream_response(test_client):
    """POST /api/chat returns a streaming response with v1 headers."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert response.headers.get("x-vercel-ai-ui-message-stream") == "v1"


@pytest.mark.asyncio
async def test_chat_message_format(test_client):
    """Verify the stream contains message-start, text-delta, finish, and [DONE]."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    events = _parse_sse_events(response.text)
    event_types = [e["type"] if isinstance(e, dict) else e for e in events]

    assert "message-start" in event_types
    assert "text-start" in event_types
    assert "text-delta" in event_types
    assert "text-end" in event_types
    assert "finish" in event_types
    assert "[DONE]" in event_types


@pytest.mark.asyncio
async def test_chat_text_content(test_client):
    """Verify text-delta events contain the expected streamed text."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    events = _parse_sse_events(response.text)
    text_deltas = [e for e in events if isinstance(e, dict) and e.get("type") == "text-delta"]

    assert len(text_deltas) == 2
    assert text_deltas[0]["delta"] == "Hello "
    assert text_deltas[1]["delta"] == "world!"


@pytest.mark.asyncio
async def test_chat_empty_messages(test_client):
    """POST /api/chat with empty messages array should still return a response."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": []},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_chat_tool_events():
    """Verify tool call and tool result events are streamed correctly."""
    mock_svc = MagicMock()

    async def stream_chat(messages):
        yield 'data: {"type":"message-start","messageId":"msg-1"}\n\n'
        yield 'data: {"type":"text-start","textId":"t-1"}\n\n'
        yield 'data: {"type":"text-delta","textId":"t-1","delta":"Let me check."}\n\n'
        yield 'data: {"type":"text-end","textId":"t-1"}\n\n'
        yield 'data: {"type":"start-step"}\n\n'
        tc = {"type": "tool-input-start", "toolCallId": "tc-1", "toolName": "execute_python"}
        yield f"data: {json.dumps(tc)}\n\n"
        ti = {"type": "tool-input-available", "toolCallId": "tc-1", "input": {"code": "print(42)"}}
        yield f"data: {json.dumps(ti)}\n\n"
        to = {"type": "tool-output-available", "toolCallId": "tc-1", "output": {"stdout": "42\n", "stderr": "", "exitCode": 0, "images": []}}
        yield f"data: {json.dumps(to)}\n\n"
        yield 'data: {"type":"finish-step"}\n\n'
        yield 'data: {"type":"text-start","textId":"t-2"}\n\n'
        yield 'data: {"type":"text-delta","textId":"t-2","delta":"The answer is 42."}\n\n'
        yield 'data: {"type":"text-end","textId":"t-2"}\n\n'
        yield 'data: {"type":"finish"}\n\n'
        yield "data: [DONE]\n\n"

    mock_svc.stream_chat = MagicMock(side_effect=stream_chat)

    with (
        patch("app.dependencies._chat_service", mock_svc),
        patch("app.dependencies._prediction_service", MagicMock()),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Run code"}]},
            )

    events = _parse_sse_events(response.text)
    event_types = [e["type"] if isinstance(e, dict) else e for e in events]

    assert "tool-input-start" in event_types
    assert "tool-input-available" in event_types
    assert "tool-output-available" in event_types
    assert "start-step" in event_types
    assert "finish-step" in event_types

    # Verify tool input content
    tool_input = next(e for e in events if isinstance(e, dict) and e.get("type") == "tool-input-available")
    assert tool_input["input"]["code"] == "print(42)"

    # Verify tool output content
    tool_output = next(e for e in events if isinstance(e, dict) and e.get("type") == "tool-output-available")
    assert tool_output["output"]["stdout"] == "42\n"
    assert tool_output["output"]["exitCode"] == 0


@pytest.mark.asyncio
async def test_chat_error_event():
    """Verify error events are streamed correctly."""
    mock_svc = MagicMock()

    async def stream_chat(messages):
        yield 'data: {"type":"message-start","messageId":"msg-err"}\n\n'
        yield 'data: {"type":"error","error":"LLM API error: rate limit"}\n\n'
        yield 'data: {"type":"finish"}\n\n'
        yield "data: [DONE]\n\n"

    mock_svc.stream_chat = MagicMock(side_effect=stream_chat)

    with (
        patch("app.dependencies._chat_service", mock_svc),
        patch("app.dependencies._prediction_service", MagicMock()),
        patch("app.dependencies.init_services"),
    ):
        from app.main import app
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Test"}]},
            )

    events = _parse_sse_events(response.text)
    error_events = [e for e in events if isinstance(e, dict) and e.get("type") == "error"]
    assert len(error_events) == 1
    assert "rate limit" in error_events[0]["error"]
