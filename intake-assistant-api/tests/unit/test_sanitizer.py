from intake_assistant_api.core.sanitizer import sanitize_text


def test_strips_html_tags():
    assert sanitize_text("<script>alert('xss')</script>hello") == "alert('xss')hello"


def test_strips_nested_html():
    assert sanitize_text("<div><p>내용</p></div>") == "내용"


def test_strips_leading_trailing_whitespace():
    assert sanitize_text("  hello world  ") == "hello world"


def test_collapses_excessive_spaces():
    assert sanitize_text("hello     world") == "hello world"


def test_collapses_excessive_newlines():
    assert sanitize_text("hello\n\n\n\n\n\nworld") == "hello\n\n\nworld"


def test_preserves_reasonable_newlines():
    assert sanitize_text("hello\n\nworld") == "hello\n\nworld"


def test_preserves_normal_text():
    text = "할 일 관리 앱을 만들고 싶어요. 사용자가 할 일을 추가하고 완료 처리할 수 있어야 합니다."
    assert sanitize_text(text) == text


def test_combined_sanitization():
    dirty = "  <b>bold</b>   hello\n\n\n\n\n\nworld  "
    assert sanitize_text(dirty) == "bold hello\n\n\nworld"


def test_empty_after_strip_returns_empty():
    assert sanitize_text("   ") == ""


def test_analyze_request_sanitizes_user_input():
    from intake_assistant_api.schemas.analyze import AnalyzeRequest

    req = AnalyzeRequest(user_input="<b>bold</b>  hello")
    assert req.user_input == "bold hello"


def test_analyze_request_rejects_whitespace_only():
    import pytest

    from intake_assistant_api.schemas.analyze import AnalyzeRequest

    with pytest.raises(Exception):  # noqa: B017
        AnalyzeRequest(user_input="   ")


def test_generate_request_sanitizes_user_input():
    from intake_assistant_api.schemas.generate import GenerateRequest

    req = GenerateRequest(
        user_input="<script>xss</script>테스트",
        qa_answers=[{"question_id": "q1", "selected_ids": ["a"]}],
    )
    assert req.user_input == "xss테스트"
