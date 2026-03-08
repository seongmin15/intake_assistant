import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import APIConnectionError, APIError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.recommend import RecommendRequest
from intake_assistant_api.services.recommend_service import recommend

VALID_RESPONSE_DATA = {
    "suggestion": "medium",
    "rationale": "프로젝트 규모와 영향도를 고려하면 중간 수준의 심각도가 적절합니다.",
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


def _make_request(**overrides) -> RecommendRequest:
    defaults = {
        "context": {"project": {"name": "my-app", "type": "web"}},
        "field_path": "problem.severity",
        "field_info": {
            "description": "문제의 심각도",
            "enum_values": ["low", "medium", "high", "critical"],
            "field_type": "enum",
        },
    }
    defaults.update(overrides)
    return RecommendRequest(**defaults)


async def test_recommend_returns_valid_response() -> None:
    client = _make_mock_client(json.dumps(VALID_RESPONSE_DATA))
    req = _make_request()

    result = await recommend(client, req)

    assert result.suggestion == "medium"
    assert "심각도" in result.rationale


async def test_recommend_strips_markdown_code_block() -> None:
    wrapped = f"```json\n{json.dumps(VALID_RESPONSE_DATA)}\n```"
    client = _make_mock_client(wrapped)
    req = _make_request()

    result = await recommend(client, req)

    assert result.suggestion == "medium"


async def test_recommend_retries_on_api_error_then_succeeds() -> None:
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

    with patch("intake_assistant_api.services.recommend_service.asyncio.sleep"):
        result = await recommend(client, _make_request())

    assert result.suggestion == "medium"
    assert client.messages.create.call_count == 2


async def test_recommend_raises_after_max_retries() -> None:
    client = AsyncMock()
    mock_error = APIConnectionError(request=MagicMock())
    client.messages.create = AsyncMock(side_effect=mock_error)

    with (
        patch("intake_assistant_api.services.recommend_service.asyncio.sleep"),
        pytest.raises(ExternalServiceError, match="Failed after 2 retries"),
    ):
        await recommend(client, _make_request())

    assert client.messages.create.call_count == 2


async def test_recommend_raises_on_invalid_json() -> None:
    client = _make_mock_client("this is not json")

    with pytest.raises(ExternalServiceError, match="Invalid response format"):
        await recommend(client, _make_request())


async def test_recommend_with_minimal_context() -> None:
    client = _make_mock_client(json.dumps(VALID_RESPONSE_DATA))
    req = _make_request(context={}, field_info={})

    result = await recommend(client, req)

    assert result.suggestion == "medium"


async def test_recommend_user_message_includes_enum_values() -> None:
    """Verify the user message sent to the API includes field metadata."""
    client = _make_mock_client(json.dumps(VALID_RESPONSE_DATA))
    req = _make_request()

    await recommend(client, req)

    call_args = client.messages.create.call_args
    user_msg = call_args.kwargs["messages"][0]["content"]
    assert "problem.severity" in user_msg
    assert "low" in user_msg
    assert "medium" in user_msg
    assert "high" in user_msg
