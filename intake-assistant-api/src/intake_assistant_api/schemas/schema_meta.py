from pydantic import BaseModel


class SchemaMetaResponse(BaseModel):
    template_hash: str
    service_types: list[str]
    enum_fields: dict[str, list[str]]
    required_fields: list[str]
