import { create } from "zustand";

import * as api from "@/api/client";
import type {
  AnalyzeResponse,
  ArchitectureCard,
  FeatureItem,
  QaAnswer,
  Question,
} from "@/api/types";

type IntakePhase =
  | "input"
  | "analyzing"
  | "questions"
  | "generating"
  | "review"
  | "revising"
  | "finalizing"
  | "complete"
  | "error";

interface IntakeState {
  phase: IntakePhase;
  userInput: string;
  questions: Question[];
  analysis: AnalyzeResponse["analysis"] | null;
  answers: Record<string, string[]>;
  yamlContent: string | null;
  architectureCard: ArchitectureCard | null;
  featureChecklist: FeatureItem[];
  error: string | null;

  setUserInput: (input: string) => void;
  submitAnalyze: () => Promise<void>;
  setAnswer: (questionId: string, selectedIds: string[]) => void;
  submitGenerate: () => Promise<void>;
  startRevision: () => void;
  submitRevision: (revisionRequest: string) => Promise<void>;
  submitFinalize: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  phase: "input" as IntakePhase,
  userInput: "",
  questions: [] as Question[],
  analysis: null as AnalyzeResponse["analysis"] | null,
  answers: {} as Record<string, string[]>,
  yamlContent: null as string | null,
  architectureCard: null as ArchitectureCard | null,
  featureChecklist: [] as FeatureItem[],
  error: null as string | null,
};

export const useIntakeStore = create<IntakeState>((set, get) => ({
  ...initialState,

  setUserInput: (input) => set({ userInput: input }),

  submitAnalyze: async () => {
    const { userInput } = get();
    set({ phase: "analyzing", error: null });
    try {
      const result = await api.analyze(userInput);
      set({
        phase: "questions",
        questions: result.questions,
        analysis: result.analysis,
      });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.",
      });
    }
  },

  setAnswer: (questionId, selectedIds) => {
    const { answers } = get();
    set({ answers: { ...answers, [questionId]: selectedIds } });
  },

  submitGenerate: async () => {
    const { userInput, answers } = get();
    const qaAnswers: QaAnswer[] = Object.entries(answers).map(([questionId, selectedIds]) => ({
      question_id: questionId,
      selected_ids: selectedIds,
    }));
    set({ phase: "generating", error: null });
    try {
      const result = await api.generate(userInput, qaAnswers);
      set({
        phase: "review",
        yamlContent: result.yaml_content,
        architectureCard: result.architecture_card,
        featureChecklist: result.feature_checklist,
      });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "생성 중 오류가 발생했습니다.",
      });
    }
  },

  startRevision: () => set({ phase: "revising" }),

  submitRevision: async (revisionRequest) => {
    const { userInput, answers, yamlContent } = get();
    const qaAnswers: QaAnswer[] = Object.entries(answers).map(([questionId, selectedIds]) => ({
      question_id: questionId,
      selected_ids: selectedIds,
    }));
    set({ phase: "generating", error: null });
    try {
      const result = await api.generate(
        userInput,
        qaAnswers,
        revisionRequest,
        yamlContent ?? undefined,
      );
      set({
        phase: "review",
        yamlContent: result.yaml_content,
        architectureCard: result.architecture_card,
        featureChecklist: result.feature_checklist,
      });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.",
      });
    }
  },

  submitFinalize: async () => {
    const { yamlContent } = get();
    if (!yamlContent) return;
    set({ phase: "finalizing", error: null });
    try {
      const blob = await api.finalize(yamlContent);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.zip";
      a.click();
      URL.revokeObjectURL(url);
      set({ phase: "complete" });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "다운로드 중 오류가 발생했습니다.",
      });
    }
  },

  reset: () => set(initialState),
}));
