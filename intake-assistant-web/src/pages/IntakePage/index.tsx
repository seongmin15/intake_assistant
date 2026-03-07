import { useIntakeStore } from "@/stores/intakeStore";

import { QuestionCard } from "./components/QuestionCard";
import { TextInput } from "./components/TextInput";

export function IntakePage() {
  const {
    phase,
    questions,
    answers,
    error,
    setUserInput,
    submitAnalyze,
    setAnswer,
    submitGenerate,
    reset,
  } = useIntakeStore();

  const handleAnalyze = (text: string) => {
    setUserInput(text);
    void submitAnalyze();
  };

  const allAnswered = questions.length > 0 && questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">Simple 모드</h1>

        {phase === "input" && <TextInput onSubmit={handleAnalyze} />}

        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-gray-500">질문을 생성하고 있습니다...</p>
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
            <p className="text-sm text-gray-500">프로젝트를 생성하고 있습니다...</p>
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
