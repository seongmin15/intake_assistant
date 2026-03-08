export type FieldType =
  | "text"
  | "textarea"
  | "enum"
  | "boolean"
  | "number"
  | "array"
  | "object"
  | "service_list";

export interface FieldDef {
  /** Dot-notation path from formData root, e.g. "project.name" */
  path: string;
  label: string;
  /** Korean help text shown below the field */
  description?: string;
  type: FieldType;
  required: boolean;
  /** For enum fields */
  enumValues?: string[];
  /** For array fields — schema of each item */
  arrayItemFields?: FieldDef[];
  /** For object fields — nested fields */
  children?: FieldDef[];
  /** Placeholder text */
  placeholder?: string;
  /** Conditional: only show when condition is met */
  condition?: {
    /** Path to check */
    field: string;
    /** Show when field equals one of these values */
    values: string[];
  };
  /** Whether AI recommendation is available for this field */
  aiRecommend?: boolean;
  /** Default value */
  defaultValue?: unknown;
}

export interface SectionDef {
  id: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  /** Collapsible — default expanded */
  collapsible?: boolean;
}

export interface PhaseDef {
  id: number;
  name: string;
  /** Short phase identifier */
  tag: string;
  description: string;
  sections: SectionDef[];
}
