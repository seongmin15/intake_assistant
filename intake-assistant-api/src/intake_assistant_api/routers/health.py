from fastapi import APIRouter

from intake_assistant_api.schemas.health import HealthResponse
from intake_assistant_api.services import template_cache

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health() -> HealthResponse:
    reachable = template_cache.is_loaded()
    return HealthResponse(
        status="healthy" if reachable else "degraded",
        sdwc_reachable=reachable,
    )
