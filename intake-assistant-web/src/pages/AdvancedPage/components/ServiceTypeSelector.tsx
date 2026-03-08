import { useState } from "react";

import { useAdvancedStore } from "@/stores/advancedStore";
import { SERVICE_TYPES } from "../schema/serviceSchema";

export function ServiceTypeSelector() {
  const addService = useAdvancedStore((s) => s.addService);
  const [selectedType, setSelectedType] = useState("");

  const handleAdd = () => {
    if (!selectedType) return;
    addService(selectedType);
    setSelectedType("");
  };

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label htmlFor="service-type-select" className="mb-1 block text-sm font-medium text-gray-700">
          서비스 타입 선택
        </label>
        <select
          id="service-type-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">타입을 선택하세요</option>
          {SERVICE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} ({t.value})
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedType}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
      >
        서비스 추가
      </button>
    </div>
  );
}
