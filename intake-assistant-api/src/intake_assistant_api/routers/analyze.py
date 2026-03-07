from fastapi import APIRouter, Request

from intake_assistant_api.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from intake_assistant_api.services import analyze_service

router = APIRouter(prefix="/api/v1", tags=["analyze"])


@router.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest) -> AnalyzeResponse:
    client = request.app.state.anthropic
    return await analyze_service.analyze(client, body.user_input)
