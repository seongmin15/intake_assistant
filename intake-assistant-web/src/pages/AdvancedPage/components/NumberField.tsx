interface NumberFieldProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberField({ value, onChange, placeholder, disabled }: NumberFieldProps) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : Number(v));
      }}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}
