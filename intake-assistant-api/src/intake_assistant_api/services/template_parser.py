"""Parse field_requirements.yaml to extract schema metadata.

Reuses the recursive walking patterns from prompt_builder.py.
"""

from __future__ import annotations

import hashlib

import structlog
import yaml

logger = structlog.get_logger()

# Service types that have dedicated sub-schemas under services.children
_SERVICE_TYPES = ("backend_api", "web_ui", "worker", "mobile_app", "data_pipeline")


def compute_template_hash(yaml_text: str) -> str:
    """Compute a SHA-256 hash of the raw template YAML text."""
    digest = hashlib.sha256(yaml_text.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def extract_service_types(phases: dict) -> list[str]:
    """Extract available service types from the field_requirements structure."""
    children = _find_services_children(phases)
    if not children:
        return list(_SERVICE_TYPES)
    return [st for st in _SERVICE_TYPES if st in children]


def extract_enum_fields(phases: dict) -> dict[str, list[str]]:
    """Extract all enum fields and their allowed values.

    Returns a dict mapping dot-notation paths to lists of enum values.
    """
    enums: list[tuple[str, list[str]]] = []
    _walk_enums(phases, "", enums)
    return {path: values for path, values in enums}


def extract_required_fields(phases: dict) -> list[str]:
    """Extract all required field paths from the field_requirements structure."""
    required: list[str] = []
    _walk_required(phases, "", required)
    return required


def parse_field_requirements(yaml_str: str) -> dict | None:
    """Parse field_requirements YAML and return structured metadata.

    Returns None on any parse failure.
    """
    try:
        data = yaml.safe_load(yaml_str)
    except yaml.YAMLError:
        return None

    if not isinstance(data, dict) or "phases" not in data:
        return None

    try:
        phases = data["phases"]
        return {
            "service_types": extract_service_types(phases),
            "enum_fields": extract_enum_fields(phases),
            "required_fields": extract_required_fields(phases),
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Internal helpers — adapted from prompt_builder.py patterns
# ---------------------------------------------------------------------------


def _walk_enums(
    node: dict, path: str, result: list[tuple[str, list[str]]],
) -> None:
    """Recursively walk the YAML tree collecting fields with enum values."""
    if not isinstance(node, dict):
        return

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
            _walk_enums(value, f"services.{key}", result)
            continue

        enum_values = value.get("enum")
        if enum_values is not None and isinstance(enum_values, list):
            str_values = [str(v) for v in enum_values]
            result.append((current_path, str_values))

        # Recurse into children
        children = value.get("children", {})
        if children:
            _walk_enums(children, current_path, result)


def _walk_required(node: dict, path: str, result: list[str]) -> None:
    """Recursively walk the YAML tree collecting required field paths."""
    if not isinstance(node, dict):
        return

    for key, value in node.items():
        if not isinstance(value, dict):
            continue

        current_path = f"{path}.{key}" if path else key

        # Skip structural keys
        if key in ("phases", "sections", "children") or key.startswith("phase"):
            _walk_required(value, path, result)
            continue

        # Handle service type variant keys
        if key in _SERVICE_TYPES:
            _walk_required(value, f"services.{key}", result)
            continue

        if value.get("requirement") == "required":
            result.append(current_path)

        # Recurse into children
        children = value.get("children", {})
        if children:
            _walk_required(children, current_path, result)


def _find_services_children(phases: dict) -> dict | None:
    """Find the services section's children (per-service-type schemas)."""
    for phase_data in phases.values():
        if not isinstance(phase_data, dict):
            continue
        sections = phase_data.get("sections", {})
        services = sections.get("services")
        if services and isinstance(services, dict):
            return services.get("children", {})
    return None
