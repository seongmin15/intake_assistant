# Git — Project Rules

> This skill defines git workflow rules for the entire project.
> Branch strategy: **{{ version_control.branch_strategy }}**
> Commit convention: **{{ version_control.commit_convention }}**

---

## 1. Branch Strategy

{% if version_control.branch_strategy == "github_flow" %}
**GitHub Flow** — `main` is always deployable.

```
main ← feature branches
```

- Create a feature branch from `main` for every task.
- Branch naming: `feature/{short-description}`, `fix/{short-description}`, `chore/{short-description}`
- Open a PR when ready for review.
- Merge to `main` after approval. Delete the feature branch.
- Never push directly to `main`.
{% endif %}
{% if version_control.branch_strategy == "gitflow" %}
**Gitflow** — `main` for releases, `develop` for integration.

```
main ← release branches ← develop ← feature branches
```

- Feature branches from `develop`: `feature/{short-description}`
- Release branches from `develop`: `release/{version}`
- Hotfix branches from `main`: `hotfix/{short-description}`
- Merge flow: feature → develop → release → main
- Tag every merge to `main` with a version number.
{% endif %}
{% if version_control.branch_strategy == "trunk_based" %}
**Trunk-Based** — short-lived branches, frequent integration.

```
main ← short-lived branches (< 2 days)
```

- Branch from `main`, merge back within 1–2 days.
- Use feature flags for incomplete work.
- Branch naming: `{type}/{short-description}`
- Never let a branch live longer than 2 days.
{% endif %}
{% if version_control.branch_strategy == "master_develop_task" %}
**Master-Develop-Task** — `master` for production, `develop` for integration.

```
master ← develop ← task branches
```

- Task branches from `develop`: `task/{short-description}`
- Merge task → develop after review.
- Merge develop → master for releases.
- Never push directly to `master` or `develop`.
{% endif %}

{% if version_control.branch_strategy_description %}
**Additional detail:** {{ version_control.branch_strategy_description }}
{% endif %}

---

## 2. Commit Convention

{% if version_control.commit_convention == "conventional" %}
**Conventional Commits:**

```
<type>(<scope>): <subject>

<body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `perf`
Scope: service name or module (e.g., `feat(my-api): add user endpoint`)

**Rules:**
- Subject line: imperative mood, lowercase, no period, max 72 chars.
- Body: wrap at 72 chars, explain what and why (not how).
- Breaking changes: add `!` after type (`feat!: ...`) and explain in body.
{% endif %}
{% if version_control.commit_convention == "gitmoji" %}
**Gitmoji:**

```
:emoji: <subject>
```

Key emojis: ✨ feat, 🐛 fix, ♻️ refactor, 📝 docs, ✅ test, 🔧 config
Subject: imperative mood, max 72 chars.
{% endif %}
{% if version_control.commit_convention == "angular" %}
**Angular Convention:**

```
<type>(<scope>): <subject>
```

Same as Conventional Commits. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
{% endif %}

**One logical change per commit.** Don't mix feature code with formatting fixes.

---

## 3. PR Policy

{% if version_control.pr_policy %}
- Created by: **{{ version_control.pr_policy.created_by }}**
{% if version_control.pr_policy.template_required %}- PR template is required.{% endif %}
{% if version_control.pr_policy.squash_merge %}- Use **squash merge** to keep `main` history clean.{% endif %}
{% endif %}

**PR description must include:**
1. What changed and why.
2. How to test.
3. Related issue/task reference.

**Review rules:**
- Reviewer checks: correctness, consistency with docs, test coverage.
- Approve only when all CI checks pass.
- Author resolves all comments before merge.

{% if version_control.monorepo_or_polyrepo == "monorepo" %}
---

## 4. Monorepo Rules

- Scope commits to the affected service/package.
- Use path-based CI triggers (only run tests for changed services).
- Shared code changes require review from all affected service owners.
{% endif %}
