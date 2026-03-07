import { useState } from "react";

interface TextInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function TextInput({ onSubmit, disabled }: TextInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <label htmlFor="user-input" className="text-lg font-semibold text-gray-900">
        어떤 서비스를 만들고 싶으신가요?
      </label>
      <textarea
        id="user-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예: 팀원들이 할 일을 관리하고 진행 상황을 공유할 수 있는 웹 서비스를 만들고 싶어요."
        rows={5}
        maxLength={5000}
        disabled={disabled}
        className="resize-none rounded-xl border border-gray-300 p-4 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none disabled:opacity-50"
      />
      <p className="text-xs text-gray-400">
        기술적인 용어를 몰라도 괜찮아요. 자유롭게 설명해 주세요.
      </p>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="self-end rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        분석하기
      </button>
    </div>
  );
}
