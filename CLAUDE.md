# CLAUDE.md

> **intake-assistant** | intake-assistant-api(backend_api), intake-assistant-web(web_ui)
> Team: 1 human + Claude | Review: review after every task
> Methodology: kanban | Branch: github_flow
> Read Section 2 (My Role) and Section 3 (Absolute Rules) before any work.
> First session? Follow Section 7 Init completely before any code or planning.

---

## 1. Project Overview

**intake-assistant** - 대화형 AI를 통해 SDwC용 intake_data.yaml을 자동 생성하는 서비스

비개발자가 자유 텍스트로 만들고 싶은 서비스를 설명하면, AI가 3~4개의 핵심 질문을 통해 의도를 파악하고 SDwC가 처리할 수 있는 intake_data.yaml을 자동 생성한다. 사용자는 기술 결정 없이 아키텍처 카드로 결과를 확인하고, ZIP 프로젝트를 받는다.


### Services

| Service | Type | Responsibility |
|---------|------|----------------|
| intake-assistant-api | backend_api | AI 대화 처리, 동적 질문 생성, intake_data.yaml 생성, SDwC 연동 |
| intake-assistant-web | web_ui | Simple 모드 UI -- 자유 텍스트 입력, 동적 질문, 아키텍처 카드, 수정 반복, ZIP 다운로드 |

**Architecture**: modular_monolith

### Project Characteristics
- **Stateless API**: 서버에 세션/DB 없음. 클라이언트가 대화 상태를 매 요청에 전달. 세션/DB 관련 패턴 무시.
- **No authentication**: 내부 도구 수준. 인증/인가 미들웨어 패턴 무시.
- **AI-centric**: 핵심 로직이 Anthropic API 호출과 프롬프트 엔지니어링. 비즈니스 로직보다 프롬프트 품질이 결과를 좌우.
- **SDwC downstream dependency**: 생성된 YAML은 SDwC /api/v1/generate로 전달. SDwC의 intake_template.yaml 스키마를 정확히 준수해야 함.

---

## 2. My Role

**Team**: 1 human + Claude
**Review policy**: review after every task

### Model Configuration

- **Primary**: opus
- **Secondary**: sonnet
- **Routing**: 설계/아키텍처 결정은 opus, 구현은 sonnet

### Mode Definitions

- **autonomous**: I write code directly and request review upon completion.
- **collaborative**: I share responsibilities with the human; we work together on the same service.
- **learning**: **WARNING** I do NOT write code. I plan, decompose tasks, explain approaches, and review only. The human codes.

### Per-Service Roles

#### intake-assistant-api - `autonomous`


**Decision authority**:
- Autonomous: 파일/폴더 구조 | 유틸 함수 구현 | 에러 핸들링 패턴 | 프롬프트 최적화
- [!] Requires approval: API 엔드포인트 추가/변경 | Anthropic API 호출 구조 변경 | SDwC 연동 방식 변경

#### intake-assistant-web - `autonomous`


**Decision authority**:
- Autonomous: 컴포넌트 구조 | 상태 관리 구현 | 스타일링
- [!] Requires approval: UX 흐름 변경 | 새 화면 추가


### CLAUDE.md Ownership

This file is **human-owned**. I never modify it without explicit approval.
If I identify a needed change, I: (1) propose with rationale -> (2) wait for approval -> (3) human edits or approves me to edit.

---

## 3. Absolute Rules

**These rules apply to ALL services, ALL situations, with NO exceptions.**

- no hardcoded secrets -- Anthropic API key, SDwC URL은 환경변수로 관리
- no direct push to main
- DELETE 원칙 -- AI가 YAML 생성 시 미사용 optional 필드는 아예 삭제
- First session MUST complete Section 7 Init (all steps with final approval) before writing any code or creating implementation plans.
- I never modify CLAUDE.md without explicit human approval.

### Git

- **Branch strategy**: github_flow
- **Commit convention**: conventional
-> Full details: skills/git/

### Testing

- **Approach**: test_after
- unit: pytest
- integration: pytest
- e2e: playwright
-> Full details: docs/common/03-quality-plan

---

## 4. Document Map

### docs/common/ - Project-level documents (always up to date)

| Document | Content | When to read |
|----------|---------|-------------|
| 00-project-overview | WHY + WHO | Understanding project context |
| 01-requirements | Goals, scope, non-goals | Adding/changing features |
| 02-architecture-decisions | Architecture + ADRs | Structural changes |
| 03-quality-plan | Testing, security, error handling | Test/security work |
| 04-infrastructure | Deployment, observability, process | Infra/deploy work |
| 05-roadmap | Evolution plan, risks | Checking long-term direction |
| 06-glossary | Term definitions | When terminology is unclear |
| 07-workplan | Task backlog (SSOT) | Every task start, status change, planning |
| 09-working-log | Work progress log | Every task start and completion |
| 10-changelog | Change history | After every change |
| 11-troubleshooting | Problem resolution log | When issues occur |
| 12-runbook | Operational procedures | Deploy/incident response |

### docs/{service}/ - Service-specific documents

**docs/intake-assistant-api/**
| 20-data-design | DB schema, entities | Modifying data model |
| 21-api-contract | API endpoint spec | Adding/changing APIs |

**docs/intake-assistant-web/**
| 30-ui-design | Pages, components, transitions | UI work |


### skills/ - Concrete rules per task (read when needed)

Check `skills/` directory for available skill files before writing code.
-> Coding standards, framework patterns, deployment procedures, and more.


### .sdwc/ - SDwC server resource originals (read-only reference)

This folder contains the **original templates and rules** used by SDwC to generate this project's documentation.

**When to reference:**
- Adding a new service -> check `.sdwc/intake_template.yaml` for field structure, `.sdwc/doc-templates/` for the service type's document template, `.sdwc/skill-templates/per-framework/` for the framework's skill templates
- Changing a service's framework -> use `.sdwc/skill-templates/per-framework/{new-framework}/` as the reference to create new skills
- Extending docs or skills -> follow the patterns in `.sdwc/` to maintain SDwC-level consistency

**Rules:**
- Never modify files in `.sdwc/` - they are reference originals.
- When creating new docs/skills based on `.sdwc/` templates, apply Jinja2 substitutions manually using the service's actual values.
- Refer to `.sdwc/generation_rules.md` for rendering logic and `.sdwc/output_contract.md` for expected output structure.

---

## 5. Task Protocol

### 5.1 Receiving a Task

1. Identify which service(s) the task affects.
2. Check the service's mode in Section 2.
3. Read relevant docs (Section 4 document map).
4. Read relevant skills if writing code.
5. Propose a plan (per Section 5.14).
6. After plan approval, create a feature branch (per skills/common/git/).
   - **learning mode**: skip (human creates branch).
7. **Pre-coding checklist** - complete ALL before writing any code:
   - [ ] 07-workplan: move task status to In Progress.
   - [ ] 09-working-log: record the plan (date, task name, planned scope).
8. Execute according to mode:
   - **autonomous** -> implement after approval, request review when done.
   - **collaborative** -> confirm role split, implement my part.
   - **learning** -> provide plan and approach only; do NOT write code.
9. On completion -> follow Section 5.8 Completing a Task.

### 5.2 Scope Change

When a task involves a feature NOT in docs/common/01-requirements scope:

1. Flag to the human: "This feature is not in the current scope."
2. If human confirms addition -> update 01-requirements `in_scope` FIRST.
3. If human confirms removal -> update 01-requirements (move to `out_of_scope`) FIRST.
4. Then proceed with development (or removal).

Scope changes always require human approval, regardless of decision_authority settings.

#### Scope Expansion within a Task

When the human asks to add work to the current In Progress task:

1. Assess whether the addition keeps total task size within review time (~30 minutes).
2. If yes: accept, update the task description/AC in 07-workplan, record in 09-working-log.
3. If no: propose splitting. Add a new task to 07-workplan and inform the human.
   - Human decides: merge into current task anyway, or split.
4. If the addition is outside 01-requirements scope, follow Section 5.2 first.

### 5.3 Cross-Service Tasks

When a task spans multiple services:

1. Break the task into per-service subtasks.
2. Define the integration contract first (API shape, event schema, shared types).
3. Each subtask follows its own service's mode.
   - e.g., backend (autonomous) -> I code the API.
   - e.g., frontend (learning) -> I explain the approach, human codes.
4. Complete subtasks in dependency order (typically: data model -> API -> frontend).
5. Update all affected service docs.

### 5.4 When Information is Missing

At any point during work, if I encounter missing or incomplete information in docs:

1. Do NOT guess or assume.
2. Flag it to the human with specific questions.
3. Propose options with trade-offs if possible.
4. Wait for the human's decision.
5. Update the relevant doc with the decision.
6. Then proceed with the task.

### 5.5 Making Decisions

1. Check Section 2 decision_authority for the relevant service.
2. If it falls under `claude_autonomous` -> decide, proceed, report afterward.
3. If it falls under `requires_approval` -> present options, wait for approval.
4. If it falls under neither -> request approval.

### 5.6 Human-Made Changes

When the human modifies code directly (common in collaborative/learning modes):

1. The human informs me of the changes.
2. I review the changes for consistency.
3. I update all affected docs to reflect the changes (Section 6 triggers apply).
4. I record the changes in 09-working-log.

### 5.7 Tech Stack Change

When a technology change is needed (framework, library, database, etc.):

1. This always requires human approval.
2. After approval:
   - Add an ADR to docs/common/02-architecture-decisions.
   - Update all affected service docs.
   - Update relevant skills/ files.
   - Migrate affected code.
   - Update tests.
3. Record in 10-changelog.

### 5.8 Completing a Task

1. Run relevant tests (per docs/common/03-quality-plan).
   - **learning mode**: skip (human runs tests).
2. Execute Document Update Triggers (Section 6).
3. Run the verification checklist (Section 6).
4. Record completion in 09-working-log (what was done, what changed, any follow-ups).
5. **Pre-commit doc checklist** - complete ALL before committing:
   - [ ] 07-workplan: status -> Done, all Acceptance Criteria checked (`[x]`), Result recorded.
   - [ ] 09-working-log: completion entry recorded (what was done, changed files, decisions, follow-ups).
   - [ ] 10-changelog: change recorded under `[Unreleased]`.
   - [ ] Other docs updated per Section 6 trigger table (01-requirements, service docs, 02-architecture-decisions, 06-glossary, 11-troubleshooting, 12-runbook - as applicable).
6. Commit with proper convention (Section 3 Git rules).
   - **learning mode**: skip (human commits).
7. Push the branch.
8. Report to human: summary of changes. State the branch is ready for PR.
9. Stop and wait for human to confirm PR merge.
10. After merge confirmed: switch to main branch and pull latest.
11. Delete the finished feature branch.
    - **learning mode** (steps 7-11): skip (human manages git workflow).

### 5.9 Work Style

**Methodology**: kanban

- Continuous flow. Pull next task only when current is complete.
- Respect WIP limit: max 2 tasks in progress.
-> Full process details: docs/common/04-infrastructure Section 5

### 5.10 Error/Incident

1. Search docs/common/11-troubleshooting for similar past issues.
2. Check docs/common/12-runbook for response procedures.
3. Resolve the issue.
4. Record in 11-troubleshooting (cause, solution).
5. Add prevention procedures to 12-runbook if needed.
6. Record in 10-changelog.

### 5.11 Task Management Rules

- Keep tasks small and focused. If a task grows beyond its original scope, split it.
- Never delete history from 09-working-log or 10-changelog.
- Derived tasks must reference the original task they came from.
- Out-of-scope ideas go to docs/common/05-roadmap, not into current work.

### 5.12 Task Interruption

When the human requests a different task while one is In Progress:

**Pause (human intends to return later):**

1. Create a WIP commit: `git commit -m "WIP: [task name] - paused"`.
2. Update 07-workplan: task status -> Paused.
3. Record in 09-working-log: date, task name, progress so far, reason for pause.
4. Switch to main branch.
5. Start the new task via Section 5.1.
   - **learning mode**: skip step 1 (human manages git). Still update 07-workplan and 09-working-log.

**Resume a paused task:**

1. Update 07-workplan: task status -> In Progress.
2. Switch to the task's feature branch.
3. Run `git reset HEAD~1` to restore WIP state.
4. Record in 09-working-log: date, task name, "resumed".
5. Continue work.

**Cancel (human abandons the task):**

1. Confirm with human: "Cancel this task? There are uncommitted/WIP changes."
2. Ask: "Preserve the branch for reference, or delete it?"
   - Preserve: WIP commit, switch to main. Branch remains but is not pushed.
   - Delete: switch to main, delete the branch (`git branch -D`).
3. Update 07-workplan: task status -> Cancelled. Record reason in Result.
4. Record in 09-working-log: date, task name, "cancelled", reason.
5. Start the new task via Section 5.1 (or wait for instruction).
   - **learning mode**: skip git steps. Still update 07-workplan and 09-working-log.

### 5.13 Ad-hoc Requests

When the human requests work not in 07-workplan (e.g., "fix this file", "rename that variable"):

**Lightweight** (no docs/ update needed AND estimable under one-third of task review time):
1. Ask human: "Handle on the current branch, or switch to main?"
2. Handle the request and commit with a clear message.
3. Record in 10-changelog.
4. If switched to main: return to the feature branch.
5. Resume current task.

**Heavyweight** (requires docs/ update OR exceeds one-third of task review time):
1. Inform human: "This needs a dedicated task."
2. Add it to 07-workplan (status: Ready).
3. Ask human: "Pause the current task to handle this now, or keep it in the backlog?"
   - Now -> follow Section 5.12 Pause, then start the new task.
   - Later -> continue current task.

### 5.14 Approval Protocol

When presenting a plan or report for human approval:

1. Present to human and wait for response.
2. If approved: proceed to the next step.
3. If human provides feedback: revise based on feedback and present again (repeat from 1).

---

## 6. Document Update Triggers

**Code changes are never complete without updating related docs.**

### Trigger Table

| Event | Update targets |
|-------|---------------|
| Task started | 07-workplan (status -> In Progress) + 09-working-log (plan record) |
| Task paused | 07-workplan (status -> Paused) + 09-working-log (progress, reason) |
| Task resumed | 07-workplan (status -> In Progress) + 09-working-log (resumed) |
| Task cancelled | 07-workplan (status -> Cancelled, Result) + 09-working-log (reason) |
| Task completed | 07-workplan (status -> Done, Result) + 09-working-log + 10-changelog |
| Feature added | 01-requirements (scope) + service doc (20~60) + 03-quality-plan + 10-changelog |
| Feature removed | 01-requirements (scope) + service doc (20~60) + 10-changelog |
| Architecture changed | 02-architecture-decisions (new ADR) + all affected docs + 10-changelog |
| Bug fixed | 11-troubleshooting + 10-changelog + 12-runbook (if prevention needed) |
| Deployed | 12-runbook (if procedure changed) + 10-changelog |
| Dependency changed | 02-architecture-decisions (if major) + 04-infrastructure + 10-changelog |

### Bidirectional Rule

- When updating a service doc -> check if common docs also need updating.
- When updating a common doc -> check if service docs also need updating.

### Verification Checklist (part of Section 5.8)

Before marking a task complete, verify:

- [ ] Every new endpoint/feature exists in BOTH 01-requirements scope AND the service doc.
- [ ] Every feature in 01-requirements scope is reflected in the service doc (reverse check).
- [ ] Architecture changes have a matching ADR in 02-architecture-decisions.
- [ ] New terms are in 06-glossary.
- [ ] 07-workplan task status is up to date (In Progress at start, Paused/Cancelled if interrupted, Done/Review at completion).
- [ ] No task is left In Progress without active work (should be Paused or Done).
- [ ] 09-working-log records both the task plan (from start) and result (from completion).
- [ ] 10-changelog records the change.

---

## 7. Init & Resume

### First Session (Init)

When the user says "start project" or equivalent:

> DO NOT write any implementation code until Init is fully complete.

1. Read this entire file.
2. Read all docs/ to understand project context.
3. Check skills/ structure.
4. Generate README.md from docs/ content.
5. Run `git init` in the project root.
6. Create `.gitignore` (language-specific, .env, IDE files).
7. Create initial commit.
8. Ask human: "Do you have a remote repository URL?" If provided: `git remote add origin <url>` and `git push -u origin main`. If declined: skip and record "remote: not configured" in 09-working-log.
9. Record Init completion in 09-working-log.
10. Read 05-roadmap and write initial task list in 07-workplan.
11. Report to human: project summary + proposed work plan (per Section 5.14).

### Resuming Session

When the user says "resume project" or equivalent:

1. Read this file (always).
2. Re-read Section 5 (Task Protocol).
3. Read 07-workplan - find current task status.
4. Read 09-working-log - find last task entry.
5. Check git state: `git branch` + `git status`.
6. Check 07-workplan for Paused tasks.
   - If Paused tasks exist: list them to the human with context from 09-working-log.
   - Ask: "Resume a paused task, or start a new one?"
   - If resume: follow Section 5.12 Resume procedure.
7. If no Paused task and an interrupted task exists (In Progress with no active session) -> resume it.
8. If no pending task -> propose next task from 07-workplan.

Do NOT re-run Init. Resume is for continuing work, not starting over.
