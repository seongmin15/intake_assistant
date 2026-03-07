import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import APIConnectionError, APIError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.services.analyze_service import analyze

VALID_RESPONSE_DATA = {
    "questions": [
        {
            "id": "q1",
            "title": "서비스 구성",
            "description": "어떤 종류의 서비스가 필요한가요?",
            "type": "single",
            "choices": [
                {"id": "q1_a", "label": "웹 서비스 (백엔드 + 프론트엔드)"},
                {"id": "q1_b", "label": "백엔드 API만"},
            ],
        },
        {
            "id": "q2",
            "title": "데이터 저장",
            "description": "데이터를 어떻게 저장하나요?",
            "type": "single",
            "choices": [
                {"id": "q2_a", "label": "관계형 데이터베이스 (PostgreSQL 등)"},
                {"id": "q2_b", "label": "파일 기반 저장"},
            ],
        },
        {
            "id": "q3",
            "title": "사용자 인증",
            "description": "사용자 로그인이 필요한가요?",
            "type": "single",
            "choices": [
                {"id": "q3_a", "label": "네, 로그인 필요"},
                {"id": "q3_b", "label": "아니요, 누구나 사용 가능"},
            ],
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
    assert result.questions[0].choices[0].id == "q1_a"
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
        pytest.raises(ExternalServiceError, match="Failed after 3 retries"),
    ):
        await analyze(client, "테스트 입력")

    assert client.messages.create.call_count == 3


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
