from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

from intake_assistant_api.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from intake_assistant_api.services import analyze_service

router = APIRouter(prefix="/api/v1", tags=["analyze"])


@router.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest) -> AnalyzeResponse:
    client = request.app.state.anthropic
    return await analyze_service.analyze(client, body.user_input)


@router.post("/analyze/stream")
async def analyze_stream(request: Request, body: AnalyzeRequest) -> StreamingResponse:
    client = request.app.state.anthropic
    return StreamingResponse(
        analyze_service.analyze_stream(client, body.user_input),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
