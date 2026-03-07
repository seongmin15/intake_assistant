import json
from unittest.mock import AsyncMock, MagicMock, patch

from intake_assistant_api.services import template_cache

SAMPLE_YAML = "project:\n  name: test\n"

SAMPLE_METADATA = {
    "architecture_card": {
        "service_composition": "1 service (backend_api: FastAPI)",
        "data_storage": "없음",
        "authentication": "none",
        "external_services": "없음",
        "screen_count": "해당 없음",
    },
    "feature_checklist": [
        {"name": "기능1", "summary": "설명1"},
    ],
}

_META_JSON = json.dumps(SAMPLE_METADATA, ensure_ascii=False)
VALID_LLM_RESPONSE = f"```yaml\n{SAMPLE_YAML}```\n\n```json\n{_META_JSON}\n```"

VALID_REQUEST = {
    "user_input": "할 일 관리 앱을 만들고 싶어요",
    "qa_answers": [
        {"question_id": "q1", "answer": "웹 서비스가 필요합니다"},
        {"question_id": "q2", "answer": "PostgreSQL로 저장하고 싶습니다"},
    ],
}


def _mock_anthropic_client(response_text: str) -> AsyncMock:
    client = AsyncMock()
    content_block = MagicMock()
    content_block.text = response_text
    message = MagicMock()
    message.content = [content_block]
    client.messages.create = AsyncMock(return_value=message)
    return client


def _mock_sdwc_client(valid: bool = True) -> AsyncMock:
    sdwc = AsyncMock()
    sdwc.validate_yaml = AsyncMock(return_value={"valid": valid, "errors": [], "warnings": []})
    return sdwc


async def test_generate_returns_200(client) -> None:
    mock_anthropic = _mock_anthropic_client(VALID_LLM_RESPONSE)
    mock_sdwc = _mock_sdwc_client(valid=True)

    from intake_assistant_api.main import app

    app.state.anthropic = mock_anthropic
    app.state.sdwc_client = mock_sdwc
    template_cache.set_template("test")

    try:
        resp = await client.post("/api/v1/generate", json=VALID_REQUEST)

        assert resp.status_code == 200
        data = resp.json()
        assert "yaml_content" in data
        assert "architecture_card" in data
        assert "feature_checklist" in data
        card = data["architecture_card"]
        assert card["service_composition"] == "1 service (backend_api: FastAPI)"
        assert len(data["feature_checklist"]) == 1
    finally:
        template_cache.clear()


async def test_generate_empty_user_input_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/generate",
        json={
            "user_input": "",
            "qa_answers": [{"question_id": "q1", "answer": "웹 서비스"}],
        },
    )
    assert resp.status_code == 422


async def test_generate_empty_qa_answers_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/generate",
        json={
            "user_input": "테스트 입력",
            "qa_answers": [],
        },
    )
    assert resp.status_code == 422


async def test_generate_anthropic_failure_returns_502(client) -> None:
    mock_anthropic = AsyncMock()
    from anthropic import APIConnectionError

    mock_anthropic.messages.create = AsyncMock(
        side_effect=APIConnectionError(request=MagicMock()),
    )
    mock_sdwc = _mock_sdwc_client(valid=True)

    from intake_assistant_api.main import app

    app.state.anthropic = mock_anthropic
    app.state.sdwc_client = mock_sdwc
    template_cache.set_template("test")

    try:
        with patch("intake_assistant_api.services.generate_service.asyncio.sleep"):
            resp = await client.post("/api/v1/generate", json=VALID_REQUEST)

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


async def test_generate_stream_returns_event_stream(client) -> None:
    """POST /api/v1/generate/stream returns text/event-stream content type."""
    chunks = [VALID_LLM_RESPONSE]
    mock_anthropic = AsyncMock()
    mock_anthropic.messages.stream = MagicMock(
        return_value=_MockStreamContext(chunks)
    )
    mock_sdwc = _mock_sdwc_client(valid=True)

    from intake_assistant_api.main import app

    app.state.anthropic = mock_anthropic
    app.state.sdwc_client = mock_sdwc
    template_cache.set_template("test")

    try:
        resp = await client.post("/api/v1/generate/stream", json=VALID_REQUEST)
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        body = resp.text
        assert "event: status" in body
        assert "event: result" in body
    finally:
        template_cache.clear()
