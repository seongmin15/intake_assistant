interface TextAreaFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextAreaField({ value, onChange, placeholder, disabled }: TextAreaFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}
