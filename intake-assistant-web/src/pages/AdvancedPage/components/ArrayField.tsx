import type { FieldDef } from "../schema/fieldTypes";
import { useAdvancedStore } from "@/stores/advancedStore";
import { getByPath } from "@/utils/pathUtils";
import { ArrayItemCard } from "./ArrayItemCard";

interface ArrayFieldProps {
  field: FieldDef;
  basePath?: string;
}

export function ArrayField({ field, basePath }: ArrayFieldProps) {
  const formData = useAdvancedStore((s) => s.formData);
  const addArrayItem = useAdvancedStore((s) => s.addArrayItem);
  const removeArrayItem = useAdvancedStore((s) => s.removeArrayItem);

  const fullPath = basePath ? `${basePath}.${field.path}` : field.path;
  const items = (getByPath(formData, fullPath) as unknown[]) ?? [];
  const itemFields = field.arrayItemFields ?? [];

  const isSimple = itemFields.length === 1 && itemFields[0]!.path === "";

  const handleAdd = () => {
    if (isSimple) {
      addArrayItem(fullPath, "");
    } else {
      const emptyItem: Record<string, unknown> = {};
      for (const f of itemFields) {
        if (f.defaultValue !== undefined) {
          emptyItem[f.path] = f.defaultValue;
        }
      }
      addArrayItem(fullPath, emptyItem);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
        >
          + 추가
        </button>
      </div>
      {field.description && (
        <p className="text-xs text-gray-400">{field.description}</p>
      )}

      {items.length === 0 && (
        <p className="text-xs text-gray-300">항목이 없습니다. '+ 추가'를 클릭하세요.</p>
      )}

      {items.map((_, index) => (
        <ArrayItemCard
          key={`${fullPath}.${index}`}
          index={index}
          arrayPath={fullPath}
          itemFields={itemFields}
          isSimple={isSimple}
          onRemove={() => removeArrayItem(fullPath, index)}
        />
      ))}
    </div>
  );
}
