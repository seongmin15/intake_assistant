import type { FeatureItem } from "@/api/types";

interface FeatureChecklistProps {
  items: FeatureItem[];
}

export function FeatureChecklist({ items }: FeatureChecklistProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900">기능 체크리스트</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.name} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-green-500">✓</span>
            <div>
              <span className="font-medium text-gray-900">{item.name}</span>
              <span className="text-gray-500"> — {item.summary}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
