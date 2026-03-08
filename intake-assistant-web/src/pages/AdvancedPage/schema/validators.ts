import type { FieldDef } from "./fieldTypes";
import { phases } from "./phaseSchema";
import { getByPath } from "@/utils/pathUtils";
import type { ServiceFormData } from "@/stores/advancedStore";

export interface ValidationError {
  path: string;
  label: string;
  message: string;
}

/**
 * Validate a single phase's required fields.
 * Returns an array of validation errors (empty = valid).
 */
export function validatePhase(
  phaseId: number,
  formData: Record<string, unknown>,
  services: ServiceFormData[],
): ValidationError[] {
  const phase = phases[phaseId];
  if (!phase) return [];

  const errors: ValidationError[] = [];

  for (const section of phase.sections) {
    for (const field of section.fields) {
      if (field.type === "service_list") {
        // Services validated separately
        if (services.length === 0) {
          errors.push({
            path: "services",
            label: "서비스 목록",
            message: "최소 1개 서비스를 추가하세요.",
          });
        }
        continue;
      }
      validateField(field, formData, errors);
    }
  }

  // Cross-reference: collaboration.per_service ↔ services (Phase 3)
  if (phaseId === 2 && services.length > 0) {
    validatePerServiceSync(formData, services, errors);
  }

  return errors;
}

function validateField(
  field: FieldDef,
  formData: Record<string, unknown>,
  errors: ValidationError[],
  basePath?: string,
): void {
  const fullPath = basePath ? `${basePath}.${field.path}` : field.path;

  if (field.type === "array") {
    if (!field.required) return;
    const value = getByPath(formData, fullPath);
    if (!Array.isArray(value) || value.length === 0) {
      errors.push({
        path: fullPath,
        label: field.label,
        message: `${field.label}에 최소 1개 항목이 필요합니다.`,
      });
    }
    return;
  }

  if (!field.required) return;

  const value = getByPath(formData, fullPath);

  if (value === undefined || value === null || value === "") {
    errors.push({
      path: fullPath,
      label: field.label,
      message: `${field.label}은(는) 필수 항목입니다.`,
    });
  }
}

function validatePerServiceSync(
  formData: Record<string, unknown>,
  services: ServiceFormData[],
  errors: ValidationError[],
): void {
  const perService = getByPath(formData, "collaboration.per_service") as Array<Record<string, unknown>> | undefined;
  if (!perService || !Array.isArray(perService)) return;

  const serviceNames = new Set(services.map((s) => s.name).filter(Boolean));
  const perServiceNames = new Set(perService.map((ps) => ps["service"] as string).filter(Boolean));

  for (const name of serviceNames) {
    if (!perServiceNames.has(name)) {
      errors.push({
        path: "collaboration.per_service",
        label: "서비스별 AI 설정",
        message: `서비스 "${name}"에 대한 per_service 설정이 누락되었습니다.`,
      });
    }
  }
}

/**
 * Validate all phases and return per-phase errors.
 */
export function validateAllPhases(
  formData: Record<string, unknown>,
  services: ServiceFormData[],
): Record<number, ValidationError[]> {
  const result: Record<number, ValidationError[]> = {};
  for (const phase of phases) {
    const errors = validatePhase(phase.id, formData, services);
    if (errors.length > 0) {
      result[phase.id] = errors;
    }
  }
  return result;
}

/**
 * Check if the given phase has validation errors.
 */
export function phaseHasErrors(
  phaseId: number,
  formData: Record<string, unknown>,
  services: ServiceFormData[],
): boolean {
  return validatePhase(phaseId, formData, services).length > 0;
}
