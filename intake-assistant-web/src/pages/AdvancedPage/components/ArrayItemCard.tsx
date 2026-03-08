import type { FieldDef } from "../schema/fieldTypes";
import { useAdvancedStore } from "@/stores/advancedStore";
import { TextField } from "./TextField";
import { FormField } from "./FormField";
import { ArrayField } from "./ArrayField";

interface ArrayItemCardProps {
  index: number;
  arrayPath: string;
  itemFields: FieldDef[];
  isSimple: boolean;
  onRemove: () => void;
}

export function ArrayItemCard({ index, arrayPath, itemFields, isSimple, onRemove }: ArrayItemCardProps) {
  const getField = useAdvancedStore((s) => s.getField);
  const setField = useAdvancedStore((s) => s.setField);

  const itemPath = `${arrayPath}.${index}`;

  if (isSimple) {
    const value = (getField(itemPath) as string) ?? "";
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{index + 1}.</span>
        <div className="flex-1">
          <TextField
            value={value}
            onChange={(v) => setField(itemPath, v)}
            placeholder={itemFields[0]?.placeholder}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-red-400 transition hover:text-red-600"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 transition hover:text-red-600"
        >
          삭제
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {itemFields.map((field) => {
          if (field.type === "array") {
            return <ArrayField key={field.path} field={field} basePath={itemPath} />;
          }
          return <FormField key={field.path} field={field} basePath={itemPath} />;
        })}
      </div>
    </div>
  );
}
