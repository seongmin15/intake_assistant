_cached_template: str | None = None
_cached_field_requirements: str | None = None


def get_template() -> str | None:
    return _cached_template


def set_template(yaml_text: str) -> None:
    global _cached_template
    _cached_template = yaml_text


def is_loaded() -> bool:
    return _cached_template is not None


def get_field_requirements() -> str | None:
    return _cached_field_requirements


def set_field_requirements(yaml_text: str) -> None:
    global _cached_field_requirements
    _cached_field_requirements = yaml_text


def clear() -> None:
    global _cached_template, _cached_field_requirements
    _cached_template = None
    _cached_field_requirements = None
