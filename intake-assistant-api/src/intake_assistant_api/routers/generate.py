from fastapi import APIRouter, Request

from intake_assistant_api.schemas.generate import GenerateRequest, GenerateResponse
from intake_assistant_api.services import generate_service

router = APIRouter(prefix="/api/v1", tags=["generate"])


@router.post("/generate")
async def generate(request: Request, body: GenerateRequest) -> GenerateResponse:
    client = request.app.state.anthropic
    sdwc = request.app.state.sdwc_client
    return await generate_service.generate(client, sdwc, body)
