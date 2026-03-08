import yaml from "js-yaml";

import type { ServiceFormData } from "@/stores/advancedStore";

/**
 * Serialize formData + services into intake_data.yaml string.
 * Applies DELETE principle: removes empty/undefined/null values.
 */
export function serializeToYaml(
  formData: Record<string, unknown>,
  services: ServiceFormData[],
): string {
  const data = structuredClone(formData);

  // Merge services into the data
  if (services.length > 0) {
    (data as Record<string, unknown>)["services"] = services.map((svc) => {
      const cleaned = { ...svc };
      // Remove internal id field
      delete (cleaned as Record<string, unknown>)["id"];
      return cleaned;
    });
  }

  // Apply DELETE principle: remove empty values recursively
  const cleaned = deleteEmpty(data);

  return yaml.dump(cleaned, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

/**
 * Recursively remove empty/undefined/null values.
 * DELETE principle: If an optional field has no meaningful value, remove it entirely.
 */
function deleteEmpty(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;

  if (Array.isArray(obj)) {
    const filtered = obj
      .map(deleteEmpty)
      .filter((item) => item !== undefined && item !== null && item !== "");
    return filtered.length > 0 ? filtered : undefined;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    let hasValue = false;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleaned = deleteEmpty(value);
      if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
        result[key] = cleaned;
        hasValue = true;
      }
    }
    return hasValue ? result : undefined;
  }

  // Keep booleans (even false), numbers (even 0), and non-empty strings
  if (typeof obj === "boolean") return obj;
  if (typeof obj === "number") return obj;
  if (typeof obj === "string") return obj.trim() || undefined;

  return obj;
}
