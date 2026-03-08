/**
 * Dot-notation path utilities for nested object access.
 * e.g., getByPath(obj, "project.name") or setByPath(obj, "goals.primary.0.goal", "...")
 */

export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split(".");
  const result = structuredClone(obj);
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    const nextKey = keys[i + 1]!;
    if (current[key] == null || typeof current[key] !== "object") {
      // Create array if next key is numeric, else object
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1]!;
  current[lastKey] = value;
  return result;
}

export function deleteByPath(
  obj: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const keys = path.split(".");
  const result = structuredClone(obj);
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (current[key] == null || typeof current[key] !== "object") return result;
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1]!;
  if (Array.isArray(current)) {
    const idx = Number(lastKey);
    current.splice(idx, 1);
  } else {
    delete current[lastKey];
  }
  return result;
}
