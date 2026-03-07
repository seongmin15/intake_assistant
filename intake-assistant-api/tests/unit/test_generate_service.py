import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import APIConnectionError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.generate import GenerateRequest, QaAnswer
from intake_assistant_api.services.generate_service import generate

SAMPLE_YAML = """\
project:
  name: "test-project"
  one_liner: "테스트 프로젝트"
  elevator_pitch: "테스트용 프로젝트입니다."
"""

SAMPLE_METADATA = {
    "architecture_card": {
        "service_composition": "1 service (backend_api: FastAPI)",
        "data_storage": "PostgreSQL (primary)",
        "authentication": "none",
        "external_services": "없음",
        "screen_count": "해당 없음",
    },
    "feature_checklist": [
        {"name": "할 일 관리", "summary": "할 일 CRUD 기능"},
        {"name": "카테고리 분류", "summary": "할 일을 카테고리별로 분류"},
    ],
}

_META_JSON = json.dumps(SAMPLE_METADATA, ensure_ascii=False)
VALID_LLM_RESPONSE = f"```yaml\n{SAMPLE_YAML}```\n\n```json\n{_META_JSON}\n```"

DEFAULT_REQUEST = GenerateRequest(
    user_input="할 일 관리 앱을 만들고 싶어요",
    qa_answers=[
        QaAnswer(question_id="q1", selected_ids=["q1_a"]),
        QaAnswer(question_id="q2", selected_ids=["q2_a"]),
    ],
)

REVISION_REQUEST = GenerateRequest(
    user_input="할 일 관리 앱을 만들고 싶어요",
    qa_answers=[
        QaAnswer(question_id="q1", selected_ids=["q1_a"]),
    ],
    revision_request="인증을 JWT로 변경해주세요",
    previous_yaml=SAMPLE_YAML,
)


def _make_mock_anthropic(response_text: str) -> AsyncMock:
    client = AsyncMock()
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    client.messages.create = AsyncMock(return_value=message)
    return client


def _make_mock_sdwc(success: bool = True, error: dict | None = None) -> AsyncMock:
    sdwc = AsyncMock()
    result = {"success": success}
    if error:
        result["error"] = error
    sdwc.validate_yaml = AsyncMock(return_value=result)
    return sdwc


async def test_generate_success() -> None:
    """Normal generation + validation pass → GenerateResponse returned."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = _make_mock_sdwc(success=True)

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        result = await generate(anthropic, sdwc, DEFAULT_REQUEST)

    assert result.yaml_content == SAMPLE_YAML.strip()
    assert result.architecture_card.service_composition == "1 service (backend_api: FastAPI)"
    assert result.architecture_card.data_storage == "PostgreSQL (primary)"
    assert len(result.feature_checklist) == 2
    assert result.feature_checklist[0].name == "할 일 관리"
    sdwc.validate_yaml.assert_called_once()


async def test_generate_validation_retry_then_pass() -> None:
    """Validation fails once, retry with error feedback → pass on second attempt."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = AsyncMock()
    sdwc.validate_yaml = AsyncMock(
        side_effect=[
            {"success": False, "error": {"field": "project.name", "message": "empty"}},
            {"success": True},
        ]
    )

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        result = await generate(anthropic, sdwc, DEFAULT_REQUEST)

    assert result.yaml_content == SAMPLE_YAML.strip()
    assert sdwc.validate_yaml.call_count == 2
    assert anthropic.messages.create.call_count == 2


async def test_generate_validation_retries_exhausted() -> None:
    """Validation fails on all attempts → ExternalServiceError."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = AsyncMock()
    sdwc.validate_yaml = AsyncMock(return_value={"success": False, "error": {"message": "invalid"}})

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        pytest.raises(ExternalServiceError, match="YAML validation failed after 3 attempts"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)

    assert sdwc.validate_yaml.call_count == 3
    assert anthropic.messages.create.call_count == 3


async def test_generate_anthropic_failure_retries_exhausted() -> None:
    """Anthropic API fails all retries → ExternalServiceError."""
    anthropic = AsyncMock()
    anthropic.messages.create = AsyncMock(side_effect=APIConnectionError(request=MagicMock()))
    sdwc = _make_mock_sdwc(success=True)

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        patch("intake_assistant_api.services.generate_service.asyncio.sleep"),
        pytest.raises(ExternalServiceError, match="Failed after 3 retries"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)


async def test_generate_parse_error_no_yaml_block() -> None:
    """Response without YAML block → ExternalServiceError."""
    anthropic = _make_mock_anthropic("no yaml here\n```json\n{}\n```")
    sdwc = _make_mock_sdwc(success=True)

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        pytest.raises(ExternalServiceError, match="Invalid response format"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)


async def test_generate_parse_error_no_json_block() -> None:
    """Response without JSON block → ExternalServiceError."""
    anthropic = _make_mock_anthropic(f"```yaml\n{SAMPLE_YAML}```\nno json here")
    sdwc = _make_mock_sdwc(success=True)

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        pytest.raises(ExternalServiceError, match="Invalid response format"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)


async def test_generate_revision_request() -> None:
    """Revision request with previous_yaml → normal generation."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = _make_mock_sdwc(success=True)

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        result = await generate(anthropic, sdwc, REVISION_REQUEST)

    assert result.yaml_content == SAMPLE_YAML.strip()
    # Verify user message includes revision context
    call_args = anthropic.messages.create.call_args
    user_msg = call_args.kwargs["messages"][0]["content"]
    assert "수정 요청" in user_msg
    assert "인증을 JWT로 변경" in user_msg
