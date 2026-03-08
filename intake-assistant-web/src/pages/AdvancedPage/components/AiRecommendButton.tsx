import { useAdvancedStore } from "@/stores/advancedStore";

interface AiRecommendButtonProps {
  fieldPath: string;
  description?: string;
  enumValues?: string[];
  fieldType?: string;
}

export function AiRecommendButton({
  fieldPath,
  description,
  enumValues,
  fieldType,
}: AiRecommendButtonProps) {
  const recommendLoading = useAdvancedStore((s) => s.recommendLoading);
  const recommendError = useAdvancedStore((s) => s.recommendError);
  const requestRecommendation = useAdvancedStore((s) => s.requestRecommendation);

  const isLoading = recommendLoading === fieldPath;
  const showError = recommendError && !recommendLoading;

  const handleClick = () => {
    void requestRecommendation(fieldPath, {
      description,
      enum_values: enumValues,
      field_type: fieldType,
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600 transition hover:bg-purple-100 disabled:opacity-50"
        title="AI가 이 필드에 적합한 값을 추천합니다"
      >
        {isLoading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
            추천 중...
          </>
        ) : (
          <>
            <span className="text-sm">✦</span>
            AI 추천
          </>
        )}
      </button>
      {showError && (
        <span className="text-xs text-red-500" title={recommendError}>
          추천 실패
        </span>
      )}
    </span>
  );
}
