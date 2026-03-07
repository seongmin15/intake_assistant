import json
from unittest.mock import AsyncMock, MagicMock, patch

from intake_assistant_api.services import template_cache

VALID_RESPONSE_DATA = {
    "questions": [
        {
            "id": "q1",
            "title": "서비스 구성",
            "description": "어떤 종류의 서비스가 필요한가요?",
            "type": "single",
            "choices": [
                {"id": "q1_a", "label": "웹 서비스"},
                {"id": "q1_b", "label": "백엔드 API만"},
            ],
        },
    ],
    "analysis": {
        "detected_keywords": ["todo"],
        "inferred_hints": {"has_db": "yes"},
    },
}


def _mock_anthropic_client(response_text: str) -> AsyncMock:
    """Create a mock that replaces the Anthropic client on app.state."""
    client = AsyncMock()
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    client.messages.create = AsyncMock(return_value=message)
    return client


async def test_analyze_returns_200_with_questions(client) -> None:
    mock = _mock_anthropic_client(json.dumps(VALID_RESPONSE_DATA))

    from intake_assistant_api.main import app

    app.state.anthropic = mock
    template_cache.set_template("test")

    try:
        resp = await client.post(
            "/api/v1/analyze",
            json={"user_input": "할 일 관리 앱을 만들고 싶어요"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "questions" in data
        assert "analysis" in data
        assert len(data["questions"]) == 1
        assert data["questions"][0]["id"] == "q1"
    finally:
        template_cache.clear()


async def test_analyze_empty_input_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/analyze",
        json={"user_input": ""},
    )
    assert resp.status_code == 422


async def test_analyze_missing_input_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/analyze",
        json={},
    )
    assert resp.status_code == 422


async def test_analyze_too_long_input_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/analyze",
        json={"user_input": "a" * 5001},
    )
    assert resp.status_code == 422


async def test_analyze_anthropic_failure_returns_502(client) -> None:
    mock = AsyncMock()
    from anthropic import APIConnectionError

    mock.messages.create = AsyncMock(
        side_effect=APIConnectionError(request=MagicMock()),
    )

    from intake_assistant_api.main import app

    app.state.anthropic = mock
    template_cache.set_template("test")

    try:
        with patch("intake_assistant_api.services.analyze_service.asyncio.sleep"):
            resp = await client.post(
                "/api/v1/analyze",
                json={"user_input": "테스트 입력"},
            )

        assert resp.status_code == 502
        assert "error" in resp.json()
    finally:
        template_cache.clear()


class _MockStreamContext:
    """Mock for client.messages.stream() async context manager."""

    def __init__(self, text_chunks: list[str]) -> None:
        self._chunks = text_chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass

    @property
    def text_stream(self):
        return self._aiter_chunks()

    async def _aiter_chunks(self):
        for chunk in self._chunks:
            yield chunk


async def test_analyze_stream_returns_event_stream(client) -> None:
    """POST /api/v1/analyze/stream returns text/event-stream content type."""
    chunks = [json.dumps(VALID_RESPONSE_DATA, ensure_ascii=False)]
    mock = AsyncMock()
    mock.messages.stream = MagicMock(return_value=_MockStreamContext(chunks))

    from intake_assistant_api.main import app

    app.state.anthropic = mock
    template_cache.set_template("test")

    try:
        resp = await client.post(
            "/api/v1/analyze/stream",
            json={"user_input": "할 일 관리 앱을 만들고 싶어요"},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        body = resp.text
        assert "event: status" in body
        assert "event: result" in body
    finally:
        template_cache.clear()
