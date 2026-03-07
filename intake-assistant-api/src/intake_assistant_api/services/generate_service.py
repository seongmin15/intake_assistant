import asyncio
import json
import re
from collections.abc import AsyncGenerator

import structlog
from anthropic import APIConnectionError, APIError, AsyncAnthropic

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.generate import (
    ArchitectureCard,
    FeatureItem,
    GenerateRequest,
    GenerateResponse,
)
from intake_assistant_api.services import template_cache
from intake_assistant_api.services.prompts.generate import (
    build_system_prompt,
    build_user_message,
)
from intake_assistant_api.services.sdwc_client import SDwCClient

logger = structlog.get_logger()

MAX_RETRIES = 2
BACKOFF_SECONDS = [1, 2]
MAX_VALIDATION_RETRIES = 2
MODEL = "claude-sonnet-4-6"


def _extract_block(text: str, language: str) -> str | None:
    """Extract a fenced code block by language tag, falling back to untagged blocks."""
    # Try with explicit language tag first
    match = re.search(rf"```{language}\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None


_YAML_START_KEYS = ("project_name:", "project:")


def _default_metadata() -> dict:
    """Return default metadata when JSON block is missing from LLM response."""
    return {
        "architecture_card": {
            "service_composition": "-",
            "data_storage": "-",
            "authentication": "-",
            "external_services": "-",
            "screen_count": "-",
        },
        "feature_checklist": [],
    }


def _find_raw_json(text: str) -> str | None:
    """Find a raw JSON object containing 'architecture_card' using brace balancing."""
    keyword = '"architecture_card"'
    idx = text.find(keyword)
    if idx == -1:
        return None

    # Walk backwards to find the opening brace
    start = text.rfind("{", 0, idx)
    if start == -1:
        return None

    # Walk forward with brace balancing to find the matching close
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _find_raw_yaml(text: str) -> str | None:
    """Find raw YAML content outside code fences by scanning for top-level keys."""
    for key in _YAML_START_KEYS:
        idx = text.find(key)
        if idx == -1:
            continue
        # Take everything from this key to end-of-text or next code fence
        rest = text[idx:]
        fence_idx = rest.find("```")
        candidate = rest[:fence_idx].strip() if fence_idx != -1 else rest.strip()
        if len(candidate) > 50:
            return candidate
    return None


def _parse_response(text: str) -> tuple[str, dict]:
    """Extract YAML block and JSON metadata block from LLM response."""
    yaml_content = _extract_block(text, "yaml")

    # Fallback 1: untagged code blocks that look like YAML
    if not yaml_content:
        untagged = re.findall(r"```\s*\n(.*?)```", text, re.DOTALL)
        for block in untagged:
            stripped = block.strip()
            if any(stripped.startswith(k) for k in _YAML_START_KEYS):
                yaml_content = stripped
                break

    # Fallback 2: raw YAML outside code fences
    if not yaml_content:
        yaml_content = _find_raw_yaml(text)

    if not yaml_content:
        raise ValueError("No YAML block found in response")

    json_content = _extract_block(text, "json")

    # Fallback 1: untagged code blocks that look like JSON
    if not json_content:
        untagged = re.findall(r"```\s*\n(.*?)```", text, re.DOTALL)
        for block in untagged:
            stripped = block.strip()
            if stripped.startswith("{"):
                json_content = stripped
                break

    # Fallback 2: raw JSON outside code fences
    if not json_content:
        json_content = _find_raw_json(text)

    # Fallback 3: no JSON found — use default metadata
    if not json_content:
        return yaml_content, _default_metadata()

    try:
        metadata: dict = json.loads(json_content)
    except json.JSONDecodeError:
        return yaml_content, _default_metadata()

    return yaml_content, metadata


async def _call_anthropic(
    client: AsyncAnthropic,
    system_prompt: str,
    user_message: str,
) -> str:
    """Call Anthropic API with retry logic."""
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=8192,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text  # type: ignore[union-attr]

        except (APIError, APIConnectionError) as exc:
            last_error = exc
            await logger.awarning(
                "anthropic_api_retry",
                attempt=attempt + 1,
                error=str(exc),
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(BACKOFF_SECONDS[attempt])

    raise ExternalServiceError("Anthropic", f"Failed after {MAX_RETRIES} retries: {last_error}")


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def generate_stream(
    client: AsyncAnthropic,
    sdwc: SDwCClient,
    request: GenerateRequest,
) -> AsyncGenerator[str, None]:
    """Generate intake_data.yaml with SSE streaming for real-time progress."""
    template = template_cache.get_template()
    field_requirements = template_cache.get_field_requirements()
    system_prompt = build_system_prompt(template, field_requirements)
    system_block = [
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }
    ]

    qa_dicts = [a.model_dump() for a in request.qa_answers]
    error_feedback: str | None = None

    for validation_attempt in range(MAX_VALIDATION_RETRIES + 1):
        user_message = build_user_message(
            user_input=request.user_input,
            qa_answers=qa_dicts,
            template=template,
            revision_request=request.revision_request,
            previous_yaml=request.previous_yaml,
            error_feedback=error_feedback,
        )

        yield _sse_event(
            "status",
            {
                "phase": "generating",
                "attempt": validation_attempt + 1,
                "max_attempts": MAX_VALIDATION_RETRIES + 1,
            },
        )

        # Stream LLM response with retry logic
        raw_text = ""
        last_error: Exception | None = None

        for api_attempt in range(MAX_RETRIES):
            try:
                async with client.messages.stream(
                    model=MODEL,
                    max_tokens=8192,
                    system=system_block,
                    messages=[{"role": "user", "content": user_message}],
                ) as stream:
                    raw_text = ""
                    async for text in stream.text_stream:
                        raw_text += text
                        yield _sse_event("chunk", {"text": text})
                break  # Success, exit retry loop

            except (APIError, APIConnectionError) as exc:
                last_error = exc
                await logger.awarning(
                    "anthropic_api_retry",
                    attempt=api_attempt + 1,
                    error=str(exc),
                )
                if api_attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(BACKOFF_SECONDS[api_attempt])
        else:
            yield _sse_event(
                "error",
                {"message": f"AI 서비스 호출 실패 ({MAX_RETRIES}회 재시도 후): {last_error}"},
            )
            return

        # Parse response
        try:
            yaml_content, metadata = _parse_response(raw_text)
        except (ValueError, json.JSONDecodeError) as exc:
            await logger.aerror("generate_response_parse_error", error=str(exc))
            yield _sse_event("error", {"message": f"응답 형식 오류: {exc}"})
            return

        # Validate
        yield _sse_event(
            "status",
            {"phase": "validating", "attempt": validation_attempt + 1},
        )

        validate_result = await sdwc.validate_yaml(yaml_content)

        if validate_result.get("valid"):
            await logger.ainfo(
                "generate_validation_passed",
                attempt=validation_attempt + 1,
            )
            card_data = metadata.get("architecture_card", {})
            features_data = metadata.get("feature_checklist", [])

            result = GenerateResponse(
                yaml_content=yaml_content,
                architecture_card=ArchitectureCard.model_validate(card_data),
                feature_checklist=[
                    FeatureItem.model_validate(f) for f in features_data
                ],
            )
            yield _sse_event("result", result.model_dump())
            return

        error_info = validate_result.get("errors", [])
        error_feedback = json.dumps(error_info, ensure_ascii=False)
        await logger.awarning(
            "generate_validation_failed",
            attempt=validation_attempt + 1,
            error=error_feedback,
        )

        if validation_attempt < MAX_VALIDATION_RETRIES:
            yield _sse_event(
                "status",
                {
                    "phase": "retry",
                    "attempt": validation_attempt + 2,
                    "max_attempts": MAX_VALIDATION_RETRIES + 1,
                    "reason": "validation_failed",
                },
            )

    yield _sse_event(
        "error",
        {"message": f"YAML 검증이 {MAX_VALIDATION_RETRIES + 1}회 시도 후 실패했습니다."},
    )


async def generate(
    client: AsyncAnthropic,
    sdwc: SDwCClient,
    request: GenerateRequest,
) -> GenerateResponse:
    """Generate intake_data.yaml from user input and Q&A answers."""
    template = template_cache.get_template()
    field_requirements = template_cache.get_field_requirements()
    system_prompt = build_system_prompt(template, field_requirements)

    qa_dicts = [a.model_dump() for a in request.qa_answers]
    error_feedback: str | None = None

    for validation_attempt in range(MAX_VALIDATION_RETRIES + 1):
        user_message = build_user_message(
            user_input=request.user_input,
            qa_answers=qa_dicts,
            template=template,
            revision_request=request.revision_request,
            previous_yaml=request.previous_yaml,
            error_feedback=error_feedback,
        )

        raw_text = await _call_anthropic(client, system_prompt, user_message)

        try:
            yaml_content, metadata = _parse_response(raw_text)
        except (ValueError, json.JSONDecodeError) as exc:
            await logger.aerror("generate_response_parse_error", error=str(exc))
            raise ExternalServiceError("Anthropic", f"Invalid response format: {exc}") from exc

        validate_result = await sdwc.validate_yaml(yaml_content)

        if validate_result.get("valid"):
            await logger.ainfo(
                "generate_validation_passed",
                attempt=validation_attempt + 1,
            )
            card_data = metadata.get("architecture_card", {})
            features_data = metadata.get("feature_checklist", [])

            return GenerateResponse(
                yaml_content=yaml_content,
                architecture_card=ArchitectureCard.model_validate(card_data),
                feature_checklist=[FeatureItem.model_validate(f) for f in features_data],
            )

        error_info = validate_result.get("errors", [])
        error_feedback = json.dumps(error_info, ensure_ascii=False)
        await logger.awarning(
            "generate_validation_failed",
            attempt=validation_attempt + 1,
            error=error_feedback,
        )

    raise ExternalServiceError(
        "SDwC",
        f"YAML validation failed after {MAX_VALIDATION_RETRIES + 1} attempts",
    )
