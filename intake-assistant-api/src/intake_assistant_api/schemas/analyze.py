from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=5000)


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
    inferred_hints: dict[str, str]


class AnalyzeResponse(BaseModel):
    questions: list[Question]
    analysis: Analysis
