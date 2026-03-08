/**
 * Computes dynamic enum options — values present in the backend template
 * but not in the static schema.
 */

import type { SchemaMetaResponse } from "@/api/types";

/**
 * Given a field path and its static enum values, returns any new values
 * from the backend template metadata that are not in the static set.
 */
export function getDynamicEnumOptions(
  fieldPath: string,
  staticValues: string[],
  schemaMeta: SchemaMetaResponse | null,
): string[] | undefined {
  if (!schemaMeta) return undefined;

  const remoteValues = schemaMeta.enum_fields[fieldPath];
  if (!remoteValues) return undefined;

  const staticSet = new Set(staticValues);
  const newValues = remoteValues.filter((v) => !staticSet.has(v));

  return newValues.length > 0 ? newValues : undefined;
}

/**
 * Same as getDynamicEnumOptions but for service-scoped fields.
 * Transforms the service field path to match the backend's naming convention.
 *
 * E.g., for serviceType="backend_api" and fieldPath="language",
 * checks "services.backend_api.language" in schemaMeta.
 */
export function getServiceDynamicEnumOptions(
  serviceType: string,
  fieldPath: string,
  staticValues: string[],
  schemaMeta: SchemaMetaResponse | null,
): string[] | undefined {
  if (!schemaMeta) return undefined;

  const fullPath = `services.${serviceType}.${fieldPath}`;
  return getDynamicEnumOptions(fullPath, staticValues, schemaMeta);
}
