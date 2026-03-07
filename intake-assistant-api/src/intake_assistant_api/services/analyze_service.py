import asyncio
import json
import re

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
            # Strip markdown code block wrapper if present
            block_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
            if block_match:
                text = block_match.group(1)
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
