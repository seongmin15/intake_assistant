import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import APIConnectionError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.generate import GenerateRequest, QaAnswer
from intake_assistant_api.services.generate_service import (
    _parse_response,
    generate,
    generate_stream,
)

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
        QaAnswer(question_id="q1", answer="웹 서비스가 필요합니다"),
        QaAnswer(question_id="q2", answer="PostgreSQL로 저장하고 싶습니다"),
    ],
)

REVISION_REQUEST = GenerateRequest(
    user_input="할 일 관리 앱을 만들고 싶어요",
    qa_answers=[
        QaAnswer(question_id="q1", answer="웹 서비스가 필요합니다"),
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


def _make_mock_sdwc(valid: bool = True, errors: list | None = None) -> AsyncMock:
    sdwc = AsyncMock()
    result = {"valid": valid, "errors": errors or [], "warnings": []}
    sdwc.validate_yaml = AsyncMock(return_value=result)
    return sdwc


async def test_generate_success() -> None:
    """Normal generation + validation pass → GenerateResponse returned."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = _make_mock_sdwc(valid=True)

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
            {
                "valid": False,
                "errors": [{"detail": "project.name: empty"}],
                "warnings": [],
            },
            {"valid": True, "errors": [], "warnings": []},
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
    sdwc.validate_yaml = AsyncMock(
        return_value={"valid": False, "errors": [{"detail": "invalid"}], "warnings": []}
    )

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
    sdwc = _make_mock_sdwc(valid=True)

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        patch("intake_assistant_api.services.generate_service.asyncio.sleep"),
        pytest.raises(ExternalServiceError, match="Failed after 2 retries"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)


def test_parse_response_untagged_yaml_block() -> None:
    """YAML in untagged code block (``` instead of ```yaml) should be extracted."""
    response = f"```\n{SAMPLE_YAML}```\n\n```json\n{_META_JSON}\n```"
    yaml_content, metadata = _parse_response(response)
    assert "test-project" in yaml_content
    assert metadata["architecture_card"]["authentication"] == "none"


def test_parse_response_untagged_both_blocks() -> None:
    """Both YAML and JSON in untagged code blocks should be extracted."""
    response = f"```\n{SAMPLE_YAML}```\n\n```\n{_META_JSON}\n```"
    yaml_content, metadata = _parse_response(response)
    assert "test-project" in yaml_content
    assert len(metadata["feature_checklist"]) == 2


async def test_generate_parse_error_no_yaml_block() -> None:
    """Response without YAML block → ExternalServiceError."""
    anthropic = _make_mock_anthropic("no yaml here\n```json\n{}\n```")
    sdwc = _make_mock_sdwc(valid=True)

    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        pytest.raises(ExternalServiceError, match="Invalid response format"),
    ):
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)


async def test_generate_no_json_block_uses_default_metadata() -> None:
    """Response without JSON block → uses default metadata instead of error."""
    anthropic = _make_mock_anthropic(f"```yaml\n{SAMPLE_YAML}```\nno json here")
    sdwc = _make_mock_sdwc(valid=True)

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        result = await generate(anthropic, sdwc, DEFAULT_REQUEST)

    assert result.yaml_content == SAMPLE_YAML.strip()
    assert result.architecture_card.service_composition == "-"
    assert result.feature_checklist == []


async def test_generate_revision_request() -> None:
    """Revision request with previous_yaml → normal generation."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = _make_mock_sdwc(valid=True)

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        result = await generate(anthropic, sdwc, REVISION_REQUEST)

    assert result.yaml_content == SAMPLE_YAML.strip()
    # Verify user message includes revision context
    call_args = anthropic.messages.create.call_args
    user_msg = call_args.kwargs["messages"][0]["content"]
    assert "수정 요청" in user_msg
    assert "인증을 JWT로 변경" in user_msg


async def test_generate_uses_prompt_caching() -> None:
    """System prompt is sent with cache_control for prompt caching."""
    anthropic = _make_mock_anthropic(VALID_LLM_RESPONSE)
    sdwc = _make_mock_sdwc(valid=True)

    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        await generate(anthropic, sdwc, DEFAULT_REQUEST)

    call_args = anthropic.messages.create.call_args
    system_arg = call_args.kwargs["system"]
    assert isinstance(system_arg, list)
    assert len(system_arg) == 1
    assert system_arg[0]["type"] == "text"
    assert system_arg[0]["cache_control"] == {"type": "ephemeral"}


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


def _make_streaming_anthropic(text_chunks: list[str]) -> AsyncMock:
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


async def test_stream_success_event_sequence() -> None:
    """Streaming: status(generating) → chunks → status(validating) → result."""
    chunks = [f"```yaml\n{SAMPLE_YAML}```", f"\n\n```json\n{_META_JSON}\n```"]
    anthropic = _make_streaming_anthropic(chunks)
    sdwc = _make_mock_sdwc(valid=True)

    sse_list: list[str] = []
    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        async for sse in generate_stream(anthropic, sdwc, DEFAULT_REQUEST):
            sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[0] == "status"
    assert events[0][1]["phase"] == "generating"
    assert "chunk" in event_types
    assert event_types[-2] == "status"
    assert events[-2][1]["phase"] == "validating"
    assert event_types[-1] == "result"
    assert events[-1][1]["yaml_content"] == SAMPLE_YAML.strip()


async def test_stream_validation_retry_then_pass() -> None:
    """Streaming: validation fails once, retries, passes on second attempt."""
    chunks = [VALID_LLM_RESPONSE]
    anthropic = _make_streaming_anthropic(chunks)
    # Need to re-create the mock for each call since MockStreamContext is consumed
    def _stream_side_effect(**_kwargs):
        return MockStreamContext(chunks)

    anthropic.messages.stream = MagicMock(side_effect=_stream_side_effect)

    sdwc = AsyncMock()
    sdwc.validate_yaml = AsyncMock(
        side_effect=[
            {"valid": False, "errors": [{"detail": "bad"}], "warnings": []},
            {"valid": True, "errors": [], "warnings": []},
        ]
    )

    sse_list: list[str] = []
    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        async for sse in generate_stream(anthropic, sdwc, DEFAULT_REQUEST):
            sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    # Should have retry status event
    assert "result" in event_types
    retry_events = [e for e in events if e[0] == "status" and e[1].get("phase") == "retry"]
    assert len(retry_events) == 1
    assert retry_events[0][1]["attempt"] == 2


async def test_stream_error_on_parse_failure() -> None:
    """Streaming: invalid LLM response → error SSE event."""
    chunks = ["no yaml or json here"]
    anthropic = _make_streaming_anthropic(chunks)
    sdwc = _make_mock_sdwc(valid=True)

    sse_list: list[str] = []
    with patch("intake_assistant_api.services.generate_service.template_cache") as tc:
        tc.get_template.return_value = "mock template"
        async for sse in generate_stream(anthropic, sdwc, DEFAULT_REQUEST):
            sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[-1] == "error"
    assert "응답 형식 오류" in events[-1][1]["message"]


async def test_stream_error_on_api_failure() -> None:
    """Streaming: Anthropic API fails all retries → error SSE event."""
    client = AsyncMock()
    client.messages.stream = MagicMock(
        side_effect=APIConnectionError(request=MagicMock())
    )
    sdwc = _make_mock_sdwc(valid=True)

    sse_list: list[str] = []
    with (
        patch("intake_assistant_api.services.generate_service.template_cache") as tc,
        patch("intake_assistant_api.services.generate_service.asyncio.sleep"),
    ):
        tc.get_template.return_value = "mock template"
        async for sse in generate_stream(client, sdwc, DEFAULT_REQUEST):
            sse_list.append(sse)

    events = _parse_sse_events(sse_list)
    event_types = [e[0] for e in events]

    assert event_types[-1] == "error"
    assert "AI 서비스 호출 실패" in events[-1][1]["message"]
