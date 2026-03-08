"""Tests for template_parser module."""

import yaml

from intake_assistant_api.services.template_parser import (
    compute_template_hash,
    extract_enum_fields,
    extract_required_fields,
    extract_service_types,
    parse_field_requirements,
)

# Minimal field_requirements fixture
_FIELD_REQUIREMENTS = {
    "phases": {
        "phase1_why": {
            "sections": {
                "project": {
                    "requirement": "required",
                    "children": {
                        "name": {"requirement": "required", "type": "str"},
                        "codename": {"requirement": "optional", "type": "str"},
                        "one_liner": {"requirement": "required", "type": "str"},
                    },
                },
                "problem": {
                    "requirement": "required",
                    "children": {
                        "severity": {
                            "requirement": "required",
                            "type": "str",
                            "enum": ["high", "medium", "low"],
                        },
                        "frequency": {
                            "requirement": "required",
                            "type": "str",
                            "enum": ["daily", "weekly", "monthly", "occasional"],
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
                                "enum": ["python", "typescript", "java", "go"],
                            },
                            "framework": {
                                "requirement": "required",
                                "type": "str",
                                "enum": ["fastapi", "django", "express"],
                            },
                        },
                        "web_ui": {
                            "framework": {
                                "requirement": "required",
                                "type": "str",
                                "enum": ["react", "vue", "svelte"],
                            },
                        },
                    },
                },
            },
        },
    },
}


def test_compute_template_hash():
    h = compute_template_hash("hello")
    assert h.startswith("sha256:")
    assert len(h) > 10

    # Same input → same hash
    assert compute_template_hash("hello") == h

    # Different input → different hash
    assert compute_template_hash("world") != h


def test_extract_service_types():
    phases = _FIELD_REQUIREMENTS["phases"]
    types = extract_service_types(phases)
    assert "backend_api" in types
    assert "web_ui" in types


def test_extract_enum_fields():
    phases = _FIELD_REQUIREMENTS["phases"]
    enums = extract_enum_fields(phases)

    assert "problem.severity" in enums
    assert enums["problem.severity"] == ["high", "medium", "low"]

    assert "problem.frequency" in enums
    assert "daily" in enums["problem.frequency"]

    # Service-scoped enums
    assert "services.backend_api.language" in enums
    assert "python" in enums["services.backend_api.language"]


def test_extract_required_fields():
    phases = _FIELD_REQUIREMENTS["phases"]
    required = extract_required_fields(phases)

    assert "project.name" in required
    assert "project.one_liner" in required
    assert "project.codename" not in required  # optional
    assert "problem.severity" in required


def test_parse_field_requirements():
    yaml_str = yaml.dump(_FIELD_REQUIREMENTS)
    result = parse_field_requirements(yaml_str)

    assert result is not None
    assert "service_types" in result
    assert "enum_fields" in result
    assert "required_fields" in result
    assert isinstance(result["enum_fields"], dict)


def test_parse_field_requirements_invalid_yaml():
    assert parse_field_requirements(":::invalid") is None


def test_parse_field_requirements_missing_phases():
    assert parse_field_requirements(yaml.dump({"foo": "bar"})) is None
