import { useState } from "react";

interface RevisionInputProps {
  onSubmit: (revisionRequest: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function RevisionInput({ onSubmit, onCancel, disabled }: RevisionInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-bold text-gray-900">수정 요청</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 인증을 JWT로 변경해 주세요. Redis 캐시도 추가해 주세요."
        rows={3}
        maxLength={2000}
        disabled={disabled}
        className="resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none disabled:opacity-50"
      />
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          수정 반영하기
        </button>
      </div>
    </div>
  );
}
