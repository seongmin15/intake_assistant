import { useState } from "react";

import type { SectionDef } from "../schema/fieldTypes";
import { useAdvancedStore } from "@/stores/advancedStore";
import { FormField } from "./FormField";
import { ArrayField } from "./ArrayField";
import { ServiceTypeSelector } from "./ServiceTypeSelector";
import { ServiceEditor } from "./ServiceEditor";

interface FieldGroupProps {
  section: SectionDef;
}

export function FieldGroup({ section }: FieldGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsible = section.collapsible !== false;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => isCollapsible && setCollapsed(!collapsed)}
        className={`flex w-full items-center justify-between px-5 py-4 text-left ${
          isCollapsible ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
        }`}
      >
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            {section.title}
          </h3>
          {section.description && (
            <p className="mt-0.5 text-xs text-gray-400">{section.description}</p>
          )}
        </div>
        {isCollapsible && (
          <span className="text-gray-400 transition-transform" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            &#9660;
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-4 border-t border-gray-100 px-5 py-4">
          {section.fields.map((field) => {
            if (field.type === "array") {
              return <ArrayField key={field.path} field={field} />;
            }
            if (field.type === "service_list") {
              return <ServiceListRenderer key={field.path} />;
            }
            return <FormField key={field.path} field={field} />;
          })}
        </div>
      )}
    </div>
  );
}

function ServiceListRenderer() {
  const services = useAdvancedStore((s) => s.services);

  return (
    <div className="flex flex-col gap-4">
      <ServiceTypeSelector />
      {services.length === 0 && (
        <p className="text-sm text-gray-300">서비스가 없습니다. 위에서 서비스 타입을 선택하여 추가하세요.</p>
      )}
      {services.map((service, index) => (
        <ServiceEditor key={service.id} service={service} index={index} />
      ))}
    </div>
  );
}
