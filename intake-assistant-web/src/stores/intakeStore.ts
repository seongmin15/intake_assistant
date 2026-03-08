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

type ErrorSource = "analyze" | "generate" | "finalize" | null;

interface IntakeState {
  phase: IntakePhase;
  userInput: string;
  questions: Question[];
  analysis: AnalyzeResponse["analysis"] | null;
  answers: Record<string, string>;
  yamlContent: string | null;
  architectureCard: ArchitectureCard | null;
  featureChecklist: FeatureItem[];
  error: string | null;
  errorSource: ErrorSource;
  streamStatus: string | null;
  streamAttempt: number;

  setUserInput: (input: string) => void;
  submitAnalyze: () => Promise<void>;
  setAnswer: (questionId: string, answer: string) => void;
  submitGenerate: () => Promise<void>;
  startRevision: () => void;
  submitRevision: (revisionRequest: string) => Promise<void>;
  submitFinalize: () => Promise<void>;
  retryAnalyze: () => Promise<void>;
  retryGenerate: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  phase: "input" as IntakePhase,
  userInput: "",
  questions: [] as Question[],
  analysis: null as AnalyzeResponse["analysis"] | null,
  answers: {} as Record<string, string>,
  yamlContent: null as string | null,
  architectureCard: null as ArchitectureCard | null,
  featureChecklist: [] as FeatureItem[],
  error: null as string | null,
  errorSource: null as ErrorSource,
  streamStatus: null as string | null,
  streamAttempt: 0,
};

export const useIntakeStore = create<IntakeState>((set, get) => ({
  ...initialState,

  setUserInput: (input) => set({ userInput: input }),

  submitAnalyze: async () => {
    const { userInput } = get();
    set({ phase: "analyzing", error: null, streamStatus: "질문을 생성하고 있습니다..." });
    try {
      await api.analyzeStream(userInput, (event) => {
        if (event.event === "status") {
          if (event.data.phase === "analyzing") {
            set({ streamStatus: "AI가 질문을 생성하고 있습니다..." });
          }
        } else if (event.event === "result") {
          set({
            phase: "questions",
            questions: event.data.questions,
            analysis: event.data.analysis,
            streamStatus: null,
          });
        } else if (event.event === "error") {
          set({ phase: "error", error: event.data.message, errorSource: "analyze", streamStatus: null });
        }
      });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.",
        errorSource: "analyze",
        streamStatus: null,
      });
    }
  },

  setAnswer: (questionId, answer) => {
    const { answers } = get();
    set({ answers: { ...answers, [questionId]: answer } });
  },

  submitGenerate: async () => {
    const { userInput, answers } = get();
    const qaAnswers: QaAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
      question_id: questionId,
      answer,
    }));
    set({ phase: "generating", error: null, streamStatus: "프로젝트를 생성하고 있습니다...", streamAttempt: 1 });
    try {
      await api.generateStream(userInput, qaAnswers, (event) => {
        if (event.event === "status") {
          const { phase, attempt } = event.data;
          if (phase === "generating") {
            set({ streamStatus: "AI가 YAML을 생성하고 있습니다...", streamAttempt: attempt });
          } else if (phase === "validating") {
            set({ streamStatus: "생성된 YAML을 검증하고 있습니다..." });
          } else if (phase === "retry") {
            set({ streamStatus: `검증 실패 — ${attempt}/${event.data.max_attempts ?? "?"}차 재시도 중...`, streamAttempt: attempt });
          }
        } else if (event.event === "result") {
          set({
            phase: "review",
            yamlContent: event.data.yaml_content,
            architectureCard: event.data.architecture_card,
            featureChecklist: event.data.feature_checklist,
            streamStatus: null,
            streamAttempt: 0,
          });
        } else if (event.event === "error") {
          set({ phase: "error", error: event.data.message, errorSource: "generate", streamStatus: null, streamAttempt: 0 });
        }
      });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "생성 중 오류가 발생했습니다.",
        errorSource: "generate",
        streamStatus: null,
        streamAttempt: 0,
      });
    }
  },

  startRevision: () => set({ phase: "revising" }),

  submitRevision: async (revisionRequest) => {
    const { userInput, answers, yamlContent } = get();
    const qaAnswers: QaAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
      question_id: questionId,
      answer,
    }));
    set({ phase: "generating", error: null, streamStatus: "수정 사항을 반영하고 있습니다...", streamAttempt: 1 });
    try {
      await api.generateStream(
        userInput,
        qaAnswers,
        (event) => {
          if (event.event === "status") {
            const { phase, attempt } = event.data;
            if (phase === "generating") {
              set({ streamStatus: "AI가 YAML을 수정하고 있습니다...", streamAttempt: attempt });
            } else if (phase === "validating") {
              set({ streamStatus: "수정된 YAML을 검증하고 있습니다..." });
            } else if (phase === "retry") {
              set({ streamStatus: `검증 실패 — ${attempt}/${event.data.max_attempts ?? "?"}차 재시도 중...`, streamAttempt: attempt });
            }
          } else if (event.event === "result") {
            set({
              phase: "review",
              yamlContent: event.data.yaml_content,
              architectureCard: event.data.architecture_card,
              featureChecklist: event.data.feature_checklist,
              streamStatus: null,
              streamAttempt: 0,
            });
          } else if (event.event === "error") {
            set({ phase: "error", error: event.data.message, errorSource: "generate", streamStatus: null, streamAttempt: 0 });
          }
        },
        revisionRequest,
        yamlContent ?? undefined,
      );
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.",
        errorSource: "generate",
        streamStatus: null,
        streamAttempt: 0,
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
      const nameMatch = yamlContent.match(/project_name:\s*(.+)/);
      const projectName = nameMatch?.[1]?.trim() || "project";
      a.download = `${projectName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      set({ phase: "complete" });
    } catch (err) {
      set({
        phase: "error",
        error: err instanceof Error ? err.message : "다운로드 중 오류가 발생했습니다.",
        errorSource: "finalize",
      });
    }
  },

  retryAnalyze: async () => {
    await get().submitAnalyze();
  },

  retryGenerate: async () => {
    await get().submitGenerate();
  },

  reset: () => set(initialState),
}));
