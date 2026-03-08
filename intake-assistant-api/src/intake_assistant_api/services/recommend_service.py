import asyncio
import json
import re

import structlog
from anthropic import APIConnectionError, APIError, AsyncAnthropic

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.schemas.recommend import RecommendRequest, RecommendResponse
from intake_assistant_api.services.prompts.recommend import RECOMMEND_SYSTEM_PROMPT

logger = structlog.get_logger()

MAX_RETRIES = 2
BACKOFF_SECONDS = [1, 2]
MODEL = "claude-haiku-4-5-20251001"


def _strip_code_block(text: str) -> str:
    """Strip markdown code block wrapper if present."""
    block_match = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)
    if block_match:
        return block_match.group(1)
    return text


def _build_user_message(req: RecommendRequest) -> str:
    """Build user message from recommend request."""
    parts = [
        f"## Context\n```json\n{json.dumps(req.context, ensure_ascii=False, indent=2)}\n```",
        f"\n## Field to recommend\n- **path**: `{req.field_path}`",
    ]
    if req.field_info.description:
        parts.append(f"- **description**: {req.field_info.description}")
    if req.field_info.enum_values:
        parts.append(f"- **allowed values**: {', '.join(req.field_info.enum_values)}")
    if req.field_info.field_type:
        parts.append(f"- **type**: {req.field_info.field_type}")
    return "\n".join(parts)


async def recommend(client: AsyncAnthropic, req: RecommendRequest) -> RecommendResponse:
    """Call Haiku to recommend a value for a single field."""
    user_message = _build_user_message(req)
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=256,
                system=RECOMMEND_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )

            text = response.content[0].text  # type: ignore[union-attr]
            text = _strip_code_block(text)
            data = json.loads(text)
            return RecommendResponse.model_validate(data)

        except (APIError, APIConnectionError) as exc:
            last_error = exc
            await logger.awarning(
                "recommend_api_retry",
                attempt=attempt + 1,
                error=str(exc),
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(BACKOFF_SECONDS[attempt])

        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            await logger.aerror("recommend_response_parse_error", error=str(exc))
            raise ExternalServiceError("Anthropic", f"Invalid response format: {exc}") from exc

    raise ExternalServiceError("Anthropic", f"Failed after {MAX_RETRIES} retries: {last_error}")
