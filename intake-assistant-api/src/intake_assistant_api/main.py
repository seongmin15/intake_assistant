import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
import structlog
from anthropic import AsyncAnthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

from intake_assistant_api.core import rate_limiter
from intake_assistant_api.core.config import settings
from intake_assistant_api.core.exceptions import AppError, RateLimitError, app_error_handler
from intake_assistant_api.routers.analyze import router as analyze_router
from intake_assistant_api.routers.finalize import router as finalize_router
from intake_assistant_api.routers.generate import router as generate_router
from intake_assistant_api.routers.health import router as health_router
from intake_assistant_api.services import template_cache
from intake_assistant_api.services.sdwc_client import SDwCClient

logger = structlog.get_logger()

_RATE_LIMIT_SKIP_PATHS = {"/api/v1/health"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: StarletteRequest, call_next: RequestResponseEndpoint,
    ) -> StarletteResponse:
        if request.url.path in _RATE_LIMIT_SKIP_PATHS:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        try:
            rate_limiter.check(client_ip)
        except RateLimitError as exc:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=429,
                content={"error": exc.message},
                headers={"Retry-After": str(exc.retry_after)},
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.dev.ConsoleRenderer()
            if settings.debug
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.debug else logging.INFO
        ),
    )
    await logger.ainfo("starting", app=settings.app_name)

    anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    _app.state.anthropic = anthropic_client

    http_client = httpx.AsyncClient()
    sdwc_client = SDwCClient(http_client, settings.sdwc_api_url)
    _app.state.sdwc_client = sdwc_client

    template_yaml = await sdwc_client.fetch_template()
    if template_yaml is not None:
        template_cache.set_template(template_yaml)
        await logger.ainfo("sdwc_template_cached")
    else:
        await logger.awarning("sdwc_template_unavailable, running in degraded mode")

    field_req_yaml = await sdwc_client.fetch_field_requirements()
    if field_req_yaml is not None:
        template_cache.set_field_requirements(field_req_yaml)
        await logger.ainfo("sdwc_field_requirements_cached")
    else:
        await logger.awarning("sdwc_field_requirements_unavailable, using static fallback")

    yield

    await anthropic_client.close()
    await sdwc_client.close()
    await logger.ainfo("shutting down", app=settings.app_name)


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(generate_router)
app.include_router(finalize_router)
