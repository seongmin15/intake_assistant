"""Dynamically build prompt sections from SDwC field_requirements.yaml."""

from __future__ import annotations

import structlog
import yaml

logger = structlog.get_logger()

# Service types that have dedicated sub-schemas under services.children
_SERVICE_TYPES = ("backend_api", "web_ui", "worker", "mobile_app", "data_pipeline")


def build_dynamic_sections(yaml_str: str) -> str | None:
    """Parse field_requirements YAML and return formatted prompt sections.

    Returns None on any parse failure so caller can fall back to static text.
    """
    try:
        data = yaml.safe_load(yaml_str)
    except yaml.YAMLError:
        return None

    if not isinstance(data, dict) or "phases" not in data:
        return None

    try:
        phases = data["phases"]
        required_sections = _build_required_sections(phases)
        per_service = _build_per_service_fields(phases)
        array_mins = _build_array_minimums(phases)
        enums = _build_enum_reference(phases)

        parts = [
            "## Required Sections Checklist\n",
            "The following top-level sections are REQUIRED and must always be present.",
            "Required child fields are shown in parentheses.\n",
            required_sections,
            per_service,
            array_mins,
            enums,
        ]
        return "\n".join(parts)
    except Exception:
        return None


def _build_required_sections(phases: dict) -> str:
    """Walk required sections and list them with required children."""
    lines: list[str] = []

    for phase_data in phases.values():
        sections = phase_data.get("sections", {})
        for sec_name, sec_info in sections.items():
            if sec_name == "services":
                lines.append("- services[≥1] (see Per-Service Type Required Fields below)")
                continue

            if sec_info.get("requirement") != "required":
                continue

            req_children = _collect_required_children(sec_info)
            if req_children:
                lines.append(f"- {sec_name} ({', '.join(req_children)})")
            else:
                lines.append(f"- {sec_name}")

    return "\n".join(lines)


def _collect_required_children(node: dict, prefix: str = "") -> list[str]:
    """Collect required child field names, adding array notation where appropriate."""
    result: list[str] = []
    children = node.get("children", {})

    for name, info in children.items():
        if not isinstance(info, dict):
            continue
        if info.get("requirement") != "required":
            continue

        display = f"{prefix}{name}" if prefix else name
        type_str = info.get("type", "")
        min_len = info.get("min_length")

        if min_len is not None:
            display += f"[≥{min_len}]"

        result.append(display)

        # Recurse into children of this field if it has required children
        sub_children = info.get("children", {})
        if sub_children:
            sub_required = []
            for sub_name, sub_info in sub_children.items():
                if isinstance(sub_info, dict) and sub_info.get("requirement") == "required":
                    sub_display = sub_name
                    if sub_info.get("min_length") is not None:
                        sub_display += f"[≥{sub_info['min_length']}]"
                    sub_required.append(sub_display)
            if sub_required and _is_list_type(type_str):
                result.append(f"  - each {display.split('[')[0]} item: {', '.join(sub_required)}")

    return result


def _build_per_service_fields(phases: dict) -> str:
    """Build per-service type required fields section."""
    services_children = _find_services_children(phases)
    if not services_children:
        return ""

    lines = [
        "\n## Per-Service Type Required Fields\n",
        "All service types share: name, type, responsibility, build_tool, deployment.target\n",
    ]

    for svc_type in _SERVICE_TYPES:
        svc_data = services_children.get(svc_type)
        if not svc_data:
            continue

        lines.append(f"### {svc_type}")

        # Collect required fields specific to this service type (excluding shared ones)
        shared = {"name", "type", "responsibility", "build_tool", "deployment"}
        specific_required: list[str] = []
        sub_notes: list[str] = []

        for field_name, field_info in svc_data.items():
            if field_name in shared:
                continue
            if not isinstance(field_info, dict):
                continue
            if field_info.get("requirement") != "required":
                continue

            display = field_name
            min_len = field_info.get("min_length")
            if min_len is not None:
                display += f"[≥{min_len}]"
            specific_required.append(display)

            # Note required children for list fields
            children = field_info.get("children", {})
            if children:
                child_req = []
                for cn, ci in children.items():
                    if isinstance(ci, dict) and ci.get("requirement") == "required":
                        child_display = cn
                        if ci.get("min_length") is not None:
                            child_display += f"[≥{ci['min_length']}]"
                        child_req.append(child_display)
                if child_req:
                    base_name = field_name.rstrip("s") if field_name.endswith("s") else field_name
                    sub_notes.append(f"  - each {base_name}: {', '.join(child_req)}")

                # Recurse one more level for grandchildren (e.g., screens.components)
                for cn, ci in children.items():
                    if not isinstance(ci, dict):
                        continue
                    gc = ci.get("children", {})
                    if not gc:
                        continue
                    gc_req = [
                        gcn for gcn, gci in gc.items()
                        if isinstance(gci, dict) and gci.get("requirement") == "required"
                    ]
                    if gc_req:
                        gc_base = cn.rstrip("s") if cn.endswith("s") else cn
                        sub_notes.append(f"  - each {gc_base}: {', '.join(gc_req)}")

        if specific_required:
            lines.append("- " + ", ".join(specific_required))
        for note in sub_notes:
            lines.append(note)
        lines.append("")

    return "\n".join(lines)


def _build_array_minimums(phases: dict) -> str:
    """Collect fields with min_length requirements."""
    mins: list[str] = []
    _walk_min_length(phases, "", mins)

    if not mins:
        return ""

    lines = [
        "\n## Array Minimum Requirements\n",
        "These array fields require at least 1 item:",
    ]
    lines.extend(f"- {path}" for path in mins)
    return "\n".join(lines)


def _walk_min_length(node: dict, path: str, result: list[str]) -> None:
    """Recursively walk the YAML tree collecting fields with min_length."""
    if isinstance(node, dict):
        for key, value in node.items():
            if not isinstance(value, dict):
                continue

            current_path = f"{path}.{key}" if path else key

            # Skip structural keys
            if key in ("phases", "sections", "children") or key.startswith("phase"):
                _walk_min_length(value, path, result)
                continue

            # Skip service type variant keys (handled in per-service section)
            if key in _SERVICE_TYPES:
                _walk_min_length(value, f"services[{key}]", result)
                continue

            min_len = value.get("min_length")
            if min_len is not None:
                result.append(current_path)

            # Recurse into children
            children = value.get("children", {})
            if children:
                _walk_min_length(children, current_path, result)


def _build_enum_reference(phases: dict) -> str:
    """Collect fields with enum values and format as a reference section."""
    enums: list[tuple[str, list[str]]] = []
    _walk_enums(phases, "", enums)

    if not enums:
        return ""

    lines = [
        "\n## Enum Value Reference\n",
        "Use ONLY these exact values for enum fields:\n",
    ]

    for path, values in enums:
        lines.append(f"- {path}: {' | '.join(values)}")

    return "\n".join(lines)


def _walk_enums(node: dict, path: str, result: list[tuple[str, list[str]]]) -> None:
    """Recursively walk the YAML tree collecting fields with enum values."""
    if isinstance(node, dict):
        for key, value in node.items():
            if not isinstance(value, dict):
                continue

            current_path = f"{path}.{key}" if path else key

            # Skip structural keys
            if key in ("phases", "sections", "children") or key.startswith("phase"):
                _walk_enums(value, path, result)
                continue

            # Handle service type variant keys
            if key in _SERVICE_TYPES:
                _walk_enums(value, f"services[{key}]", result)
                continue

            enum_values = value.get("enum")
            if enum_values is not None and isinstance(enum_values, list):
                str_values = [str(v) for v in enum_values]
                result.append((current_path, str_values))

            # Recurse into children
            children = value.get("children", {})
            if children:
                _walk_enums(children, current_path, result)


def _find_services_children(phases: dict) -> dict | None:
    """Find the services section's children (per-service-type schemas)."""
    for phase_data in phases.values():
        sections = phase_data.get("sections", {})
        services = sections.get("services")
        if services and isinstance(services, dict):
            return services.get("children", {})
    return None


def _is_list_type(type_str: str) -> bool:
    """Check if the type string represents a list type."""
    return "list[" in type_str.lower() if type_str else False
