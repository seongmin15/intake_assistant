import structlog
from fastapi import APIRouter

from intake_assistant_api.schemas.schema_meta import SchemaMetaResponse
from intake_assistant_api.services import template_cache
from intake_assistant_api.services.template_parser import (
    compute_template_hash,
    parse_field_requirements,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1", tags=["schema-meta"])


@router.get("/schema-meta", response_model=SchemaMetaResponse)
async def schema_meta() -> SchemaMetaResponse:
    """Return template metadata for frontend schema drift detection."""
    fr_yaml = template_cache.get_field_requirements()
    template_yaml = template_cache.get_template()

    # Compute hash from the raw template text (or field_requirements as fallback)
    hash_source = template_yaml or fr_yaml or ""
    template_hash = compute_template_hash(hash_source) if hash_source else ""

    # Parse field_requirements for structured metadata
    if fr_yaml:
        meta = parse_field_requirements(fr_yaml)
        if meta is not None:
            return SchemaMetaResponse(
                template_hash=template_hash,
                service_types=meta["service_types"],
                enum_fields=meta["enum_fields"],
                required_fields=meta["required_fields"],
            )

    # Fallback: return empty metadata when templates are unavailable
    await logger.awarning("schema_meta_fallback", reason="field_requirements unavailable")
    return SchemaMetaResponse(
        template_hash=template_hash,
        service_types=[],
        enum_fields={},
        required_fields=[],
    )
