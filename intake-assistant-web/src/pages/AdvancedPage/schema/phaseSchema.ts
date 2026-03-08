import type { PhaseDef } from "./fieldTypes";

export const phases: PhaseDef[] = [
  // ========================================================================
  // Phase 1: WHY — Project Identity
  // ========================================================================
  {
    id: 0,
    name: "WHY",
    tag: "WHY",
    description: "프로젝트 정체성 — 프로젝트, 문제, 동기, 가치 제안",
    sections: [
      {
        id: "project",
        title: "프로젝트 기본 정보",
        fields: [
          { path: "project.name", label: "프로젝트 이름", type: "text", required: true, placeholder: "my-awesome-app", aiRecommend: true },
          { path: "project.codename", label: "코드네임", type: "text", required: false, placeholder: "내부 코드네임 (선택)" },
          { path: "project.one_liner", label: "한줄 설명", type: "text", required: true, placeholder: "한 문장으로 프로젝트 설명", aiRecommend: true },
          { path: "project.elevator_pitch", label: "엘리베이터 피치", type: "textarea", required: true, placeholder: "2~3문장으로 프로젝트를 소개하세요", aiRecommend: true },
        ],
      },
      {
        id: "problem",
        title: "해결할 문제",
        fields: [
          { path: "problem.statement", label: "핵심 문제", type: "textarea", required: true, placeholder: "해결하려는 핵심 문제", aiRecommend: true },
          { path: "problem.who_has_this_problem", label: "누가 겪는 문제인가", type: "text", required: true, placeholder: "이 문제를 겪는 사람/그룹" },
          { path: "problem.severity", label: "심각도", type: "enum", required: true, enumValues: ["high", "medium", "low"], aiRecommend: true },
          { path: "problem.frequency", label: "발생 빈도", type: "enum", required: true, enumValues: ["daily", "weekly", "monthly", "occasional"] },
          { path: "problem.current_workaround", label: "현재 해결 방법", type: "textarea", required: true, placeholder: "현재 어떻게 이 문제를 해결하고 있는지" },
          {
            path: "problem.workaround_pain_points", label: "현재 방법의 문제점", type: "array", required: true,
            arrayItemFields: [{ path: "", label: "문제점", type: "text", required: true, placeholder: "현재 방법의 불편한 점" }],
          },
          { path: "problem.prior_attempts", label: "이전 시도", type: "textarea", required: false, placeholder: "이전에 시도한 방법과 실패 이유" },
        ],
      },
      {
        id: "motivation",
        title: "동기",
        fields: [
          { path: "motivation.why_now", label: "왜 지금인가", type: "textarea", required: true, placeholder: "지금 이 프로젝트를 시작하는 이유", aiRecommend: true },
          { path: "motivation.trigger_event", label: "촉발 이벤트", type: "text", required: false, placeholder: "프로젝트를 시작하게 된 계기" },
          { path: "motivation.opportunity_cost", label: "기회 비용", type: "textarea", required: false, placeholder: "만들지 않으면 잃는 것" },
          { path: "motivation.competitive_landscape", label: "경쟁 환경", type: "textarea", required: false, placeholder: "경쟁 제품/환경" },
          {
            path: "motivation.inspiration_references", label: "영감 레퍼런스", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "레퍼런스", type: "text", required: false, placeholder: "참고한 제품/서비스" }],
          },
        ],
      },
      {
        id: "value_proposition",
        title: "가치 제안",
        fields: [
          { path: "value_proposition.core_value", label: "핵심 가치", type: "text", required: true, placeholder: "한 문장으로 핵심 가치", aiRecommend: true },
          { path: "value_proposition.unique_differentiator", label: "차별점", type: "textarea", required: true, placeholder: "경쟁 제품 대비 차별점" },
          { path: "value_proposition.value_hypothesis", label: "가치 가설", type: "textarea", required: false, placeholder: "검증할 가설" },
        ],
      },
      {
        id: "project_characteristics",
        title: "프로젝트 특성",
        description: "기본 패턴을 오버라이드할 프로젝트 특성 (선택)",
        fields: [
          {
            path: "project_characteristics", label: "특성 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "label", label: "특성 이름", type: "text", required: true, placeholder: "예: Stateless" },
              { path: "description", label: "설명", type: "textarea", required: true, placeholder: "이 특성이 개발에 미치는 영향" },
            ],
          },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 2: WHAT — Goals and Scope
  // ========================================================================
  {
    id: 1,
    name: "WHAT",
    tag: "WHAT",
    description: "목표와 범위 — 목표, 비목표, 범위, 가정, 제약",
    sections: [
      {
        id: "goals",
        title: "목표",
        fields: [
          {
            path: "goals.primary", label: "핵심 목표", type: "array", required: true,
            arrayItemFields: [
              { path: "goal", label: "목표", type: "textarea", required: true, placeholder: "달성할 목표", aiRecommend: true },
              { path: "measurable_criterion", label: "측정 기준", type: "text", required: true, placeholder: "어떻게 달성 여부를 측정할지" },
              { path: "priority", label: "우선순위", type: "enum", required: true, enumValues: ["P0", "P1", "P2"] },
            ],
          },
          { path: "goals.success_scenario", label: "성공 시나리오", type: "textarea", required: true, placeholder: "성공하면 어떤 모습인지 구체적으로", aiRecommend: true },
          {
            path: "goals.success_metrics", label: "성공 지표", type: "array", required: false,
            arrayItemFields: [
              { path: "metric", label: "지표", type: "text", required: true },
              { path: "current_value", label: "현재 값", type: "text", required: true },
              { path: "target_value", label: "목표 값", type: "text", required: true },
              { path: "measurement_method", label: "측정 방법", type: "text", required: true },
            ],
          },
        ],
      },
      {
        id: "non_goals",
        title: "비목표",
        fields: [
          {
            path: "non_goals", label: "비목표 목록", type: "array", required: true,
            arrayItemFields: [
              { path: "statement", label: "비목표", type: "textarea", required: true, placeholder: "하지 않을 것" },
              { path: "rationale", label: "근거", type: "textarea", required: true, placeholder: "왜 비목표인지" },
              { path: "reconsider_when", label: "재검토 시점", type: "text", required: false, placeholder: "언제 재검토할지" },
            ],
          },
        ],
      },
      {
        id: "scope",
        title: "범위",
        fields: [
          {
            path: "scope.in_scope", label: "포함 기능", type: "array", required: true,
            arrayItemFields: [
              { path: "feature", label: "기능", type: "text", required: true },
              { path: "user_story", label: "사용자 스토리", type: "textarea", required: true, placeholder: "사용자가 ~한다" },
              { path: "priority", label: "우선순위", type: "enum", required: true, enumValues: ["must", "should", "could"] },
              { path: "complexity_estimate", label: "복잡도", type: "enum", required: false, enumValues: ["S", "M", "L", "XL"] },
            ],
          },
          {
            path: "scope.out_of_scope", label: "제외 기능", type: "array", required: true,
            arrayItemFields: [
              { path: "feature", label: "기능", type: "text", required: true },
              { path: "reason", label: "제외 사유", type: "textarea", required: true },
              { path: "planned_phase", label: "예정 시점", type: "enum", required: false, enumValues: ["v2", "v3", "post_launch", "backlog"] },
            ],
          },
        ],
      },
      {
        id: "assumptions",
        title: "가정",
        fields: [
          {
            path: "assumptions", label: "가정 목록", type: "array", required: true,
            arrayItemFields: [
              { path: "assumption", label: "가정", type: "textarea", required: true },
              { path: "if_wrong", label: "틀리면?", type: "textarea", required: true },
              { path: "validation_plan", label: "검증 계획", type: "text", required: false },
            ],
          },
        ],
      },
      {
        id: "constraints",
        title: "제약 조건",
        fields: [
          {
            path: "constraints", label: "제약 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "constraint", label: "제약", type: "textarea", required: true },
              { path: "source", label: "출처", type: "enum", required: false, enumValues: ["technical", "business", "legal", "regulatory"] },
              { path: "negotiable", label: "협상 가능", type: "enum", required: false, enumValues: ["yes", "no", "partially"] },
            ],
          },
        ],
      },
      {
        id: "timeline",
        title: "일정",
        fields: [
          { path: "timeline.deadline", label: "마감일", type: "text", required: false, placeholder: "예: 2026-06-30" },
          { path: "timeline.reason", label: "사유", type: "text", required: false },
          { path: "timeline.flexibility", label: "유연성", type: "enum", required: false, enumValues: ["rigid", "flexible", "aspirational"] },
        ],
      },
      {
        id: "budget",
        title: "예산",
        fields: [
          { path: "budget.monthly_budget", label: "월 예산", type: "text", required: false },
          { path: "budget.one_time_budget", label: "일회성 예산", type: "text", required: false },
          {
            path: "budget.constraint_items", label: "예산 제약", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "항목", type: "text", required: false }],
          },
        ],
      },
      {
        id: "glossary",
        title: "용어집",
        fields: [
          {
            path: "glossary", label: "용어 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "term", label: "용어", type: "text", required: true },
              { path: "definition", label: "정의", type: "textarea", required: true },
              { path: "aliases", label: "동의어", type: "text", required: false },
              { path: "example", label: "사용 예시", type: "text", required: false },
            ],
          },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 3: WHO — Users and Collaboration
  // ========================================================================
  {
    id: 2,
    name: "WHO",
    tag: "WHO",
    description: "사용자, 이해관계자, AI 협업 설정",
    sections: [
      {
        id: "user_personas",
        title: "사용자 페르소나",
        fields: [
          {
            path: "user_personas", label: "페르소나 목록", type: "array", required: true,
            arrayItemFields: [
              { path: "name", label: "이름", type: "text", required: true, placeholder: "예: 비개발자 기획자" },
              { path: "description", label: "설명", type: "textarea", required: true },
              { path: "primary_goal", label: "주요 목표", type: "text", required: true },
              {
                path: "pain_points", label: "불편 사항", type: "array", required: true,
                arrayItemFields: [{ path: "", label: "항목", type: "text", required: true }],
              },
              { path: "is_primary", label: "주요 페르소나", type: "boolean", required: false, defaultValue: false },
              { path: "tech_proficiency", label: "기술 숙련도", type: "enum", required: false, enumValues: ["beginner", "intermediate", "expert"] },
              { path: "usage_frequency", label: "사용 빈도", type: "enum", required: false, enumValues: ["daily", "weekly", "monthly"] },
            ],
          },
        ],
      },
      {
        id: "anti_personas",
        title: "안티 페르소나",
        description: "이 서비스의 대상이 아닌 사용자",
        fields: [
          {
            path: "anti_personas", label: "안티 페르소나 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "name", label: "이름", type: "text", required: true },
              { path: "reason", label: "대상 아닌 이유", type: "textarea", required: true },
            ],
          },
        ],
      },
      {
        id: "stakeholders",
        title: "이해관계자",
        fields: [
          {
            path: "stakeholders", label: "이해관계자 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "role", label: "역할", type: "text", required: true },
              { path: "concern", label: "관심사", type: "text", required: true },
              { path: "influence_level", label: "영향력", type: "enum", required: false, enumValues: ["high", "medium", "low"] },
            ],
          },
        ],
      },
      {
        id: "collaboration",
        title: "AI 협업 설정",
        fields: [
          { path: "collaboration.human_developers", label: "인간 개발자 수", type: "number", required: true, defaultValue: 1 },
          { path: "collaboration.review_policy", label: "리뷰 정책", type: "text", required: true, placeholder: "예: review after every task" },
          { path: "collaboration.model_routing.primary", label: "주 모델", type: "text", required: true, placeholder: "예: opus" },
          { path: "collaboration.model_routing.secondary", label: "보조 모델", type: "text", required: false, placeholder: "예: sonnet" },
          { path: "collaboration.model_routing.routing_rule", label: "라우팅 규칙", type: "text", required: false },
          { path: "collaboration.use_subagent", label: "서브에이전트 사용", type: "boolean", required: true, defaultValue: false },
          {
            path: "collaboration.absolute_rules", label: "절대 규칙", type: "array", required: true,
            arrayItemFields: [{ path: "", label: "규칙", type: "text", required: true, placeholder: "예: no hardcoded secrets" }],
          },
          {
            path: "collaboration.per_service", label: "서비스별 AI 설정", type: "array", required: true,
            description: "Phase 4의 서비스와 1:1 매칭 필요",
            arrayItemFields: [
              { path: "service", label: "서비스 이름", type: "text", required: true, placeholder: "services[].name과 일치해야 함" },
              { path: "mode", label: "모드", type: "enum", required: true, enumValues: ["autonomous", "collaborative", "learning"] },
              { path: "test_case_coverage", label: "테스트 커버리지", type: "enum", required: true, enumValues: ["basic", "standard", "thorough"] },
              {
                path: "human_roles", label: "인간 역할", type: "array", required: false,
                arrayItemFields: [{ path: "", label: "역할", type: "text", required: false }],
              },
              {
                path: "claude_roles", label: "Claude 역할", type: "array", required: false,
                arrayItemFields: [{ path: "", label: "역할", type: "text", required: false }],
              },
              {
                path: "claude_boundaries", label: "Claude 제한", type: "array", required: false,
                arrayItemFields: [{ path: "", label: "제한", type: "text", required: false }],
              },
              {
                path: "decision_authority.claude_autonomous", label: "Claude 자율 결정", type: "array", required: true,
                arrayItemFields: [{ path: "", label: "범위", type: "text", required: true }],
              },
              {
                path: "decision_authority.requires_approval", label: "승인 필요", type: "array", required: true,
                arrayItemFields: [{ path: "", label: "범위", type: "text", required: true }],
              },
            ],
          },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 4: HOW — Technical Architecture (services handled separately)
  // ========================================================================
  {
    id: 3,
    name: "HOW",
    tag: "HOW",
    description: "기술 아키텍처 — 아키텍처 패턴, 서비스 구성, 외부 시스템",
    sections: [
      {
        id: "architecture",
        title: "아키텍처",
        fields: [
          { path: "architecture.pattern", label: "아키텍처 패턴", type: "enum", required: true, enumValues: ["monolith", "microservices", "modular_monolith"], aiRecommend: true },
          { path: "architecture.pattern_rationale", label: "선택 근거", type: "textarea", required: true },
          {
            path: "architecture.pattern_alternatives", label: "검토한 대안", type: "array", required: true,
            arrayItemFields: [
              { path: "pattern", label: "패턴", type: "text", required: true },
              { path: "pros", label: "장점", type: "text", required: true },
              { path: "cons", label: "단점", type: "text", required: true },
              { path: "rejection_reason", label: "탈락 이유", type: "text", required: true },
            ],
          },
          { path: "architecture.internal_style", label: "내부 스타일", type: "enum", required: false, enumValues: ["hexagonal", "clean", "layered", "none"] },
          { path: "architecture.internal_style_rationale", label: "내부 스타일 근거", type: "text", required: false },
          {
            path: "architecture.principles", label: "설계 원칙", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "원칙", type: "text", required: false }],
          },
        ],
      },
      {
        id: "services",
        title: "서비스 목록",
        description: "서비스를 추가하고 타입별 필드를 작성하세요",
        fields: [
          { path: "services", label: "서비스", type: "service_list", required: true },
        ],
      },
      {
        id: "external_systems",
        title: "외부 시스템",
        fields: [
          {
            path: "external_systems", label: "외부 시스템 목록", type: "array", required: false,
            arrayItemFields: [
              { path: "name", label: "이름", type: "text", required: true },
              { path: "purpose", label: "용도", type: "text", required: true },
              { path: "protocol", label: "프로토콜", type: "text", required: true },
              { path: "reliability", label: "신뢰도", type: "enum", required: false, enumValues: ["high", "medium", "low"] },
              { path: "fallback", label: "대체 방안", type: "text", required: false },
            ],
          },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 5: WHAT-IF — Error Handling, Security, Risks
  // ========================================================================
  {
    id: 4,
    name: "WHAT-IF",
    tag: "WHAT-IF",
    description: "오류 처리, 보안, 리스크",
    sections: [
      {
        id: "critical_flows",
        title: "핵심 흐름",
        fields: [
          {
            path: "critical_flows", label: "핵심 흐름 목록", type: "array", required: true,
            arrayItemFields: [
              { path: "flow_name", label: "흐름 이름", type: "text", required: true, aiRecommend: true },
              { path: "happy_path", label: "정상 경로", type: "textarea", required: true },
              {
                path: "failure_scenarios", label: "실패 시나리오", type: "array", required: false,
                arrayItemFields: [
                  { path: "scenario", label: "시나리오", type: "text", required: true },
                  { path: "likelihood", label: "가능성", type: "enum", required: true, enumValues: ["high", "medium", "low"] },
                  { path: "impact", label: "영향", type: "enum", required: true, enumValues: ["high", "medium", "low"] },
                  { path: "handling_strategy", label: "대응 전략", type: "textarea", required: true },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "global_error_handling",
        title: "글로벌 에러 처리",
        fields: [
          { path: "global_error_handling.retry_policy", label: "재시도 정책", type: "text", required: false },
          { path: "global_error_handling.circuit_breaker", label: "서킷 브레이커", type: "text", required: false },
          { path: "global_error_handling.graceful_degradation", label: "우아한 저하", type: "text", required: false },
          { path: "global_error_handling.dead_letter_queue", label: "DLQ 정책", type: "text", required: false },
        ],
      },
      {
        id: "data_consistency",
        title: "데이터 일관성",
        fields: [
          { path: "data_consistency", label: "일관성 전략", type: "textarea", required: false },
        ],
      },
      {
        id: "security",
        title: "보안",
        fields: [
          {
            path: "security.requirements", label: "보안 요구사항", type: "array", required: true,
            arrayItemFields: [
              { path: "category", label: "카테고리", type: "enum", required: true, enumValues: ["authentication", "authorization", "encryption", "input_validation", "audit", "transport_security"] },
              { path: "requirement", label: "요구사항", type: "textarea", required: true },
              { path: "implementation_approach", label: "구현 방법", type: "textarea", required: true },
            ],
          },
          { path: "security.input_validation_strategy", label: "입력 검증 전략", type: "text", required: false },
          {
            path: "security.threat_model", label: "위협 모델", type: "array", required: false,
            arrayItemFields: [
              { path: "threat", label: "위협", type: "text", required: true },
              { path: "mitigation", label: "완화 방법", type: "text", required: true },
            ],
          },
          {
            path: "security.sensitive_data", label: "민감 데이터", type: "array", required: false,
            arrayItemFields: [
              { path: "data_type", label: "데이터 유형", type: "text", required: true },
              { path: "protection_method", label: "보호 방법", type: "text", required: true },
              { path: "retention_policy", label: "보관 정책", type: "text", required: true },
            ],
          },
          {
            path: "security.compliance_requirements", label: "규정 준수", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "규정", type: "text", required: false }],
          },
          {
            path: "security.accepted_security_risks", label: "수용된 보안 리스크", type: "array", required: false,
            arrayItemFields: [
              { path: "risk", label: "리스크", type: "text", required: true },
              { path: "acceptance_rationale", label: "수용 근거", type: "textarea", required: true },
              { path: "reconsider_when", label: "재검토 시점", type: "text", required: false },
            ],
          },
        ],
      },
      {
        id: "risks",
        title: "리스크",
        fields: [
          {
            path: "risks.technical", label: "기술 리스크", type: "array", required: true,
            arrayItemFields: [
              { path: "risk", label: "리스크", type: "textarea", required: true, aiRecommend: true },
              { path: "likelihood", label: "가능성", type: "enum", required: true, enumValues: ["high", "medium", "low"] },
              { path: "impact", label: "영향", type: "enum", required: true, enumValues: ["high", "medium", "low"] },
              { path: "mitigation", label: "완화 방법", type: "textarea", required: true },
              { path: "contingency", label: "대안(Plan B)", type: "textarea", required: true },
            ],
          },
          {
            path: "risks.irreversible_decisions", label: "되돌리기 어려운 결정", type: "array", required: true,
            arrayItemFields: [
              { path: "decision", label: "결정", type: "textarea", required: true },
              { path: "why_irreversible", label: "왜 되돌리기 어려운지", type: "textarea", required: true },
              { path: "confidence_level", label: "확신도", type: "enum", required: true, enumValues: ["high", "medium", "low"] },
              { path: "reversal_cost", label: "되돌림 비용", type: "text", required: true },
            ],
          },
          {
            path: "risks.known_technical_debt", label: "기술 부채", type: "array", required: false,
            arrayItemFields: [
              { path: "debt", label: "부채", type: "textarea", required: true },
              { path: "reason", label: "지금 해결 안 하는 이유", type: "textarea", required: true },
              { path: "resolution_plan", label: "해결 계획", type: "text", required: true },
            ],
          },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 6: HOW-WELL — Performance, Availability, Observability
  // ========================================================================
  {
    id: 5,
    name: "HOW-WELL",
    tag: "HOW-WELL",
    description: "성능, 가용성, 관측성",
    sections: [
      {
        id: "performance",
        title: "성능",
        fields: [
          { path: "performance.expected_concurrent_users", label: "예상 동시 사용자", type: "text", required: true, placeholder: "예: 100명" },
          {
            path: "performance.response_time_targets", label: "응답 시간 목표", type: "array", required: false,
            arrayItemFields: [
              { path: "endpoint_or_flow", label: "엔드포인트/흐름", type: "text", required: true },
              { path: "p50_target", label: "P50 목표", type: "text", required: true },
              { path: "p99_target", label: "P99 목표", type: "text", required: true },
            ],
          },
          { path: "performance.throughput_target", label: "처리량 목표", type: "text", required: false, placeholder: "예: 100 req/s" },
          { path: "performance.data_volume.initial", label: "초기 데이터 규모", type: "text", required: false },
          { path: "performance.data_volume.one_year", label: "1년 후 규모", type: "text", required: false },
          { path: "performance.data_volume.growth_rate", label: "성장률", type: "text", required: false },
          { path: "performance.caching_strategy", label: "캐싱 전략", type: "text", required: false },
          {
            path: "performance.long_running_operations", label: "장시간 작업", type: "array", required: false,
            arrayItemFields: [
              { path: "operation", label: "작업", type: "text", required: true },
              { path: "expected_duration", label: "예상 소요 시간", type: "text", required: true },
              { path: "handling", label: "처리 방식", type: "enum", required: true, enumValues: ["background", "queue", "streaming"] },
              { path: "timeout_policy", label: "타임아웃 정책", type: "text", required: true },
              { path: "progress_feedback", label: "진행률 알림", type: "enum", required: true, enumValues: ["polling", "websocket", "sse", "none"] },
            ],
          },
        ],
      },
      {
        id: "availability",
        title: "가용성",
        fields: [
          { path: "availability.target", label: "가용성 목표", type: "text", required: false, placeholder: "예: 99.9%" },
          { path: "availability.acceptable_downtime", label: "허용 다운타임", type: "text", required: false },
          { path: "availability.disaster_recovery.rpo", label: "RPO", type: "text", required: false },
          { path: "availability.disaster_recovery.rto", label: "RTO", type: "text", required: false },
          { path: "availability.disaster_recovery.backup_strategy", label: "백업 전략", type: "text", required: false },
          {
            path: "availability.single_points_of_failure", label: "단일 장애점", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "장애점", type: "text", required: false }],
          },
        ],
      },
      {
        id: "observability",
        title: "관측성",
        fields: [
          { path: "observability.logging.framework", label: "로깅 프레임워크", type: "text", required: false },
          { path: "observability.logging.structured", label: "구조화 로깅", type: "boolean", required: false },
          { path: "observability.logging.sensitive_data_masking", label: "민감 데이터 마스킹", type: "boolean", required: false },
          { path: "observability.logging.retention_period", label: "로그 보관 기간", type: "text", required: false, placeholder: "예: 30 days" },
          { path: "observability.metrics.tool", label: "메트릭 도구", type: "text", required: false },
          {
            path: "observability.metrics.key_metrics", label: "핵심 메트릭", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "메트릭", type: "text", required: false }],
          },
          { path: "observability.metrics.dashboards", label: "대시보드", type: "text", required: false },
          { path: "observability.alerting.tool", label: "알림 도구", type: "text", required: false },
          {
            path: "observability.alerting.critical_alerts", label: "핵심 알림", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "알림", type: "text", required: false }],
          },
          { path: "observability.tracing.enabled", label: "트레이싱", type: "boolean", required: false },
          { path: "observability.tracing.tool", label: "트레이싱 도구", type: "text", required: false },
          {
            path: "observability.health_checks", label: "헬스체크", type: "array", required: false,
            arrayItemFields: [
              { path: "endpoint", label: "엔드포인트", type: "text", required: true },
              { path: "checks", label: "점검 항목", type: "text", required: true },
            ],
          },
        ],
      },
      {
        id: "scalability",
        title: "확장성",
        fields: [
          { path: "scalability.strategy", label: "확장 전략", type: "enum", required: false, enumValues: ["vertical", "horizontal", "auto"] },
          {
            path: "scalability.bottlenecks", label: "예상 병목", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "병목", type: "text", required: false }],
          },
          { path: "scalability.scaling_trigger", label: "확장 트리거", type: "text", required: false },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 7: HOW-TO-WORK — Development Process
  // ========================================================================
  {
    id: 6,
    name: "HOW-TO-WORK",
    tag: "HOW-TO-WORK",
    description: "개발 프로세스 — 방법론, 코드 품질, 테스트, 버전 관리",
    sections: [
      {
        id: "process",
        title: "프로세스",
        fields: [
          { path: "process.methodology", label: "방법론", type: "enum", required: true, enumValues: ["scrum", "kanban", "scrumban", "xp"] },
          { path: "process.sprint_length", label: "스프린트 길이(주)", type: "text", required: false },
          { path: "process.wip_limit", label: "WIP 제한", type: "text", required: false },
          { path: "process.task_review_minutes", label: "태스크 리뷰 시간(분)", type: "text", required: false },
          {
            path: "process.definition_of_done", label: "완료 정의", type: "array", required: false,
            arrayItemFields: [{ path: "", label: "항목", type: "text", required: false }],
          },
        ],
      },
      {
        id: "code_quality",
        title: "코드 품질",
        fields: [
          {
            path: "code_quality.coding_standards", label: "코딩 표준", type: "array", required: false,
            arrayItemFields: [
              { path: "language", label: "언어", type: "text", required: true },
              { path: "style_guide", label: "스타일 가이드", type: "text", required: true },
              { path: "linter", label: "린터", type: "text", required: true },
              { path: "formatter", label: "포매터", type: "text", required: true },
            ],
          },
          { path: "code_quality.code_review.required", label: "코드 리뷰 필수", type: "boolean", required: false, defaultValue: true },
          { path: "code_quality.code_review.min_reviewers", label: "최소 리뷰어 수", type: "number", required: false, defaultValue: 1 },
          { path: "code_quality.code_review.auto_merge_allowed", label: "자동 머지 허용", type: "boolean", required: false, defaultValue: false },
          { path: "code_quality.documentation.code_comments", label: "코드 주석 정책", type: "text", required: false },
          { path: "code_quality.documentation.adr_usage", label: "ADR 사용 정책", type: "text", required: false },
          { path: "code_quality.documentation.changelog_policy", label: "Changelog 정책", type: "text", required: false },
        ],
      },
      {
        id: "testing",
        title: "테스트",
        fields: [
          { path: "testing.approach", label: "테스트 접근법", type: "enum", required: true, enumValues: ["tdd", "bdd", "test_after", "test_first"] },
          {
            path: "testing.levels", label: "테스트 레벨", type: "array", required: true,
            arrayItemFields: [
              { path: "level", label: "레벨", type: "enum", required: true, enumValues: ["unit", "integration", "e2e", "contract", "smoke", "performance"] },
              { path: "coverage_target", label: "커버리지 목표", type: "text", required: false, placeholder: "예: 80%" },
              { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["pytest", "jest", "vitest", "playwright", "cypress", "junit", "go_test", "rspec", "xctest", "espresso", "robolectric", "flutter_test", "detox"] },
              { path: "approach", label: "접근법", type: "text", required: false },
            ],
          },
          { path: "testing.test_data_strategy", label: "테스트 데이터 전략", type: "enum", required: false, enumValues: ["fixtures", "factories", "snapshots", "seed_scripts"] },
          { path: "testing.test_environment.db_strategy", label: "DB 전략", type: "enum", required: false, enumValues: ["in_memory", "testcontainers", "shared_test_db", "docker_compose"] },
          { path: "testing.test_environment.external_service_strategy", label: "외부 서비스 전략", type: "enum", required: false, enumValues: ["mocks", "stubs", "sandbox", "wiremock"] },
        ],
      },
      {
        id: "version_control",
        title: "버전 관리",
        fields: [
          { path: "version_control.branch_strategy", label: "브랜치 전략", type: "enum", required: true, enumValues: ["github_flow", "gitflow", "trunk_based", "master_develop_task"] },
          { path: "version_control.branch_strategy_description", label: "브랜치 전략 설명", type: "textarea", required: false },
          { path: "version_control.commit_convention", label: "커밋 컨벤션", type: "enum", required: false, enumValues: ["conventional", "gitmoji", "angular", "free"] },
          { path: "version_control.monorepo_or_polyrepo", label: "모노레포/폴리레포", type: "enum", required: false, enumValues: ["monorepo", "polyrepo"] },
          { path: "version_control.pr_policy.created_by", label: "PR 생성자", type: "enum", required: false, enumValues: ["human", "claude", "both"] },
          { path: "version_control.pr_policy.template_required", label: "PR 템플릿 필수", type: "boolean", required: false, defaultValue: true },
          { path: "version_control.pr_policy.squash_merge", label: "스쿼시 머지", type: "boolean", required: false, defaultValue: true },
        ],
      },
    ],
  },

  // ========================================================================
  // Phase 8: WHAT-NEXT — Evolution Plan
  // ========================================================================
  {
    id: 7,
    name: "WHAT-NEXT",
    tag: "WHAT-NEXT",
    description: "진화 계획 — 미래 기능, 롤아웃, 운영",
    sections: [
      {
        id: "evolution",
        title: "진화 계획",
        fields: [
          {
            path: "evolution.future_features", label: "미래 기능", type: "array", required: false,
            arrayItemFields: [
              { path: "feature", label: "기능", type: "text", required: true },
              { path: "planned_phase", label: "예정 단계", type: "enum", required: true, enumValues: ["v2", "v3", "post_launch", "backlog"] },
              { path: "architectural_impact", label: "아키텍처 영향", type: "textarea", required: true },
              { path: "preparation_needed", label: "사전 준비", type: "textarea", required: true },
            ],
          },
          { path: "evolution.migration_path", label: "마이그레이션 경로", type: "textarea", required: false },
          { path: "evolution.sunset_criteria", label: "종료 기준", type: "text", required: false },
        ],
      },
      {
        id: "rollout",
        title: "롤아웃",
        fields: [
          { path: "rollout.strategy", label: "롤아웃 전략", type: "enum", required: false, enumValues: ["big_bang", "canary", "blue_green", "rolling", "feature_flag"] },
          {
            path: "rollout.phases", label: "롤아웃 단계", type: "array", required: false,
            arrayItemFields: [
              { path: "phase", label: "단계", type: "text", required: true },
              { path: "audience", label: "대상", type: "text", required: true },
              { path: "success_criteria", label: "성공 기준", type: "text", required: true },
            ],
          },
          { path: "rollout.rollback_plan", label: "롤백 계획", type: "textarea", required: false },
          { path: "rollout.db_migration_strategy", label: "DB 마이그레이션 전략", type: "text", required: false },
        ],
      },
      {
        id: "operations",
        title: "운영",
        fields: [
          { path: "operations.on_call_policy", label: "온콜 정책", type: "text", required: false },
          { path: "operations.incident_response", label: "장애 대응", type: "text", required: false },
          { path: "operations.maintenance_window", label: "점검 시간", type: "text", required: false },
          { path: "operations.documentation_maintenance", label: "문서 유지보수", type: "text", required: false },
        ],
      },
    ],
  },
];
