from pydantic import BaseModel


class ValidateYamlRequest(BaseModel):
    yaml_content: str


class ValidateYamlResponse(BaseModel):
    valid: bool
    errors: list[str]
    warnings: list[str]
