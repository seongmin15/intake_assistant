import type { FieldDef } from "../schema/fieldTypes";
import { useAdvancedStore } from "@/stores/advancedStore";
import { getByPath } from "@/utils/pathUtils";
import { TextField } from "./TextField";
import { TextAreaField } from "./TextAreaField";
import { EnumSelect } from "./EnumSelect";
import { BooleanToggle } from "./BooleanToggle";
import { NumberField } from "./NumberField";
import { AiRecommendButton } from "./AiRecommendButton";

interface FormFieldProps {
  field: FieldDef;
  /** Override path (for array items where path is relative) */
  basePath?: string;
}

export function FormField({ field, basePath }: FormFieldProps) {
  const setField = useAdvancedStore((s) => s.setField);
  const fullPath = basePath ? `${basePath}.${field.path}` : field.path;
  const value = useAdvancedStore((s) => getByPath(s.formData, fullPath));

  // Skip array/object/service_list types — handled by ArrayField/ServiceEditor
  if (field.type === "array" || field.type === "object" || field.type === "service_list") {
    return null;
  }

  const handleChange = (newValue: unknown) => {
    setField(fullPath, newValue);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        {field.aiRecommend && (
          <AiRecommendButton
            fieldPath={fullPath}
            description={field.description}
            enumValues={field.enumValues}
            fieldType={field.type}
          />
        )}
      </div>
      {field.description && (
        <p className="text-xs text-gray-400">{field.description}</p>
      )}
      {renderInput(field, value, handleChange)}
    </div>
  );
}

function renderInput(
  field: FieldDef,
  value: unknown,
  onChange: (value: unknown) => void,
) {
  switch (field.type) {
    case "text":
      return (
        <TextField
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case "enum":
      return (
        <EnumSelect
          value={(value as string) ?? ""}
          onChange={onChange}
          options={field.enumValues ?? []}
        />
      );
    case "boolean":
      return (
        <BooleanToggle
          value={(value as boolean) ?? field.defaultValue ?? false}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberField
          value={value as number | undefined}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    default:
      return null;
  }
}
