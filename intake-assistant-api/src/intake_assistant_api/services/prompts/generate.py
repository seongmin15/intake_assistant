from intake_assistant_api.services.prompts.prompt_builder import build_dynamic_sections

_STATIC_HEADER = """\
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

5. **Cross-reference rule**: Each entry in `collaboration.per_service[].service`
   must exactly match a `services[].name`. They must be 1:1 — same count, same names.

"""

_STATIC_FALLBACK = """\
## Required Sections Checklist

The following top-level sections are REQUIRED and must always be present.
Required child fields are shown in parentheses.

- project (name, one_liner, elevator_pitch)
- problem (statement, who_has_this_problem, severity, frequency,
  current_workaround, workaround_pain_points[≥1])
- motivation (why_now)
- value_proposition (core_value, unique_differentiator)
- goals (primary[≥1], success_scenario)
  - each primary item: goal, measurable_criterion, priority
- non_goals[≥1] (each: statement, rationale)
- scope
  - in_scope[≥1] (each: feature, user_story, priority)
  - out_of_scope[≥1] (each: feature, reason)
- assumptions[≥1] (each: assumption, if_wrong)
- user_personas[≥1] (each: name, description, primary_goal, pain_points[≥1])
- collaboration (human_developers, review_policy, model_routing.primary,
  use_subagent, absolute_rules[≥1], per_service[≥1])
  - each per_service: service, mode, test_case_coverage, decision_authority
  - decision_authority: claude_autonomous[≥1], requires_approval[≥1]
- architecture (pattern, pattern_rationale, pattern_alternatives[≥1])
  - each pattern_alternative: pattern, pros, cons, rejection_reason
- services[≥1] (see Per-Service Type Required Fields below)
- critical_flows[≥1] (each: flow_name, happy_path)
- security (requirements[≥1])
  - each requirement: category, requirement, implementation_approach
- risks
  - technical[≥1] (each: risk, likelihood, impact, mitigation, contingency)
  - irreversible_decisions[≥1] (each: decision, why_irreversible,
    confidence_level, reversal_cost)
- performance (expected_concurrent_users)
- process (methodology)
- testing (approach, levels[≥1])
  - each level: level, framework
- version_control (branch_strategy)

## Per-Service Type Required Fields

All service types share: name, type, responsibility, build_tool, deployment.target

### backend_api
- language, framework, api_style, auth.method
- When api_style is "rest": endpoints[] (each: method, path, summary)
- When api_style is "graphql": graphql section
- When api_style is "grpc": grpc section

### web_ui
- language, framework, css_strategy, state_management, rendering_strategy
- pages[≥1] (each: name, purpose, connected_endpoints)

### worker
- language, framework
- workers[≥1] (each: name, responsibility, trigger_type, trigger_config, idempotent)

### mobile_app
- language, framework, approach, min_os_versions
- screens[≥1] (each: name, purpose, key_interactions, connected_endpoints,
  states, components[])

### data_pipeline
- language, framework
- pipelines[≥1] (each: name, responsibility, type, sources[],
  sinks[], schedule)
  - each source: name, system
  - each sink: name, system

## Array Minimum Requirements

These array fields require at least 1 item:
- problem.workaround_pain_points
- goals.primary, non_goals, scope.in_scope, scope.out_of_scope, assumptions
- user_personas, user_personas[].pain_points
- collaboration.absolute_rules, collaboration.per_service
- collaboration.per_service[].decision_authority.claude_autonomous
- collaboration.per_service[].decision_authority.requires_approval
- architecture.pattern_alternatives, services
- services[web_ui].pages, services[mobile_app].screens
- services[worker].workers, services[data_pipeline].pipelines
- critical_flows, security.requirements
- risks.technical, risks.irreversible_decisions
- testing.levels

## Enum Value Reference

Use ONLY these exact values for enum fields:

### General
- problem.severity: high | medium | low
- problem.frequency: daily | weekly | monthly | occasional
- scope.in_scope[].priority: must | should | could
- scope.in_scope[].complexity_estimate: S | M | L | XL
- scope.out_of_scope[].planned_phase: v2 | v3 | post_launch | backlog
- goals.primary[].priority: P0 | P1 | P2
- user_personas[].tech_proficiency: beginner | intermediate | expert
- user_personas[].usage_frequency: daily | weekly | monthly

### Collaboration
- per_service[].mode: autonomous | collaborative | learning
- per_service[].test_case_coverage: basic | standard | thorough

### Architecture
- architecture.pattern: monolith | microservices | modular_monolith
- architecture.internal_style: hexagonal | clean | layered | none

### Services (shared)
- services[].type: backend_api | web_ui | worker | mobile_app | data_pipeline
- services[].build_tool: poetry | pip | npm | pnpm | yarn | gradle | \
  maven | cargo | go_mod | vite | webpack | turbopack | bundler | sbt
- services[].deployment.target: docker_compose | kubernetes | ecs | \
  lambda | cloud_run | fly_io | railway | vercel | bare_metal | \
  app_store | play_store | both_stores
- services[].databases[].engine: postgresql | mysql | mongodb | redis | \
  sqlite | dynamodb | elasticsearch | neo4j
- services[].databases[].role: primary | cache | search | queue | analytics | session
- services[].communication_with[].protocol: http | grpc | amqp | kafka | websocket
- services[].communication_with[].sync_async: sync | async

### backend_api
- language: python | typescript | java | go | rust | ruby | csharp | kotlin
- framework: fastapi | django | express | nestjs | spring | gin | actix | rails | aspnet
- api_style: rest | graphql | grpc
- auth.method: jwt | session | api_key | oauth2 | none
- api_versioning: url_prefix | header | query_param | none
- pagination: cursor | offset | none
- error_response_format: rfc7807 | custom | graphql_errors
- endpoints[].method: GET | POST | PUT | PATCH | DELETE
- file_storage.strategy: local | s3 | gcs | azure_blob

### web_ui
- language: typescript | javascript
- framework: react | vue | svelte | next | nuxt | angular | solid | astro
- css_strategy: tailwind | css_modules | styled_components | sass | vanilla_css | emotion
- state_management: zustand | redux | recoil | jotai | context | pinia | mobx
- rendering_strategy: spa | ssr | ssg | isr
- accessibility_level: wcag_aa | wcag_aaa | basic | none
- responsive_strategy: mobile_first | desktop_first

### worker
- language: python | typescript | java | kotlin | ruby | go
- framework: celery | bullmq | sidekiq | spring_batch | temporal
- workers[].trigger_type: queue | cron | event | webhook
- workers[].overlap_policy: skip | queue | parallel

### mobile_app
- approach: native | cross_platform | hybrid
- framework: react_native | flutter | swift | kotlin_mobile | swiftui | jetpack_compose
- navigation_pattern: tab | drawer | stack | bottom_nav
- local_storage: sqlite | realm | async_storage | mmkv | core_data
- distribution: app_store | play_store | enterprise | both_stores | testflight
- update_strategy: force | soft | in_app | code_push

### data_pipeline
- language: python | java | scala | sql
- framework: airflow | dagster | prefect | spark | dbt | flink
- pipelines[].type: batch | streaming | micro_batch | hybrid
- pipelines[].schedule: cron | real_time | trigger_based
- pipelines[].sources[].extraction_method: full | incremental | cdc | api_poll
- pipelines[].sources[].format: json | csv | parquet | avro | protobuf | xml
- pipelines[].sinks[].load_method: upsert | append | overwrite | merge
- pipelines[].quality_checks[].on_failure: abort | warn | quarantine
- pipelines[].partial_failure_strategy: skip_bad | fail_all | dead_letter
- pipelines[].schema_change_handling: auto_detect | fail | alert

### Security / Risks
- security.requirements[].category: authentication | authorization | \
  encryption | input_validation | audit | transport_security
- risks.technical[].likelihood: high | medium | low
- risks.technical[].impact: high | medium | low
- risks.irreversible_decisions[].confidence_level: high | medium | low

### Process / Testing / Version Control
- process.methodology: scrum | kanban | scrumban | xp
- testing.approach: tdd | bdd | test_after | test_first
- testing.levels[].level: unit | integration | e2e | contract | smoke | performance
- testing.levels[].framework: pytest | jest | vitest | playwright | cypress | \
  junit | go_test | rspec | xctest | espresso | robolectric | flutter_test | detox
- testing.test_data_strategy: fixtures | factories | snapshots | seed_scripts
- version_control.branch_strategy: github_flow | gitflow | trunk_based | master_develop_task
- version_control.commit_convention: conventional | gitmoji | angular | free

### Deployment (optional section — include only when relevant)
- deployment.environments[].name: dev | staging | production
- deployment.ci.tool: github_actions | gitlab_ci | jenkins | circleci | \
  bitbucket_pipelines | xcode_cloud | bitrise | codemagic
- deployment.cd.tool: argocd | fluxcd | spinnaker | none | fastlane | app_center
- deployment.cd.strategy: gitops | push | manual
- deployment.infrastructure_as_code.tool: terraform | pulumi | cdk | cloudformation | ansible
- deployment.container_registry: dockerhub | ecr | gcr | ghcr | acr
- deployment.secrets_management: env_file | vault | aws_ssm | doppler | infisical
"""

_STATIC_FOOTER = """\
## Common Mistakes to Avoid

WRONG — empty string for required field:
  project:
    name: ""

WRONG — empty array for required array:
  non_goals: []

WRONG — inventing enum values not in the list:
  problem:
    severity: "critical"   # WRONG, use "high"
  architecture:
    pattern: "serverless"  # WRONG, not a valid value

WRONG — including optional block with empty sub-fields:
  constraints:
    - constraint: ""       # DELETE the entire constraints block instead

WRONG — mismatched per_service and services names:
  services:
    - name: "my-api"
  collaboration:
    per_service:
      - service: "api"     # WRONG, must be "my-api"

WRONG — missing test_case_coverage or decision_authority in per_service:
  collaboration:
    per_service:
      - service: "my-api"
        mode: autonomous
        # MUST also include: test_case_coverage (enum),
        # decision_authority with claude_autonomous[] + requires_approval[]

WRONG — web_ui service missing pages:
  services:
    - name: "my-web"
      type: web_ui
      # MUST also include: pages (at least 1, each with name, purpose, connected_endpoints)

WRONG — worker service missing workers:
  services:
    - name: "my-worker"
      type: worker
      # MUST include: workers (at least 1, each with name, responsibility,
      # trigger_type, trigger_config, idempotent)

WRONG — mobile_app service missing required fields:
  services:
    - name: "my-app"
      type: mobile_app
      # MUST include: responsibility, approach, framework,
      # min_os_versions, screens (at least 1 with name, purpose,
      # key_interactions, connected_endpoints, states, components)

WRONG — security requirement missing required fields:
  security:
    requirements:
      - requirement: "JWT 인증"
      # MUST also include: category (from enum), implementation_approach

WRONG — irreversible_decision missing required fields:
  risks:
    irreversible_decisions:
      - decision: "PostgreSQL 선택"
      # MUST also include: why_irreversible, confidence_level (enum), reversal_cost

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
        parts.append(f"- {answer['question_id']}: {answer['answer']}")

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


def build_system_prompt(
    template: str | None,
    field_requirements: str | None = None,
) -> str:
    """Build the system prompt with template structure and dynamic field sections."""
    # Dynamic sections from field_requirements, or static fallback
    dynamic = build_dynamic_sections(field_requirements) if field_requirements is not None else None

    schema_sections = dynamic if dynamic is not None else _STATIC_FALLBACK

    template_section = template if template else "(템플릿 없음 — 기본 구조를 사용하세요)"
    footer = _STATIC_FOOTER.format(template_structure=template_section)

    return _STATIC_HEADER + schema_sections + "\n" + footer
