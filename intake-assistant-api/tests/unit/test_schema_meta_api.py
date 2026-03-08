"""Tests for GET /api/v1/schema-meta endpoint."""

import yaml

from intake_assistant_api.services import template_cache

_FIELD_REQUIREMENTS = {
    "phases": {
        "phase1_why": {
            "sections": {
                "problem": {
                    "requirement": "required",
                    "children": {
                        "severity": {
                            "requirement": "required",
                            "type": "str",
                            "enum": ["high", "medium", "low"],
                        },
                    },
                },
            },
        },
        "phase4_how": {
            "sections": {
                "services": {
                    "requirement": "required",
                    "children": {
                        "backend_api": {
                            "language": {
                                "requirement": "required",
                                "type": "str",
                                "enum": ["python", "typescript"],
                            },
                        },
                    },
                },
            },
        },
    },
}


async def test_schema_meta_with_field_requirements(client):
    """When field_requirements are cached, return parsed metadata."""
    template_cache.set_template("project:\n  name: test\n")
    template_cache.set_field_requirements(yaml.dump(_FIELD_REQUIREMENTS))
    try:
        resp = await client.get("/api/v1/schema-meta")
        assert resp.status_code == 200
        data = resp.json()

        assert data["template_hash"].startswith("sha256:")
        assert "backend_api" in data["service_types"]
        assert "problem.severity" in data["enum_fields"]
        assert data["enum_fields"]["problem.severity"] == ["high", "medium", "low"]
        assert "problem.severity" in data["required_fields"]
    finally:
        template_cache.clear()


async def test_schema_meta_without_field_requirements(client):
    """When field_requirements are not cached, return empty fallback."""
    template_cache.set_template("project:\n  name: test\n")
    try:
        resp = await client.get("/api/v1/schema-meta")
        assert resp.status_code == 200
        data = resp.json()

        assert data["template_hash"].startswith("sha256:")
        assert data["service_types"] == []
        assert data["enum_fields"] == {}
        assert data["required_fields"] == []
    finally:
        template_cache.clear()


async def test_schema_meta_no_templates(client):
    """When no templates are cached, return empty metadata."""
    template_cache.clear()
    resp = await client.get("/api/v1/schema-meta")
    assert resp.status_code == 200
    data = resp.json()

    assert data["template_hash"] == ""
    assert data["service_types"] == []
