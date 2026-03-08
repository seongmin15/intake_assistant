import structlog
from fastapi import APIRouter, Request

from intake_assistant_api.schemas.validate import ValidateYamlRequest, ValidateYamlResponse

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1", tags=["validate"])


@router.post("/validate-yaml", response_model=ValidateYamlResponse)
async def validate_yaml(body: ValidateYamlRequest, request: Request) -> ValidateYamlResponse:
    """Validate YAML content against SDwC schema."""
    sdwc_client = request.app.state.sdwc_client

    try:
        result = await sdwc_client.validate_yaml(body.yaml_content)
        valid = result.get("valid", False)
        errors_raw = result.get("errors", [])
        warnings_raw = result.get("warnings", [])

        # Flatten errors — SDwC may return dict or list
        errors: list[str] = []
        if isinstance(errors_raw, dict):
            for key, msgs in errors_raw.items():
                if isinstance(msgs, list):
                    for msg in msgs:
                        errors.append(f"{key}: {msg}")
                else:
                    errors.append(f"{key}: {msgs}")
        elif isinstance(errors_raw, list):
            errors = [str(e) for e in errors_raw]

        warnings: list[str] = []
        if isinstance(warnings_raw, dict):
            for key, msgs in warnings_raw.items():
                if isinstance(msgs, list):
                    for msg in msgs:
                        warnings.append(f"{key}: {msg}")
                else:
                    warnings.append(f"{key}: {msgs}")
        elif isinstance(warnings_raw, list):
            warnings = [str(w) for w in warnings_raw]

        return ValidateYamlResponse(valid=valid, errors=errors, warnings=warnings)
    except Exception:
        await logger.aexception("validate_yaml_failed")
        return ValidateYamlResponse(
            valid=False,
            errors=["SDwC 검증 서버에 연결할 수 없습니다."],
            warnings=[],
        )
