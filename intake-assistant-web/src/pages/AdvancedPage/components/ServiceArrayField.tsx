import type { FieldDef } from "../schema/fieldTypes";
import type { ServiceFormData } from "@/stores/advancedStore";
import { useAdvancedStore } from "@/stores/advancedStore";
import { TextField } from "./TextField";
import { EnumSelect } from "./EnumSelect";
import { BooleanToggle } from "./BooleanToggle";

interface ServiceArrayFieldProps {
  field: FieldDef;
  service: ServiceFormData;
  serviceIndex: number;
}

export function ServiceArrayField({ field, service, serviceIndex }: ServiceArrayFieldProps) {
  const setServiceField = useAdvancedStore((s) => s.setServiceField);
  const items = (getNestedValue(service, field.path) as unknown[]) ?? [];
  const itemFields = field.arrayItemFields ?? [];
  const isSimple = itemFields.length === 1 && itemFields[0]!.path === "";

  const handleAdd = () => {
    if (isSimple) {
      setServiceField(serviceIndex, field.path, [...items, ""]);
    } else {
      const emptyItem: Record<string, unknown> = {};
      for (const f of itemFields) {
        if (f.defaultValue !== undefined) {
          emptyItem[f.path] = f.defaultValue;
        }
      }
      setServiceField(serviceIndex, field.path, [...items, emptyItem]);
    }
  };

  const handleRemove = (idx: number) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setServiceField(serviceIndex, field.path, newItems);
  };

  const handleItemChange = (idx: number, subPath: string, value: unknown) => {
    const newItems = [...items];
    if (isSimple) {
      newItems[idx] = value;
    } else {
      const item = { ...(newItems[idx] as Record<string, unknown>) };
      setNestedValue(item, subPath, value);
      newItems[idx] = item;
    }
    setServiceField(serviceIndex, field.path, newItems);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        <button type="button" onClick={handleAdd} className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50">
          + 추가
        </button>
      </div>
      {field.description && <p className="text-xs text-gray-400">{field.description}</p>}

      {items.length === 0 && <p className="text-xs text-gray-300">항목이 없습니다.</p>}

      {items.map((item, idx) => {
        if (isSimple) {
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{idx + 1}.</span>
              <div className="flex-1">
                <TextField
                  value={(item as string) ?? ""}
                  onChange={(v) => handleItemChange(idx, "", v)}
                  placeholder={itemFields[0]?.placeholder}
                />
              </div>
              <button type="button" onClick={() => handleRemove(idx)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
            </div>
          );
        }

        const itemObj = item as Record<string, unknown>;
        return (
          <div key={idx} className="rounded-lg border border-gray-100 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">#{idx + 1}</span>
              <button type="button" onClick={() => handleRemove(idx)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
            </div>
            <div className="flex flex-col gap-2">
              {itemFields.map((f) => {
                if (f.type === "array") {
                  return (
                    <NestedSimpleArray
                      key={f.path}
                      field={f}
                      value={(getNestedValue(itemObj, f.path) as string[]) ?? []}
                      onChange={(v) => handleItemChange(idx, f.path, v)}
                    />
                  );
                }
                const val = getNestedValue(itemObj, f.path);
                return (
                  <div key={f.path} className="flex flex-col gap-1">
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
                      {f.label}
                      {f.required && <span className="text-red-500">*</span>}
                    </label>
                    {renderSimpleInput(f, val, (v) => handleItemChange(idx, f.path, v))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NestedSimpleArray({ field, value, onChange }: { field: FieldDef; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{field.label}</label>
        <button type="button" onClick={() => onChange([...value, ""])} className="text-xs text-blue-600">+ 추가</button>
      </div>
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <TextField
              value={item}
              onChange={(v) => { const n = [...value]; n[i] = v; onChange(n); }}
              placeholder={field.arrayItemFields?.[0]?.placeholder}
            />
          </div>
          <button type="button" onClick={() => { const n = [...value]; n.splice(i, 1); onChange(n); }} className="text-xs text-red-400">삭제</button>
        </div>
      ))}
    </div>
  );
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
}

function renderSimpleInput(field: FieldDef, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "text": return <TextField value={(value as string) ?? ""} onChange={onChange} placeholder={field.placeholder} />;
    case "textarea": return <TextField value={(value as string) ?? ""} onChange={onChange} placeholder={field.placeholder} />;
    case "enum": return <EnumSelect value={(value as string) ?? ""} onChange={onChange} options={field.enumValues ?? []} />;
    case "boolean": return <BooleanToggle value={(value as boolean) ?? false} onChange={onChange} />;
    default: return <TextField value={(value as string) ?? ""} onChange={onChange} />;
  }
}
