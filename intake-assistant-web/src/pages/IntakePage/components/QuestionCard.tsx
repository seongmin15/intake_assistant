import type { Question } from "@/api/types";

interface QuestionCardProps {
  question: Question;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export function QuestionCard({ question, selectedIds, onChange }: QuestionCardProps) {
  const isSingle = question.type === "single";

  const handleChange = (choiceId: string, checked: boolean) => {
    if (isSingle) {
      onChange([choiceId]);
    } else {
      const next = checked
        ? [...selectedIds, choiceId]
        : selectedIds.filter((id) => id !== choiceId);
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-gray-900">{question.title}</h3>
      <p className="text-sm text-gray-500">{question.description}</p>
      <div className="flex flex-col gap-2">
        {question.choices.map((choice) => {
          const isSelected = selectedIds.includes(choice.id);
          return (
            <label
              key={choice.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                isSelected
                  ? "border-blue-400 bg-blue-50 text-blue-800"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={question.id}
                value={choice.id}
                checked={isSelected}
                onChange={(e) => handleChange(choice.id, e.target.checked)}
                className="accent-blue-600"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
