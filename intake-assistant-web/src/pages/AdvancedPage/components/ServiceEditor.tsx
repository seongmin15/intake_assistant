import { useState } from "react";

import type { ServiceFormData } from "@/stores/advancedStore";
import { useAdvancedStore } from "@/stores/advancedStore";
import { getServiceFields, SERVICE_TYPES } from "../schema/serviceSchema";
import type { FieldDef } from "../schema/fieldTypes";
import { TextField } from "./TextField";
import { TextAreaField } from "./TextAreaField";
import { EnumSelect } from "./EnumSelect";
import { BooleanToggle } from "./BooleanToggle";
import { NumberField } from "./NumberField";
import { ServiceArrayField } from "./ServiceArrayField";

interface ServiceEditorProps {
  service: ServiceFormData;
  index: number;
}

export function ServiceEditor({ service, index }: ServiceEditorProps) {
  const removeService = useAdvancedStore((s) => s.removeService);
  const setServiceField = useAdvancedStore((s) => s.setServiceField);
  const [collapsed, setCollapsed] = useState(false);

  const typeLabel = SERVICE_TYPES.find((t) => t.value === service.type)?.label ?? service.type;
  const fields = getServiceFields(service.type);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex cursor-pointer items-center gap-2 text-left"
        >
          <span className="text-xs text-gray-400" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>
            &#9660;
          </span>
          <span className="text-sm font-semibold text-gray-800">
            {service.name || `서비스 #${index + 1}`}
          </span>
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            {typeLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={() => removeService(index)}
          className="text-xs text-red-400 transition hover:text-red-600"
        >
          삭제
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-4 border-t border-blue-100 px-4 py-4">
          {fields.map((field) => (
            <ServiceFieldRenderer
              key={field.path}
              field={field}
              service={service}
              index={index}
              setServiceField={setServiceField}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ServiceFieldRendererProps {
  field: FieldDef;
  service: ServiceFormData;
  index: number;
  setServiceField: (index: number, field: string, value: unknown) => void;
}

function ServiceFieldRenderer({ field, service, index, setServiceField }: ServiceFieldRendererProps) {
  if (field.type === "array") {
    return (
      <ServiceArrayField
        field={field}
        service={service}
        serviceIndex={index}
      />
    );
  }

  // For nested paths like "deployment.target", flatten to "deployment.target"
  const value = getNestedValue(service, field.path);

  const handleChange = (newValue: unknown) => {
    setServiceField(index, field.path, newValue);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-gray-400">{field.description}</p>
      )}
      {renderServiceInput(field, value, handleChange)}
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

function renderServiceInput(
  field: FieldDef,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  switch (field.type) {
    case "text":
      return <TextField value={(value as string) ?? ""} onChange={onChange} placeholder={field.placeholder} />;
    case "textarea":
      return <TextAreaField value={(value as string) ?? ""} onChange={onChange} placeholder={field.placeholder} />;
    case "enum":
      return <EnumSelect value={(value as string) ?? ""} onChange={onChange} options={field.enumValues ?? []} />;
    case "boolean":
      return <BooleanToggle value={(value as boolean) ?? field.defaultValue ?? false} onChange={onChange} />;
    case "number":
      return <NumberField value={value as number | undefined} onChange={onChange} placeholder={field.placeholder} />;
    default:
      return null;
  }
}
