from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

from intake_assistant_api.schemas.generate import GenerateRequest, GenerateResponse
from intake_assistant_api.services import generate_service

router = APIRouter(prefix="/api/v1", tags=["generate"])


@router.post("/generate")
async def generate(request: Request, body: GenerateRequest) -> GenerateResponse:
    client = request.app.state.anthropic
    sdwc = request.app.state.sdwc_client
    return await generate_service.generate(client, sdwc, body)


@router.post("/generate/stream")
async def generate_stream(request: Request, body: GenerateRequest) -> StreamingResponse:
    client = request.app.state.anthropic
    sdwc = request.app.state.sdwc_client
    return StreamingResponse(
        generate_service.generate_stream(client, sdwc, body),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
