from pydantic import BaseModel, Field


class QaAnswer(BaseModel):
    question_id: str
    selected_ids: list[str]


class GenerateRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=5000)
    qa_answers: list[QaAnswer] = Field(..., min_length=1)
    revision_request: str | None = Field(default=None, max_length=2000)
    previous_yaml: str | None = None


class ArchitectureCard(BaseModel):
    service_composition: str
    data_storage: str
    authentication: str
    external_services: str
    screen_count: str


class FeatureItem(BaseModel):
    name: str
    summary: str


class GenerateResponse(BaseModel):
    yaml_content: str
    architecture_card: ArchitectureCard
    feature_checklist: list[FeatureItem]
