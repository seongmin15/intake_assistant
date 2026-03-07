GENERATE_SYSTEM_PROMPT = """\
You are an expert at generating SDwC intake_data.yaml files.
Your job is to convert a user's project description and Q&A answers
into a complete, valid intake_data.yaml.

## Critical Rules

1. **DELETE Principle**: If an optional field does not apply to the project,
   REMOVE THE ENTIRE FIELD (key + value) rather than leaving it empty.
   Empty values ("", {{}}, []) will trigger validation errors.
   Only include fields that have meaningful values.

2. **Required fields**: All required fields must be filled with appropriate values.

3. **Services**: Only include service types that the project actually needs.
   Available types: backend_api, web_ui, worker, mobile_app, data_pipeline.
   Delete the service type examples that are not used.

4. **Conditional sections**: REST endpoints only when api_style is "rest",
   GraphQL sections only when api_style is "graphql", etc.

## SDwC Template Structure Reference

{template_structure}

## Output Format

You MUST output exactly two blocks:

1. A YAML block with the complete intake_data.yaml content:
```yaml
<your yaml here>
```

2. A JSON block with architecture card and feature checklist:
```json
{{
  "architecture_card": {{
    "service_composition": "<N> services (<type>: <framework>, ...)",
    "data_storage": "<DB engine> (<role>)" or "없음",
    "authentication": "<method>" or "none",
    "external_services": "<service1>, <service2>" or "없음",
    "screen_count": "<N>개 화면" or "해당 없음"
  }},
  "feature_checklist": [
    {{"name": "<feature name>", "summary": "<brief description>"}},
    ...
  ]
}}
```

Rules for architecture_card:
- service_composition: List all services with their type and framework.
- data_storage: List databases with their roles. "없음" if no database.
- authentication: The auth method. "none" if no authentication.
- external_services: Third-party APIs or services. "없음" if none.
- screen_count: Number of pages/screens for web_ui/mobile_app. "해당 없음" if no UI service.

Rules for feature_checklist:
- Extract from scope.in_scope features in the YAML.
- Each item has a name and a one-line summary.

## Important

- Write all project content in Korean (descriptions, stories, etc.)
  since the user communicates in Korean.
- Be specific and realistic — fill in concrete values, not placeholders.
- Follow the template structure exactly. Do not invent new fields.
"""


def build_user_message(
    user_input: str,
    qa_answers: list[dict],
    template: str | None,
    revision_request: str | None = None,
    previous_yaml: str | None = None,
    error_feedback: str | None = None,
) -> str:
    """Build the user message for the generate prompt."""
    parts: list[str] = []

    parts.append(f"## 사용자 설명\n\n{user_input}")

    parts.append("\n## Q&A 응답\n")
    for answer in qa_answers:
        parts.append(f"- {answer['question_id']}: {', '.join(answer['selected_ids'])}")

    if revision_request and previous_yaml:
        parts.append(f"\n## 수정 요청\n\n{revision_request}")
        parts.append(f"\n## 이전 YAML\n\n```yaml\n{previous_yaml}\n```")
        parts.append(
            "\n위 YAML을 수정 요청 사항에 맞게 수정해주세요. "
            "변경이 필요 없는 부분은 그대로 유지하세요."
        )

    if error_feedback:
        parts.append(f"\n## Validation 에러 피드백\n\n{error_feedback}")
        parts.append("\n위 에러를 수정하여 유효한 YAML을 다시 생성해주세요.")

    return "\n".join(parts)


def build_system_prompt(template: str | None) -> str:
    """Build the system prompt with template structure included."""
    template_section = template if template else "(템플릿 없음 — 기본 구조를 사용하세요)"
    return GENERATE_SYSTEM_PROMPT.format(template_structure=template_section)
