import { useState } from "react";

import { useAdvancedStore } from "@/stores/advancedStore";
import { phases } from "../schema/phaseSchema";
import { validatePhase } from "../schema/validators";
import type { ValidationError } from "../schema/validators";
import { PhaseValidationSummary } from "./PhaseValidationSummary";

export function AdvancedNavigation() {
  const currentPhase = useAdvancedStore((s) => s.currentPhase);
  const formData = useAdvancedStore((s) => s.formData);
  const services = useAdvancedStore((s) => s.services);
  const nextPhase = useAdvancedStore((s) => s.nextPhase);
  const prevPhase = useAdvancedStore((s) => s.prevPhase);
  const submitPhase = useAdvancedStore((s) => s.submitPhase);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const isFirst = currentPhase === 0;
  const isLast = currentPhase === phases.length - 1;
  const isSubmitting = submitPhase === "validating" || submitPhase === "generating";

  const handleNext = () => {
    const errors = validatePhase(currentPhase, formData, services);
    setValidationErrors(errors);
    if (errors.length === 0) {
      nextPhase();
    }
  };

  const handlePrev = () => {
    setValidationErrors([]);
    prevPhase();
  };

  const submitAdvanced = useAdvancedStore((s) => s.submitAdvanced);

  const handleSubmit = () => {
    const errors = validatePhase(currentPhase, formData, services);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    void submitAdvanced();
  };

  return (
    <div className="flex flex-col gap-3">
      <PhaseValidationSummary errors={validationErrors} />

      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={isFirst}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>

        <span className="text-sm text-gray-400">
          {currentPhase + 1} / {phases.length}
        </span>

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "처리 중..." : "제출"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}
