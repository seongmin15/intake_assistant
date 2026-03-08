from typing import Any

from pydantic import BaseModel, Field


class FieldInfo(BaseModel):
    description: str | None = None
    enum_values: list[str] | None = None
    field_type: str | None = None


class RecommendRequest(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)
    field_path: str = Field(..., min_length=1, max_length=200)
    field_info: FieldInfo = Field(default_factory=FieldInfo)


class RecommendResponse(BaseModel):
    suggestion: str
    rationale: str
