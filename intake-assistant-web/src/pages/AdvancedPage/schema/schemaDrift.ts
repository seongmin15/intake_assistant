/**
 * Schema drift detection — compares backend template metadata against
 * the hardcoded phaseSchema.ts and serviceSchema.ts.
 */

import type { SchemaMetaResponse } from "@/api/types";
import { phases } from "./phaseSchema";
import { SERVICE_TYPES, getServiceFields } from "./serviceSchema";
import type { FieldDef } from "./fieldTypes";

export interface SchemaDrift {
  hasDrift: boolean;
  newEnumValues: Array<{ path: string; added: string[] }>;
  newServiceTypes: string[];
  removedServiceTypes: string[];
  missingRequiredFields: string[];
}

/**
 * Paths intentionally omitted from the frontend form.
 * These are optional/advanced fields in the template that we deliberately
 * don't expose. They should NOT trigger drift warnings.
 */
const KNOWN_OMITTED_PATHS = new Set([
  // Phase 4 service-level fields we intentionally skip
  "services.backend_api.databases",
  "services.backend_api.entities",
  "services.backend_api.graphql",
  "services.backend_api.grpc",
  "services.backend_api.messaging",
  "services.backend_api.caching",
  "services.backend_api.file_storage",
  "services.backend_api.search",
  "services.backend_api.error_handling",
  "services.backend_api.middleware",
  "services.backend_api.background_tasks",
  "services.backend_api.websocket",
  "services.web_ui.i18n",
  "services.web_ui.pwa",
  "services.web_ui.analytics",
  "services.web_ui.design_system",
  "services.web_ui.testing",
  "services.web_ui.seo",
  "services.web_ui.performance",
  "services.web_ui.key_libraries",
  "services.web_ui.build_tool",
  "services.worker.concurrency",
  "services.worker.monitoring",
  "services.worker.key_libraries",
  "services.worker.build_tool",
  "services.mobile_app.offline_support",
  "services.mobile_app.push_notifications",
  "services.mobile_app.deep_linking",
  "services.mobile_app.analytics",
  "services.mobile_app.key_libraries",
  "services.mobile_app.build_tool",
  "services.data_pipeline.data_quality",
  "services.data_pipeline.data_catalog",
  "services.data_pipeline.key_libraries",
  "services.data_pipeline.build_tool",
  // Deployment sub-fields handled at service level
  "services.backend_api.deployment",
  "services.web_ui.deployment",
  "services.worker.deployment",
  "services.mobile_app.deployment",
  "services.data_pipeline.deployment",
]);

/**
 * Collect all enum field paths from the static schema.
 */
function collectStaticEnums(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  function walkFields(fields: FieldDef[], prefix: string) {
    for (const field of fields) {
      const fullPath = prefix ? `${prefix}.${field.path}` : field.path;
      if (field.type === "enum" && field.enumValues) {
        result.set(fullPath, new Set(field.enumValues));
      }
      if (field.arrayItemFields) {
        walkFields(field.arrayItemFields, fullPath);
      }
      if (field.children) {
        walkFields(field.children, fullPath);
      }
    }
  }

  // Walk phase fields
  for (const phase of phases) {
    for (const section of phase.sections) {
      walkFields(section.fields, "");
    }
  }

  // Walk service-type fields
  for (const st of SERVICE_TYPES) {
    const fields = getServiceFields(st.value);
    walkFields(fields, `services.${st.value}`);
  }

  return result;
}

/**
 * Collect all field paths from the static schema.
 */
function collectStaticFieldPaths(): Set<string> {
  const result = new Set<string>();

  function walkFields(fields: FieldDef[], prefix: string) {
    for (const field of fields) {
      const fullPath = prefix ? `${prefix}.${field.path}` : field.path;
      result.add(fullPath);
      if (field.arrayItemFields) {
        walkFields(field.arrayItemFields, fullPath);
      }
      if (field.children) {
        walkFields(field.children, fullPath);
      }
    }
  }

  for (const phase of phases) {
    for (const section of phase.sections) {
      walkFields(section.fields, "");
    }
  }

  for (const st of SERVICE_TYPES) {
    const fields = getServiceFields(st.value);
    walkFields(fields, `services.${st.value}`);
  }

  return result;
}

/**
 * Detect schema drift between backend template metadata and frontend static schema.
 */
export function detectSchemaDrift(meta: SchemaMetaResponse): SchemaDrift {
  const staticServiceTypes: Set<string> = new Set(SERVICE_TYPES.map((st) => st.value));
  const remoteServiceTypes = new Set(meta.service_types);

  // New/removed service types
  const newServiceTypes = meta.service_types.filter((st) => !staticServiceTypes.has(st));
  const removedServiceTypes = [...staticServiceTypes].filter((st) => !remoteServiceTypes.has(st));

  // Enum drift — find new values not in static schema
  const staticEnums = collectStaticEnums();
  const newEnumValues: Array<{ path: string; added: string[] }> = [];

  for (const [path, remoteValues] of Object.entries(meta.enum_fields)) {
    const staticValues = staticEnums.get(path);
    if (!staticValues) continue; // Field not in our schema — skip

    const added = remoteValues.filter((v) => !staticValues.has(v));
    if (added.length > 0) {
      newEnumValues.push({ path, added });
    }
  }

  // Missing required fields — in template but not in frontend
  const staticPaths = collectStaticFieldPaths();
  const missingRequiredFields = meta.required_fields.filter(
    (path) => !staticPaths.has(path) && !KNOWN_OMITTED_PATHS.has(path),
  );

  const hasDrift =
    newEnumValues.length > 0 ||
    newServiceTypes.length > 0 ||
    removedServiceTypes.length > 0 ||
    missingRequiredFields.length > 0;

  return {
    hasDrift,
    newEnumValues,
    newServiceTypes,
    removedServiceTypes,
    missingRequiredFields,
  };
}
