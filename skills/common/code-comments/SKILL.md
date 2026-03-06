# Code Comments — Project Rules

> This skill defines when and how to write code comments across the project.
> Language-specific docstring/JSDoc styles are in each service's `coding-standards/SKILL.md`.

---

## 1. When to Comment

**Comment the WHY, not the WHAT.** Code should be self-explanatory for what it does. Comments explain why it does it that way.

### Must Comment

- **Business rules** — why this validation exists, what regulation requires it.
- **Non-obvious decisions** — why this algorithm was chosen over the simpler one.
- **Workarounds** — why this hack exists, link to the issue it works around.
- **Performance trade-offs** — why this is denormalized, why this cache exists.
- **External dependencies** — API quirks, format requirements, known bugs in libraries.

### Never Comment

- What the code literally does (e.g., `i += 1  # increment i`).
- Commented-out code — delete it; git has history.
- TODO without a tracking reference — use `TODO({issue-id}): description` or don't write it.
- Redundant restatements of clear function names.

---

## 2. Public API Documentation

Every **public function, class, and module** must have a doc comment.

**What to include:**
- One-line summary of what it does.
- Parameter descriptions (if not obvious from names and types).
- Return value description.
- Exceptions/errors that can be raised.
- Usage example (for complex or non-obvious APIs).

**What to skip:**
- Private/internal functions with clear names and types — doc comment optional.
- Trivial getters/setters — skip unless there's a side effect.
- Test functions — the test name should be descriptive enough.

---

## 3. Inline Comments

- Place above the line they describe, not at the end.
- One blank line before a comment block that explains a logical section.
- Keep comments up to date — stale comments are worse than no comments.

```
# ✅ Good — explains WHY
# Rate limit is 100/min per user; batch to avoid hitting it on bulk operations.
for chunk in batched(items, size=50):
    await process(chunk)

# ❌ Bad — explains WHAT (obvious from code)
# Loop through items in batches of 50
for chunk in batched(items, size=50):
    await process(chunk)
```

---

## 4. TODO / FIXME / HACK

| Tag | Meaning | Rule |
|-----|---------|------|
| `TODO({issue})` | Planned improvement | Must reference an issue ID |
| `FIXME({issue})` | Known bug, needs fixing | Must reference an issue ID |
| `HACK` | Intentional workaround | Must explain why and when it can be removed |

**Orphan TODOs (no issue reference) are not allowed.** If it's worth noting, it's worth tracking.

---

## 5. File Headers

Not required for every file. Use only when:
- The file's purpose is non-obvious from its name and location.
- The file contains generated code or has special handling rules.
- The module has important usage constraints (e.g., "must be imported before X").
