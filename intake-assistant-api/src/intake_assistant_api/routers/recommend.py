from fastapi import APIRouter, Request

from intake_assistant_api.schemas.recommend import RecommendRequest, RecommendResponse
from intake_assistant_api.services import recommend_service

router = APIRouter(prefix="/api/v1", tags=["recommend"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(request: Request, body: RecommendRequest) -> RecommendResponse:
    """Recommend a value for a single field using AI."""
    client = request.app.state.anthropic
    return await recommend_service.recommend(client, body)
