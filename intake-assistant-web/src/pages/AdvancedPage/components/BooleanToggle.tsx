interface BooleanToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BooleanToggle({ value, onChange, disabled }: BooleanToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        value ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
