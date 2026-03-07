from unittest.mock import AsyncMock

from intake_assistant_api.services import template_cache

SAMPLE_YAML = "project:\n  name: test\n"
SAMPLE_ZIP = b"PK\x03\x04fake-zip-content"


def _mock_sdwc_client(zip_bytes: bytes = SAMPLE_ZIP) -> AsyncMock:
    sdwc = AsyncMock()
    sdwc.generate_zip = AsyncMock(return_value=zip_bytes)
    return sdwc


async def test_finalize_returns_zip(client) -> None:
    mock_sdwc = _mock_sdwc_client()

    from intake_assistant_api.main import app

    app.state.sdwc_client = mock_sdwc
    template_cache.set_template("test")

    try:
        resp = await client.post(
            "/api/v1/finalize",
            json={"yaml_content": SAMPLE_YAML},
        )

        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        assert "attachment" in resp.headers["content-disposition"]
        assert resp.content == SAMPLE_ZIP
        mock_sdwc.generate_zip.assert_called_once_with(SAMPLE_YAML)
    finally:
        template_cache.clear()


async def test_finalize_empty_yaml_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/finalize",
        json={"yaml_content": ""},
    )
    assert resp.status_code == 422


async def test_finalize_missing_yaml_returns_422(client) -> None:
    resp = await client.post(
        "/api/v1/finalize",
        json={},
    )
    assert resp.status_code == 422


async def test_finalize_sdwc_failure_returns_502(client) -> None:
    from intake_assistant_api.core.exceptions import ExternalServiceError

    mock_sdwc = AsyncMock()
    mock_sdwc.generate_zip = AsyncMock(
        side_effect=ExternalServiceError("SDwC", "ZIP generation failed"),
    )

    from intake_assistant_api.main import app

    app.state.sdwc_client = mock_sdwc
    template_cache.set_template("test")

    try:
        resp = await client.post(
            "/api/v1/finalize",
            json={"yaml_content": SAMPLE_YAML},
        )

        assert resp.status_code == 502
        assert "error" in resp.json()
    finally:
        template_cache.clear()
