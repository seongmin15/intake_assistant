import pytest

from intake_assistant_api.services.prompts.prompt_builder import build_dynamic_sections

MINIMAL_YAML = """\
version: '1.0'
phases:
  phase1:
    title: Test
    sections:
      project:
        requirement: required
        type: Project
        children:
          name:
            requirement: required
            type: str
          codename:
            requirement: optional
            type: str | None
            default: null
      problem:
        requirement: required
        type: Problem
        children:
          severity:
            requirement: required
            type: Severity
            enum:
              - high
              - medium
              - low
          pain_points:
            requirement: required
            type: list[str]
            min_length: 1
  phase2:
    title: How
    sections:
      services:
        requirement: required
        type: list[Annotated]
        min_length: 1
        children:
          backend_api:
            name:
              requirement: required
              type: str
            type:
              requirement: required
              type: Literal
            responsibility:
              requirement: required
              type: str
            language:
              requirement: required
              type: BackendLanguage
              enum:
                - python
                - typescript
            framework:
              requirement: required
              type: BackendFramework
              enum:
                - fastapi
                - django
            build_tool:
              requirement: required
              type: BuildTool
              enum:
                - poetry
                - pip
            deployment:
              requirement: required
              type: Deployment
              children:
                target:
                  requirement: required
                  type: DeployTarget
                  enum:
                    - docker_compose
                    - kubernetes
"""


def test_build_dynamic_sections_returns_string():
    """Valid YAML produces a non-empty string."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert result is not None
    assert isinstance(result, str)
    assert len(result) > 0


def test_build_dynamic_sections_contains_required_sections():
    """Output contains Required Sections Checklist header and entries."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert "## Required Sections Checklist" in result
    assert "- project" in result
    assert "- problem" in result


def test_build_dynamic_sections_contains_per_service():
    """Output contains Per-Service Type section with backend_api."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert "## Per-Service Type Required Fields" in result
    assert "### backend_api" in result
    assert "language" in result
    assert "framework" in result


def test_build_dynamic_sections_contains_array_minimums():
    """Output contains Array Minimum Requirements."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert "## Array Minimum Requirements" in result
    assert "pain_points" in result


def test_build_dynamic_sections_contains_enum_reference():
    """Output contains Enum Value Reference with actual values."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert "## Enum Value Reference" in result
    assert "high | medium | low" in result
    assert "python | typescript" in result
    assert "fastapi | django" in result


def test_build_dynamic_sections_services_listed():
    """services[≥1] line appears in required sections."""
    result = build_dynamic_sections(MINIMAL_YAML)
    assert "services[≥1]" in result


def test_build_dynamic_sections_invalid_yaml_returns_none():
    """Invalid YAML returns None for fallback."""
    result = build_dynamic_sections(":::\nnot: valid: yaml: {{{}}")
    assert result is None


def test_build_dynamic_sections_missing_phases_returns_none():
    """YAML without 'phases' key returns None."""
    result = build_dynamic_sections("version: '1.0'\nsomething_else: true\n")
    assert result is None


def test_build_dynamic_sections_empty_string_returns_none():
    """Empty string returns None."""
    result = build_dynamic_sections("")
    assert result is None


def test_build_dynamic_sections_non_dict_returns_none():
    """YAML that parses to non-dict (e.g., a list) returns None."""
    result = build_dynamic_sections("- item1\n- item2\n")
    assert result is None


@pytest.fixture
def real_field_requirements():
    """Load real field_requirements.yaml if available."""
    import os
    path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "..", "..", ".sdwc", "field_requirements.yaml"
    )
    # Try SDwC project path as well
    sdwc_path = "C:/SDwC_projects/SDwC/.sdwc/field_requirements.yaml"
    for p in [path, sdwc_path]:
        try:
            with open(p) as f:
                return f.read()
        except FileNotFoundError:
            continue
    pytest.skip("field_requirements.yaml not available")


def test_real_yaml_smoke_test(real_field_requirements):
    """Smoke test with the real field_requirements.yaml file."""
    result = build_dynamic_sections(real_field_requirements)
    assert result is not None
    assert "## Required Sections Checklist" in result
    assert "## Per-Service Type Required Fields" in result
    assert "## Array Minimum Requirements" in result
    assert "## Enum Value Reference" in result
    # Check some known fields from the real schema
    assert "project" in result
    assert "backend_api" in result
    assert "web_ui" in result
