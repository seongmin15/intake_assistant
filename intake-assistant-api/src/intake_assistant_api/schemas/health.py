from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    sdwc_reachable: bool
