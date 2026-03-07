from typing import Any

from pydantic import BaseModel, Field, field_validator

from intake_assistant_api.core.sanitizer import sanitize_text


class AnalyzeRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=5000)

    @field_validator("user_input", mode="before")
    @classmethod
    def sanitize_user_input(cls, v: str) -> str:
        if isinstance(v, str):
            return sanitize_text(v)
        return v


class Choice(BaseModel):
    id: str
    label: str


class Question(BaseModel):
    id: str
    title: str
    description: str
    type: str  # "single" | "multi"
    choices: list[Choice]


class Analysis(BaseModel):
    detected_keywords: list[str]
    inferred_hints: dict[str, Any]


class AnalyzeResponse(BaseModel):
    questions: list[Question]
    analysis: Analysis
