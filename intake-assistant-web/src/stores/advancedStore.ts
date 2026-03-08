import { create } from "zustand";

import * as api from "@/api/client";
import { getByPath, setByPath, deleteByPath } from "@/utils/pathUtils";
import { phases } from "@/pages/AdvancedPage/schema/phaseSchema";
import { serializeToYaml } from "@/pages/AdvancedPage/schema/yamlSerializer";

export interface ServiceFormData {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

type SubmitPhase = "idle" | "validating" | "generating" | "complete" | "error";

interface AdvancedState {
  currentPhase: number;
  formData: Record<string, unknown>;
  services: ServiceFormData[];
  phaseErrors: Record<number, string[]>;
  recommendLoading: string | null;
  submitPhase: SubmitPhase;
  yamlContent: string | null;
  error: string | null;

  // Navigation
  nextPhase: () => void;
  prevPhase: () => void;
  goToPhase: (phase: number) => void;

  // Field access
  getField: (path: string) => unknown;
  setField: (path: string, value: unknown) => void;

  // Array operations
  addArrayItem: (path: string, item: unknown) => void;
  removeArrayItem: (path: string, index: number) => void;

  // Service management
  addService: (type: string) => void;
  removeService: (index: number) => void;
  setServiceField: (index: number, field: string, value: unknown) => void;

  // AI recommendation
  setRecommendLoading: (fieldPath: string | null) => void;
  requestRecommendation: (
    fieldPath: string,
    fieldInfo: { description?: string; enum_values?: string[]; field_type?: string },
  ) => Promise<void>;

  // Submit
  submitAdvanced: () => Promise<void>;
  setSubmitPhase: (phase: SubmitPhase) => void;
  setYamlContent: (yaml: string | null) => void;
  setError: (error: string | null) => void;
  setPhaseErrors: (phase: number, errors: string[]) => void;

  // Reset
  reset: () => void;
}

let serviceIdCounter = 0;

const initialState = {
  currentPhase: 0,
  formData: {} as Record<string, unknown>,
  services: [] as ServiceFormData[],
  phaseErrors: {} as Record<number, string[]>,
  recommendLoading: null as string | null,
  submitPhase: "idle" as SubmitPhase,
  yamlContent: null as string | null,
  error: null as string | null,
};

export const useAdvancedStore = create<AdvancedState>((set, get) => ({
  ...initialState,

  nextPhase: () => {
    const { currentPhase } = get();
    if (currentPhase < phases.length - 1) {
      set({ currentPhase: currentPhase + 1 });
    }
  },

  prevPhase: () => {
    const { currentPhase } = get();
    if (currentPhase > 0) {
      set({ currentPhase: currentPhase - 1 });
    }
  },

  goToPhase: (phase) => {
    if (phase >= 0 && phase < phases.length) {
      set({ currentPhase: phase });
    }
  },

  getField: (path) => {
    return getByPath(get().formData, path);
  },

  setField: (path, value) => {
    set({ formData: setByPath(get().formData, path, value) });
  },

  addArrayItem: (path, item) => {
    const { formData } = get();
    const current = getByPath(formData, path);
    const arr = Array.isArray(current) ? [...current, item] : [item];
    set({ formData: setByPath(formData, path, arr) });
  },

  removeArrayItem: (path, index) => {
    const itemPath = `${path}.${index}`;
    set({ formData: deleteByPath(get().formData, itemPath) });
  },

  addService: (type) => {
    const id = `svc_${++serviceIdCounter}`;
    const newService: ServiceFormData = { id, name: "", type };
    set({ services: [...get().services, newService] });
  },

  removeService: (index) => {
    const services = [...get().services];
    services.splice(index, 1);
    set({ services });
  },

  setServiceField: (index, field, value) => {
    const services = [...get().services];
    const svc = services[index];
    if (svc) {
      const updated = { ...svc };
      // Support nested paths like "deployment.target"
      const keys = field.split(".");
      if (keys.length === 1) {
        updated[field] = value;
      } else {
        let current: Record<string, unknown> = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i]!;
          if (current[key] == null || typeof current[key] !== "object") {
            current[key] = {};
          }
          current[key] = { ...(current[key] as Record<string, unknown>) };
          current = current[key] as Record<string, unknown>;
        }
        current[keys[keys.length - 1]!] = value;
      }
      services[index] = updated;
      set({ services });
    }
  },

  setRecommendLoading: (fieldPath) => set({ recommendLoading: fieldPath }),

  requestRecommendation: async (fieldPath, fieldInfo) => {
    set({ recommendLoading: fieldPath });
    try {
      const { formData } = get();
      const result = await api.recommend({
        context: formData,
        field_path: fieldPath,
        field_info: fieldInfo,
      });
      set({ formData: setByPath(get().formData, fieldPath, result.suggestion) });
    } catch {
      // Silently fail — the field just won't be populated
    } finally {
      set({ recommendLoading: null });
    }
  },

  submitAdvanced: async () => {
    const { formData, services } = get();
    set({ submitPhase: "validating", error: null });

    try {
      // 1. Serialize to YAML
      const yamlContent = serializeToYaml(formData, services);
      set({ yamlContent: yamlContent });

      // 2. Validate via SDwC
      const validation = await api.validateYaml(yamlContent);
      if (!validation.valid) {
        set({
          submitPhase: "error",
          error: `YAML 검증 실패:\n${validation.errors.join("\n")}`,
        });
        return;
      }

      // 3. Generate ZIP via finalize
      set({ submitPhase: "generating" });
      const blob = await api.finalize(yamlContent);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.zip";
      a.click();
      URL.revokeObjectURL(url);

      set({ submitPhase: "complete" });
    } catch (err) {
      set({
        submitPhase: "error",
        error: err instanceof Error ? err.message : "제출 중 오류가 발생했습니다.",
      });
    }
  },

  setSubmitPhase: (phase) => set({ submitPhase: phase }),
  setYamlContent: (yaml) => set({ yamlContent: yaml }),
  setError: (error) => set({ error }),
  setPhaseErrors: (phase, errors) => {
    set({ phaseErrors: { ...get().phaseErrors, [phase]: errors } });
  },

  reset: () => {
    serviceIdCounter = 0;
    set(initialState);
  },
}));
