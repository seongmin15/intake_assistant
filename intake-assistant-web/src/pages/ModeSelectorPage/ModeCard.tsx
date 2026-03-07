interface ModeCardProps {
  title: string;
  description: string;
  target: string;
  details: string[];
  onClick: () => void;
}

export function ModeCard({ title, description, target, details, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full max-w-sm cursor-pointer flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
    >
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600">{description}</p>
      <p className="text-xs text-gray-400">대상: {target}</p>
      <ul className="flex flex-col gap-1">
        {details.map((detail) => (
          <li key={detail} className="text-sm text-gray-500">
            • {detail}
          </li>
        ))}
      </ul>
    </button>
  );
}
