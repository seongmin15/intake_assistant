import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import APIConnectionError, APIError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.services.analyze_service import analyze, analyze_stream

VALID_RESPONSE_DATA = {
    "questions": [
        {
            "id": "q1",
            "title": "서비스 구성",
            "description": "어떤 종류의 서비스가 필요한가요?",
            "placeholder": "예: 웹사이트와 백엔드 API가 필요합니다",
        },
        {
            "id": "q2",
            "title": "데이터 저장",
            "description": "어떤 데이터를 저장해야 하나요?",
        },
        {
            "id": "q3",
            "title": "사용자 인증",
            "description": "누가 이 서비스를 사용하나요? 로그인이 필요한가요?",
            "placeholder": "예: 내부 직원만 사용하고 로그인이 필요합니다",
        },
    ],
    "analysis": {
        "detected_keywords": ["todo", "할 일"],
        "inferred_hints": {"needs_auth": "가능성 있음", "has_db": "yes"},
    },
}


def _make_mock_client(response_text: str) -> AsyncMock:
    """Create a mock AsyncAnthropic client that returns the given text."""
    client = AsyncMock()
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    client.messages.create = AsyncMock(return_value=message)
    return client


async def test_analyze_returns_valid_response() -> None:
    client = _make_mock_client(json.dumps(VALID_RESPONSE_DATA))

    result = await analyze(client, "할 일 관리 앱을 만들고 싶어요")

    assert len(result.questions) == 3
    assert result.questions[0].id == "q1"
    assert "todo" in result.analysis.detected_keywords
    assert result.analysis.inferred_hints["has_db"] == "yes"


async def test_analyze_retries_on_api_error_then_succeeds() -> None:
    client = AsyncMock()
    content_block = MagicMock()
    content_block.text = json.dumps(VALID_RESPONSE_DATA)
    message = MagicMock()
    message.content = [content_block]

    mock_error = APIError(
        message="server error",
        request=MagicMock(),
        body=None,
    )

    client.messages.create = AsyncMock(
        side_effect=[mock_error, message],
    )

    with patch("intake_assistant_api.services.analyze_service.asyncio.sleep"):
        result = await analyze(client, "테스트 입력")

    assert len(result.questions) == 3
    assert client.messages.create.call_count == 2


async def test_analyze_raises_after_max_retries() -> None:
    client = AsyncMock()
    mock_error = APIConnectionError(request=MagicMock())

    client.messages.create = AsyncMock(side_effect=mock_error)

    with (
        patch("intake_assistant_api.services.analyze_service.asyncio.sleep"),
        pytest.raises(ExternalServiceError, match="Failed after 2 retries"),
    ):
        await analyze(client, "테스트 입력")

    assert client.messages.create.call_count == 2


async def test_analyze_strips_markdown_code_block() -> None:
    wrapped = f"```json\n{json.dumps(VALID_RESPONSE_DATA)}\n```"
    client = _make_mock_client(wrapped)

    result = await analyze(client, "할 일 관리 앱을 만들고 싶어요")

    assert len(result.questions) == 3
    assert result.questions[0].id == "q1"


async def test_analyze_strips_code_block_without_language_tag() -> None:
    wrapped = f"```\n{json.dumps(VALID_RESPONSE_DATA)}\n```"
    client = _make_mock_client(wrapped)

    result = await analyze(client, "할 일 관리 앱을 만들고 싶어요")

    assert len(result.questions) == 3


async def test_analyze_raises_on_invalid_json_response() -> None:
    client = _make_mock_client("this is not json")

    with pytest.raises(ExternalServiceError, match="Invalid response format"):
        await analyze(client, "테스트 입력")


async def test_analyze_raises_on_missing_fields() -> None:
    client = _make_mock_client(json.dumps({"questions": []}))

    # Empty questions list is valid per schema, but missing analysis field should fail
    with pytest.raises(ExternalServiceError, match="Invalid response format"):
        await analyze(client, "테스트 입력")


# --- Streaming tests ---


class MockStreamContext:
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


def _make_streaming_client(text_chunks: list[str]) -> AsyncMock:
    """Create a mock Anthropic client that supports messages.stream()."""
    client = AsyncMock()
    client.messages.stream = MagicMock(return_value=MockStreamContext(text_chunks))
    return client


def _parse_sse_events(sse_strings: list[str]) -> list[tuple[str, dict]]:
    """Parse SSE strings into (event_type, data) tuples."""
    events = []
    for sse in sse_strings:
        event_type = ""
        data_str = ""
        for line in sse.strip().split("\n"):
            if line.startswith("event: "):
                event_type = line[7:]
            elif line.startswith("data: "):
                data_str = line[6:]
        if event_type and data_str:
            events.append((event_type, json.loads(data_str)))
    return events


async def test_analyze_stream_success() -> None:
    """Streaming: status(analyzing) → chunks → result."""
    response_json = json.dumps(VALID_RESPONSE_DATA, ensure_ascii=False)
    chunks = [response_json[:50], response_json[50:]]
    client = _make_streaming_client(chunks)

    sse_list: list[str] = []
    async for sse in analyze_stream(client, "할 일 관리 앱을 만들고 싶어요"):
        sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[0] == "status"
    assert events[0][1]["phase"] == "analyzing"
    assert "chunk" in event_types
    assert event_types[-1] == "result"
    assert len(events[-1][1]["questions"]) == 3
    assert events[-1][1]["questions"][0]["id"] == "q1"


async def test_analyze_stream_error_on_api_failure() -> None:
    """Streaming: Anthropic API fails all retries → error SSE event."""
    client = AsyncMock()
    client.messages.stream = MagicMock(
        side_effect=APIConnectionError(request=MagicMock())
    )

    sse_list: list[str] = []
    with patch("intake_assistant_api.services.analyze_service.asyncio.sleep"):
        async for sse in analyze_stream(client, "테스트 입력"):
            sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[-1] == "error"
    assert "AI 서비스 호출 실패" in events[-1][1]["message"]


async def test_analyze_stream_error_on_parse_failure() -> None:
    """Streaming: invalid LLM response → error SSE event."""
    chunks = ["this is not valid json"]
    client = _make_streaming_client(chunks)

    sse_list: list[str] = []
    async for sse in analyze_stream(client, "테스트 입력"):
        sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[-1] == "error"
    assert "응답 형식 오류" in events[-1][1]["message"]
