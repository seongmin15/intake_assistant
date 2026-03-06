# Git — Project Rules

> This skill defines git workflow rules for the entire project.
> Branch strategy: **github_flow**
> Commit convention: **conventional**

---

## 1. Branch Strategy

**GitHub Flow** — `main` is always deployable.

```
main ← feature branches
```

- Create a feature branch from `main` for every task.
- Branch naming: `feature/{short-description}`, `fix/{short-description}`, `chore/{short-description}`
- Open a PR when ready for review.
- Merge to `main` after approval. Delete the feature branch.
- Never push directly to `main`.


---

## 2. Commit Convention

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

**One logical change per commit.** Don't mix feature code with formatting fixes.

---

## 3. PR Policy


**PR description must include:**
1. What changed and why.
2. How to test.
3. Related issue/task reference.

**Review rules:**
- Reviewer checks: correctness, consistency with docs, test coverage.
- Approve only when all CI checks pass.
- Author resolves all comments before merge.

---

## 4. Monorepo Rules

- Scope commits to the affected service/package.
- Use path-based CI triggers (only run tests for changed services).
- Shared code changes require review from all affected service owners.
