# 인프라 및 운영

---

## 1. 배포

### 서비스별 배포 개요

| 서비스 | 배포 대상 | CI | CD | 컨테이너 레지스트리 | 시크릿 관리 |
|--------|----------|-----|-----|---------------------|-----------|
{% for svc in services %}
| {{ svc.name }} | {{ svc.deployment.target }} | {{ svc.deployment.ci.tool }} | {{ svc.deployment.cd.tool }} | {{ svc.deployment.container_registry }} | {{ svc.deployment.secrets_management }} |
{% endfor %}

> 배포 명령어, Dockerfile 작성, CI/CD 파이프라인 설정 등 상세 규칙은 skills/{service}/deployment/ 참조

---

{% if observability %}
## 2. 관측성

| 항목 | 도구 |
|------|------|
{% if observability.logging %}
| 로깅 | {{ observability.logging.framework }} (구조화: {{ observability.logging.structured }}) |
{% endif %}
{% if observability.metrics %}
| 메트릭 | {{ observability.metrics.tool }} |
{% endif %}
{% if observability.alerting %}
| 알림 | {{ observability.alerting.tool }} |
{% endif %}
{% if observability.tracing %}
| 트레이싱 | {{ observability.tracing.tool }} (활성: {{ observability.tracing.enabled }}) |
{% endif %}

{% if observability.health_checks %}
### 헬스체크

| 엔드포인트 | 점검 항목 |
|-----------|---------|
{% for health_i in observability.health_checks %}
| {{ health_i.endpoint }} | {{ health_i.checks }} |
{% endfor %}
{% endif %}

> 로그 레벨 기준, 메트릭 네이밍, 마스킹 패턴 등 상세 규칙은 skills/common/observability/ 참조

---
{% endif %}

## 3. 가용성 및 확장성

{% if availability.target %}
- **가용성 목표**: {{ availability.target }}
{% endif %}
{% if availability.acceptable_downtime %}
- **허용 다운타임**: {{ availability.acceptable_downtime }}
{% endif %}

{% if availability.disaster_recovery %}
### 재해 복구

{% if availability.disaster_recovery.rpo %}
- **RPO**: {{ availability.disaster_recovery.rpo }}
{% endif %}
{% if availability.disaster_recovery.rto %}
- **RTO**: {{ availability.disaster_recovery.rto }}
{% endif %}
{% if availability.disaster_recovery.backup_strategy %}
- **백업**: {{ availability.disaster_recovery.backup_strategy }}
{% endif %}
{% endif %}

{% if availability.single_points_of_failure %}
### 단일 장애점

{% for single_i in availability.single_points_of_failure %}
- {{ single_i }}
{% endfor %}
{% endif %}

{% if scalability.strategy %}
- **확장 전략**: {{ scalability.strategy }}
{% endif %}
{% if scalability.bottlenecks %}
- **예상 병목**:
{% for bottle_i in scalability.bottlenecks %}
  - {{ bottle_i }}
{% endfor %}
{% endif %}
{% if scalability.scaling_trigger %}
- **확장 트리거**: {{ scalability.scaling_trigger }}
{% endif %}

---

## 4. 성능 요구사항

- **예상 동시 사용자**: {{ performance.expected_concurrent_users }}

{% if performance.response_time_targets %}
### 응답 시간 목표

| 엔드포인트/플로우 | P50 | P99 |
|-----------------|-----|-----|
{% for respon_i in performance.response_time_targets %}
| {{ respon_i.endpoint_or_flow }} | {{ respon_i.p50_target }} | {{ respon_i.p99_target }} |
{% endfor %}
{% endif %}

{% if performance.throughput_target %}
- **처리량 목표**: {{ performance.throughput_target }}
{% endif %}

{% if performance.data_volume %}
### 데이터 볼륨

{% if performance.data_volume.initial %}
- **초기**: {{ performance.data_volume.initial }}
{% endif %}
{% if performance.data_volume.one_year %}
- **1년 후**: {{ performance.data_volume.one_year }}
{% endif %}
{% if performance.data_volume.growth_rate %}
- **성장률**: {{ performance.data_volume.growth_rate }}
{% endif %}
{% endif %}

{% if performance.caching_strategy %}
- **캐싱 전략**: {{ performance.caching_strategy }}
{% endif %}

{% if performance.long_running_operations %}
### 장시간 작업

| 작업 | 예상 시간 | 처리 방식 | 타임아웃 | 진행률 |
|------|----------|----------|---------|--------|
{% for long_r_i in performance.long_running_operations %}
| {{ long_r_i.operation }} | {{ long_r_i.expected_duration }} | {{ long_r_i.handling }} | {{ long_r_i.timeout_policy }} | {{ long_r_i.progress_feedback }} |
{% endfor %}
{% endif %}

---

## 5. 개발 프로세스

- **방법론**: {{ process.methodology }}
{% if process.sprint_length %}
- **스프린트**: {{ process.sprint_length }}주
{% endif %}
{% if process.wip_limit %}
- **WIP 제한**: {{ process.wip_limit }}
{% endif %}
{% if process.task_review_minutes %}
- **태스크 리뷰**: {{ process.task_review_minutes }}분
{% endif %}

{% if process.definition_of_done %}
### 완료 정의

{% for defini_i in process.definition_of_done %}
- {{ defini_i }}
{% endfor %}
{% endif %}

---

## 6. 코딩 표준 (요약)

{% if code_quality.coding_standards %}
| 언어 | 스타일 가이드 | 린터 | 포매터 |
|------|-------------|------|--------|
{% for coding_i in code_quality.coding_standards %}
| {{ coding_i.language }} | {{ coding_i.style_guide }} | {{ coding_i.linter }} | {{ coding_i.formatter }} |
{% endfor %}
{% endif %}

{% if version_control.commit_convention %}
- **커밋 컨벤션**: {{ version_control.commit_convention }}
{% endif %}

{% if code_quality.code_review %}
### 코드 리뷰

- **필수**: {{ code_quality.code_review.required }}
- **최소 리뷰어**: {{ code_quality.code_review.min_reviewers }}
- **자동 머지**: {{ code_quality.code_review.auto_merge_allowed }}
{% endif %}

{% if code_quality.documentation %}
### 문서화

{% if code_quality.documentation.code_comments %}
- **코드 주석**: {{ code_quality.documentation.code_comments }}
{% endif %}
{% if code_quality.documentation.adr_usage %}
- **ADR 사용**: {{ code_quality.documentation.adr_usage }}
{% endif %}
{% endif %}

> 상세 규칙은 skills/ 참조

---

## 7. 버전 관리 (요약)

- **브랜치 전략**: {{ version_control.branch_strategy }}
{% if version_control.branch_strategy_description %}
- **설명**: {{ version_control.branch_strategy_description }}
{% endif %}
{% if version_control.monorepo_or_polyrepo %}
- **저장소 구조**: {{ version_control.monorepo_or_polyrepo }}
{% endif %}

{% if version_control.pr_policy %}
### PR 정책

{% if version_control.pr_policy.created_by %}
- **생성자**: {{ version_control.pr_policy.created_by }}
{% endif %}
{% if version_control.pr_policy.template_required %}
- **템플릿 필수**: {{ version_control.pr_policy.template_required }}
{% endif %}
{% if version_control.pr_policy.squash_merge %}
- **스쿼시 머지**: {{ version_control.pr_policy.squash_merge }}
{% endif %}
{% endif %}

> 상세 규칙은 skills/git/SKILL.md 참조

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지. -->
