import type { ArchitectureCard as ArchitectureCardType } from "@/api/types";

interface ArchitectureCardProps {
  card: ArchitectureCardType;
}

const LABELS: Record<keyof ArchitectureCardType, string> = {
  service_composition: "서비스 구성",
  data_storage: "데이터 저장",
  authentication: "인증",
  external_services: "외부 서비스",
  screen_count: "화면 수",
};

const FIELD_ORDER: (keyof ArchitectureCardType)[] = [
  "service_composition",
  "data_storage",
  "authentication",
  "external_services",
  "screen_count",
];

export function ArchitectureCard({ card }: ArchitectureCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900">아키텍처 카드</h2>
      <dl className="flex flex-col gap-3">
        {FIELD_ORDER.map((key) => (
          <div key={key} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <dt className="min-w-32 text-sm font-medium text-gray-500">{LABELS[key]}</dt>
            <dd className="text-sm text-gray-900">{card[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
