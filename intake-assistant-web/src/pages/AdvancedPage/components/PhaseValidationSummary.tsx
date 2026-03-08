import type { ValidationError } from "../schema/validators";

interface PhaseValidationSummaryProps {
  errors: ValidationError[];
}

export function PhaseValidationSummary({ errors }: PhaseValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <h4 className="text-sm font-semibold text-red-700">
        필수 항목 {errors.length}건이 누락되었습니다
      </h4>
      <ul className="mt-2 flex flex-col gap-1">
        {errors.map((err) => (
          <li key={err.path} className="text-xs text-red-600">
            <span className="font-medium">{err.label}</span>: {err.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
