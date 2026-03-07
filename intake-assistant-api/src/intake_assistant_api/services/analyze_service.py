import asyncio
import json
import re
from collections.abc import AsyncGenerator

import structlog
from anthropic import APIConnectionError, APIError, AsyncAnthropic
from pydantic import ValidationError as PydanticValidationError

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.analyze import AnalyzeResponse
from intake_assistant_api.services.prompts.analyze import ANALYZE_SYSTEM_PROMPT

logger = structlog.get_logger()

MAX_RETRIES = 3
BACKOFF_SECONDS = [1, 2, 4]
MODEL = "claude-haiku-4-5-20251001"


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _strip_code_block(text: str) -> str:
    """Strip markdown code block wrapper if present."""
    block_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
    if block_match:
        return block_match.group(1)
    return text


async def analyze_stream(
    client: AsyncAnthropic,
    user_input: str,
) -> AsyncGenerator[str, None]:
    """Stream analyze results via SSE events."""
    yield _sse_event("status", {"phase": "analyzing"})

    raw_text = ""
    last_error: Exception | None = None

    for api_attempt in range(MAX_RETRIES):
        try:
            async with client.messages.stream(
                model=MODEL,
                max_tokens=2048,
                system=ANALYZE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_input}],
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
        cleaned = _strip_code_block(raw_text)
        data = json.loads(cleaned)
        result = AnalyzeResponse.model_validate(data)
        yield _sse_event("result", result.model_dump())
    except (json.JSONDecodeError, KeyError, IndexError, PydanticValidationError) as exc:
        await logger.aerror("analyze_response_parse_error", error=str(exc))
        yield _sse_event("error", {"message": f"응답 형식 오류: {exc}"})


async def analyze(client: AsyncAnthropic, user_input: str) -> AnalyzeResponse:
    """Call Haiku to generate dynamic questions from user's free-text input."""
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=2048,
                system=ANALYZE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_input}],
            )

            text = response.content[0].text  # type: ignore[union-attr]
            text = _strip_code_block(text)
            data = json.loads(text)
            return AnalyzeResponse.model_validate(data)

        except (APIError, APIConnectionError) as exc:
            last_error = exc
            await logger.awarning(
                "anthropic_api_retry",
                attempt=attempt + 1,
                error=str(exc),
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(BACKOFF_SECONDS[attempt])

        except (json.JSONDecodeError, KeyError, IndexError, PydanticValidationError) as exc:
            await logger.aerror("anthropic_response_parse_error", error=str(exc))
            raise ExternalServiceError("Anthropic", f"Invalid response format: {exc}") from exc

    raise ExternalServiceError("Anthropic", f"Failed after {MAX_RETRIES} retries: {last_error}")
