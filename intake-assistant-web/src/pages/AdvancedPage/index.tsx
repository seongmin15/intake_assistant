import { useNavigate } from "react-router-dom";

import { useAdvancedStore } from "@/stores/advancedStore";
import { StepWizard } from "./components/StepWizard";
import { PhaseRenderer } from "./components/PhaseRenderer";
import { AdvancedNavigation } from "./components/AdvancedNavigation";

export function AdvancedPage() {
  const currentPhase = useAdvancedStore((s) => s.currentPhase);
  const submitPhase = useAdvancedStore((s) => s.submitPhase);
  const error = useAdvancedStore((s) => s.error);
  const reset = useAdvancedStore((s) => s.reset);
  const setSubmitPhase = useAdvancedStore((s) => s.setSubmitPhase);
  const navigate = useNavigate();

  const handleBack = () => {
    reset();
    navigate("/");
  };

  // Completion state
  if (submitPhase === "complete") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <span className="text-3xl text-green-600">&#10003;</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">프로젝트가 생성되었습니다!</h2>
        <p className="text-sm text-gray-500">ZIP 파일이 다운로드되었습니다.</p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          새 프로젝트 시작
        </button>
      </main>
    );
  }

  // Submitting state
  if (submitPhase === "validating" || submitPhase === "generating") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-600">
          {submitPhase === "validating" ? "YAML을 검증하고 있습니다..." : "ZIP 파일을 생성하고 있습니다..."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Advanced 모드</h1>
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-gray-400 transition hover:text-gray-600"
        >
          모드 선택으로 돌아가기
        </button>
      </div>

      <StepWizard />

      {/* Error banner */}
      {submitPhase === "error" && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-red-700">제출 오류</h4>
          <p className="mt-1 whitespace-pre-wrap text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setSubmitPhase("idle")}
            className="mt-2 text-xs font-medium text-red-700 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="flex-1">
        <PhaseRenderer phaseId={currentPhase} />
      </div>

      <AdvancedNavigation />
    </main>
  );
}
