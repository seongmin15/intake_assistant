interface EnumSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}

export function EnumSelect({ value, onChange, options, disabled }: EnumSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="">선택하세요</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
