# 런북

> 이 문서는 Template Engine이 초기 구조를 생성하고,
> Claude가 개발·운영 과정에서 구체적 절차를 채워갑니다.

---

## 1. 배포 개요

| 서비스 | 배포 대상 | CI | CD | 시크릿 관리 |
|--------|----------|-----|-----|-----------|
{% for svc in services %}
| {{ svc.name }} | {{ svc.deployment.target }} | {{ svc.deployment.ci.tool }} | {{ svc.deployment.cd.tool }} | {{ svc.deployment.secrets_management }} |
{% endfor %}

---

## 2. 환경 구성

{% for svc in services %}
{% if svc.deployment.environments %}
### {{ svc.name }}

| 환경 | 목적 | 프로덕션과 차이 |
|------|------|---------------|
{% for env in svc.deployment.environments %}
| {{ env.name }} | {{ env.purpose }} | {{ env.differences }} |
{% endfor %}
{% endif %}
{% endfor %}

---

## 3. 배포 절차

<!-- Claude: 첫 배포 성공 후 실제 수행한 명령어/절차 기반으로 작성.
     "이 문서만 보고 배포할 수 있는가?"가 기준.
     배포 환경 변경 시 즉시 갱신. -->

<!--
### [서비스명] 배포

#### 사전 체크리스트
- [ ] ...

#### 배포 명령어
```bash
...
```

#### 검증 단계
1. ...

#### 롤백 절차
1. ...
-->

---

{% if rollout.rollback_plan %}
## 4. 롤백 계획

{{ rollout.rollback_plan }}

{% if rollout.db_migration_strategy %}
- **DB 마이그레이션**: {{ rollout.db_migration_strategy }}
{% endif %}

---
{% endif %}

## 5. 인시던트 대응

{% if operations.incident_response %}
{{ operations.incident_response }}
{% endif %}

{% if operations.on_call_policy %}
- **온콜 정책**: {{ operations.on_call_policy }}
{% endif %}

{% if operations.maintenance_window %}
- **유지보수 윈도우**: {{ operations.maintenance_window }}
{% endif %}

---

## 6. 장애 대응 플레이북

<!-- Claude: 인시던트 해결 후, 동일 장애 재발 시 즉시 대응 가능하도록 기록.
     11-troubleshooting은 "왜 발생했나" (원인 분석),
     여기는 "다시 발생하면 어떻게 하나" (대응 절차)에 집중. -->

<!--
### [장애 유형]
- **증상**: 
- **진단 순서**: 
- **대응 절차**: 
- **에스컬레이션**: 
-->
