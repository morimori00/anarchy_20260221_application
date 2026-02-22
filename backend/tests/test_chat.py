"""Tests for the chat endpoint (POST /api/chat)."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx
from httpx import ASGITransport


@pytest.mark.asyncio
async def test_chat_stream_response(test_client):
    """POST /api/chat returns a streaming response with correct headers."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    assert response.status_code == 200
    assert "text/" in response.headers["content-type"]
    assert response.headers.get("x-vercel-ai-data-stream") == "v1"


@pytest.mark.asyncio
async def test_chat_message_format(test_client):
    """Verify the stream contains text deltas and a finish event."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    body = response.text
    lines = [l for l in body.strip().split("\n") if l.strip()]

    # Should have text deltas (0:) and finish (d:)
    has_text_delta = any(l.startswith("0:") for l in lines)
    has_finish = any(l.startswith("d:") for l in lines)

    assert has_text_delta, f"No text delta events found in: {lines}"
    assert has_finish, f"No finish event found in: {lines}"

    # Verify finish event contains finishReason
    finish_lines = [l for l in lines if l.startswith("d:")]
    assert len(finish_lines) > 0
    finish_data = json.loads(finish_lines[-1][2:])
    assert finish_data["finishReason"] == "stop"


@pytest.mark.asyncio
async def test_chat_empty_messages(test_client):
    """POST /api/chat with empty messages array should still return a response."""
    response = await test_client.post(
        "/api/chat",
        json={"messages": []},
    )

    # Should not crash - either 200 with a stream or graceful handling
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_chat_text_content():
    """Verify text delta events contain the expected streamed text."""
    mock_svc = MagicMock()

    async def stream_chat(messages):
        yield '0:"Test response"\n'
        yield 'd:{"finishReason":"stop"}\n'

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

    body = response.text
    text_lines = [l for l in body.strip().split("\n") if l.startswith("0:")]
    assert len(text_lines) > 0
    assert "Test response" in text_lines[0]


@pytest.mark.asyncio
async def test_chat_tool_events():
    """Verify tool call and tool result events are streamed correctly."""
    mock_svc = MagicMock()

    async def stream_chat(messages):
        yield '0:"Let me check."\n'
        tool_call = {"toolCallId": "tc-1", "toolName": "execute_python", "args": {"code": "print(42)"}}
        yield f'9:{json.dumps(tool_call)}\n'
        tool_result = {"toolCallId": "tc-1", "result": {"stdout": "42\n", "stderr": "", "exitCode": 0, "images": []}}
        yield f'a:{json.dumps(tool_result)}\n'
        yield '0:"The answer is 42."\n'
        yield 'd:{"finishReason":"stop"}\n'

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

    body = response.text
    lines = [l for l in body.strip().split("\n") if l.strip()]

    has_tool_call = any(l.startswith("9:") for l in lines)
    has_tool_result = any(l.startswith("a:") for l in lines)

    assert has_tool_call, f"No tool call event found in: {lines}"
    assert has_tool_result, f"No tool result event found in: {lines}"

    # Verify tool call content
    tc_lines = [l for l in lines if l.startswith("9:")]
    tc_data = json.loads(tc_lines[0][2:])
    assert tc_data["toolName"] == "execute_python"
    assert tc_data["args"]["code"] == "print(42)"

    # Verify tool result content
    tr_lines = [l for l in lines if l.startswith("a:")]
    tr_data = json.loads(tr_lines[0][2:])
    assert tr_data["result"]["stdout"] == "42\n"
    assert tr_data["result"]["exitCode"] == 0
