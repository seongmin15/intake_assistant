import { useAdvancedStore } from "@/stores/advancedStore";
import { phases } from "../schema/phaseSchema";

export function StepWizard() {
  const currentPhase = useAdvancedStore((s) => s.currentPhase);
  const goToPhase = useAdvancedStore((s) => s.goToPhase);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-2">
      {phases.map((phase) => {
        const isActive = phase.id === currentPhase;
        const isPast = phase.id < currentPhase;
        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => goToPhase(phase.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : isPast
                  ? "text-gray-600 hover:bg-gray-50"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isPast
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {isPast ? "\u2713" : phase.id + 1}
            </span>
            <span className="hidden sm:inline">{phase.tag}</span>
          </button>
        );
      })}
    </nav>
  );
}
