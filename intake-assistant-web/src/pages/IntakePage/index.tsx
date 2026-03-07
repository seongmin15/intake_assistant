import { useIntakeStore } from "@/stores/intakeStore";

import { ArchitectureCard } from "./components/ArchitectureCard";
import { FeatureChecklist } from "./components/FeatureChecklist";
import { QuestionCard } from "./components/QuestionCard";
import { RevisionInput } from "./components/RevisionInput";
import { TextInput } from "./components/TextInput";

export function IntakePage() {
  const {
    phase,
    questions,
    answers,
    architectureCard,
    featureChecklist,
    error,
    streamStatus,
    streamAttempt,
    setUserInput,
    submitAnalyze,
    setAnswer,
    submitGenerate,
    startRevision,
    submitRevision,
    submitFinalize,
    reset,
  } = useIntakeStore();

  const handleAnalyze = (text: string) => {
    setUserInput(text);
    void submitAnalyze();
  };

  const allAnswered =
    questions.length > 0 && questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">Simple 모드</h1>

        {phase === "input" && <TextInput onSubmit={handleAnalyze} />}

        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-gray-500">
              {streamStatus ?? "질문을 생성하고 있습니다..."}
            </p>
          </div>
        )}

        {phase === "questions" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-gray-600">
              아래 질문에 답변해 주세요. 답변을 바탕으로 프로젝트를 구성합니다.
            </p>
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                selectedIds={answers[q.id] ?? []}
                onChange={(ids) => setAnswer(q.id, ids)}
              />
            ))}
            <button
              type="button"
              onClick={() => void submitGenerate()}
              disabled={!allAnswered}
              className="self-end rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              생성하기
            </button>
          </div>
        )}

        {phase === "generating" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-gray-500">
              {streamStatus ?? "프로젝트를 생성하고 있습니다..."}
            </p>
            {streamAttempt > 1 && (
              <p className="text-xs text-gray-400">
                시도 {streamAttempt}회차
              </p>
            )}
          </div>
        )}

        {phase === "review" && architectureCard && (
          <div className="flex flex-col gap-6">
            <ArchitectureCard card={architectureCard} />
            <FeatureChecklist items={featureChecklist} />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={startRevision}
                className="rounded-lg bg-gray-200 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
              >
                수정 요청
              </button>
              <button
                type="button"
                onClick={() => void submitFinalize()}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                이대로 진행
              </button>
            </div>
          </div>
        )}

        {phase === "revising" && (
          <div className="flex flex-col gap-6">
            {architectureCard && <ArchitectureCard card={architectureCard} />}
            <RevisionInput
              onSubmit={(text) => void submitRevision(text)}
              onCancel={() => useIntakeStore.setState({ phase: "review" })}
            />
          </div>
        )}

        {phase === "finalizing" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-gray-500">ZIP 파일을 생성하고 있습니다...</p>
          </div>
        )}

        {phase === "complete" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl text-green-600">✓</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">프로젝트 생성 완료!</h2>
            <p className="text-sm text-gray-500">ZIP 파일이 다운로드되었습니다.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              새 프로젝트 시작
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-gray-200 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
            >
              처음부터 다시 시작
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
