import type { Question } from "@/api/types";

interface QuestionCardProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

export function QuestionCard({ question, value, onChange }: QuestionCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-gray-900">{question.title}</h3>
      <p className="text-sm text-gray-500">{question.description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder ?? ""}
        rows={3}
        className="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}
