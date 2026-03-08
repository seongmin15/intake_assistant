import { useState } from "react";

import type { SchemaDrift } from "../schema/schemaDrift";

interface SchemaDriftBannerProps {
  drift: SchemaDrift;
}

export function SchemaDriftBanner({ drift }: SchemaDriftBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!drift.hasDrift || dismissed) return null;

  const isMajor = drift.missingRequiredFields.length > 0 || drift.newServiceTypes.length > 0;
  const borderColor = isMajor ? "border-red-300" : "border-yellow-300";
  const bgColor = isMajor ? "bg-red-50" : "bg-yellow-50";
  const titleColor = isMajor ? "text-red-700" : "text-yellow-700";
  const textColor = isMajor ? "text-red-600" : "text-yellow-600";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} px-4 py-3`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className={`text-sm font-semibold ${titleColor}`}>
            {isMajor ? "SDwC 템플릿 변경 감지 (주요)" : "SDwC 템플릿 변경 감지"}
          </h4>
          <p className={`mt-1 text-xs ${textColor}`}>
            {isMajor
              ? "템플릿에 중요한 변경이 있습니다. 개발자 업데이트를 권장합니다."
              : "템플릿에 새 옵션이 추가되었습니다. 새 값은 드롭다운에 자동 반영됩니다."}
          </p>

          <ul className={`mt-2 space-y-1 text-xs ${textColor}`}>
            {drift.newServiceTypes.length > 0 && (
              <li>새 서비스 타입: {drift.newServiceTypes.join(", ")}</li>
            )}
            {drift.removedServiceTypes.length > 0 && (
              <li>제거된 서비스 타입: {drift.removedServiceTypes.join(", ")}</li>
            )}
            {drift.newEnumValues.map((e) => (
              <li key={e.path}>
                {e.path}: +{e.added.join(", ")}
              </li>
            ))}
            {drift.missingRequiredFields.length > 0 && (
              <li>
                누락된 필수 필드: {drift.missingRequiredFields.join(", ")}
              </li>
            )}
          </ul>
        </div>

        {!isMajor && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-4 text-xs text-yellow-500 transition hover:text-yellow-700"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
