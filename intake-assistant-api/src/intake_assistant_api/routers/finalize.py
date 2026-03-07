from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from intake_assistant_api.schemas.finalize import FinalizeRequest

router = APIRouter(prefix="/api/v1", tags=["finalize"])


@router.post("/finalize")
async def finalize(request: Request, body: FinalizeRequest) -> StreamingResponse:
    sdwc = request.app.state.sdwc_client
    zip_bytes = await sdwc.generate_zip(body.yaml_content)
    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=project.zip"},
    )
