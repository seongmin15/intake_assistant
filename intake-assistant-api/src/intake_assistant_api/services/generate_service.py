import asyncio
import json
import re

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

MAX_RETRIES = 3
BACKOFF_SECONDS = [1, 2, 4]
MAX_VALIDATION_RETRIES = 2
MODEL = "claude-sonnet-4-6"


def _parse_response(text: str) -> tuple[str, dict]:
    """Extract YAML block and JSON metadata block from LLM response."""
    yaml_match = re.search(r"```yaml\s*\n(.*?)```", text, re.DOTALL)
    if not yaml_match:
        raise ValueError("No YAML block found in response")

    json_match = re.search(r"```json\s*\n(.*?)```", text, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON block found in response")

    yaml_content = yaml_match.group(1).strip()
    metadata: dict = json.loads(json_match.group(1).strip())
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
                system=system_prompt,
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


async def generate(
    client: AsyncAnthropic,
    sdwc: SDwCClient,
    request: GenerateRequest,
) -> GenerateResponse:
    """Generate intake_data.yaml from user input and Q&A answers."""
    template = template_cache.get_template()
    system_prompt = build_system_prompt(template)

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
