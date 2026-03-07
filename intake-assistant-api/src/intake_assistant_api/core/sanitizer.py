import re

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_EXCESSIVE_WHITESPACE_RE = re.compile(r"[^\S\n]{2,}")
_EXCESSIVE_NEWLINES_RE = re.compile(r"\n{4,}")


def sanitize_text(value: str) -> str:
    value = _HTML_TAG_RE.sub("", value)
    value = value.strip()
    value = _EXCESSIVE_WHITESPACE_RE.sub(" ", value)
    value = _EXCESSIVE_NEWLINES_RE.sub("\n\n\n", value)
    return value
