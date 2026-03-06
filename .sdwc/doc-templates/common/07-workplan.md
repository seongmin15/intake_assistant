# Work Plan

> This document is the single source of truth (SSOT) for project tasks.
> AI proposes tasks, and they are reflected after user approval.

## Operating Rules

{% if process.task_review_minutes %}
- Each task should be reviewable in ~{{ process.task_review_minutes }} minutes.
{% endif %}
{% if process.wip_limit %}
- WIP Limit: {{ process.wip_limit }}
{% endif %}
- Status transitions require user approval.
- History must not be deleted.
{% if testing.approach == "tdd" %}
- All implementation tasks follow the TDD (Red -> Green -> Refactor) cycle.
- Test commits must come before implementation commits.
{% endif %}

## Status Flow

```
Backlog -> Ready -> In Progress -> Review -> Done
                        |    ^
                        v    |
                      Paused

Any active status -> Cancelled
```

- **Paused**: task is temporarily stopped. Only from In Progress.
- **Cancelled**: task is abandoned. Record reason in Result.

## Task Format

```
### T<NNN>: <title>
- Status: Backlog | Ready | In Progress | Review | Paused | Cancelled | Done
- Service: <service name>
- Origin: T<NNN> (optional, when derived from another task)
- Description: <description>
- Acceptance Criteria:
  - [ ] <criterion 1>
  - [ ] <criterion 2>
- Result: (recorded after completion)
```

### Origin Rules

- Record when a task is derived from issues found in another task's Result.
- Omit Origin for initial tasks.

### Result Rules

- Result must be recorded when Status becomes Done or Cancelled.
- All Acceptance Criteria items must be checked before transitioning to Done.
- If some items are split into other tasks, mark as "deferred to T<NNN>" on the original item.
- Include: created files, test results, discovered issues.
- Record issues resolved within the task as well.
- Issues exceeding {{ process.task_review_minutes | default("30") }} minutes should be split into a new task.
- Out-of-scope issues move to docs/common/05-roadmap.md.

---

## Tasks

{% if process.methodology == "scrum" %}
### Sprint Format

```
## Sprint <N>
- Goal: <sprint goal>
- Period: YYYY-MM-DD ~ YYYY-MM-DD
- Status: Planning | Active | Done

### T<NNN>: ...
```

> AI writes the initial task list and Sprint 1 at project start.
{% else %}
> AI writes the initial task list at project start.
{% endif %}

<!-- Claude: This is a hybrid document.
     Template Engine fills Operating Rules, Status Flow, Task Format.
     Claude fills the Tasks section during Init based on docs/common/05-roadmap.md.
     After Init, Claude updates task statuses with user approval.
     Rules:
     - Never delete task history.
     - Always get user approval before status transitions.
     - Keep tasks small (~{{ process.task_review_minutes | default("30") }} min reviewable).
     - Record Result when Done. -->
