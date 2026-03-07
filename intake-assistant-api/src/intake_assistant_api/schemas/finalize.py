from pydantic import BaseModel, Field


class FinalizeRequest(BaseModel):
    yaml_content: str = Field(..., min_length=1)
