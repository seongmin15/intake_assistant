import { phases } from "../schema/phaseSchema";
import { FieldGroup } from "./FieldGroup";

interface PhaseRendererProps {
  phaseId: number;
}

export function PhaseRenderer({ phaseId }: PhaseRendererProps) {
  const phase = phases[phaseId];
  if (!phase) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {phase.tag}: {phase.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{phase.description}</p>
      </div>

      {phase.sections.map((section) => (
        <FieldGroup key={section.id} section={section} />
      ))}
    </div>
  );
}
