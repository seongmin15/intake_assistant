import httpx
import pytest

from intake_assistant_api.core.exceptions import ExternalServiceError
from intake_assistant_api.services.sdwc_client import SDwCClient

SAMPLE_YAML = "project:\n  name: test\n"


@pytest.fixture
def sdwc_client(respx_mock):
    http_client = httpx.AsyncClient()
    return SDwCClient(http_client, "http://sdwc-test:8080")


async def test_fetch_template_success(sdwc_client, respx_mock):
    respx_mock.get("http://sdwc-test:8080/api/v1/template").respond(200, text=SAMPLE_YAML)
    result = await sdwc_client.fetch_template()
    assert result == SAMPLE_YAML


async def test_fetch_template_server_error(sdwc_client, respx_mock):
    respx_mock.get("http://sdwc-test:8080/api/v1/template").respond(500)
    result = await sdwc_client.fetch_template()
    assert result is None


async def test_fetch_template_timeout(sdwc_client, respx_mock):
    respx_mock.get("http://sdwc-test:8080/api/v1/template").side_effect = httpx.ConnectTimeout(
        "timed out"
    )
    result = await sdwc_client.fetch_template()
    assert result is None


async def test_fetch_field_requirements_success(sdwc_client, respx_mock):
    yaml_text = "version: '1.0'\nphases: {}\n"
    respx_mock.get("http://sdwc-test:8080/api/v1/field-requirements").respond(200, text=yaml_text)
    result = await sdwc_client.fetch_field_requirements()
    assert result == yaml_text


async def test_fetch_field_requirements_server_error(sdwc_client, respx_mock):
    respx_mock.get("http://sdwc-test:8080/api/v1/field-requirements").respond(500)
    result = await sdwc_client.fetch_field_requirements()
    assert result is None


async def test_fetch_field_requirements_timeout(sdwc_client, respx_mock):
    respx_mock.get("http://sdwc-test:8080/api/v1/field-requirements").side_effect = (
        httpx.ConnectTimeout("timed out")
    )
    result = await sdwc_client.fetch_field_requirements()
    assert result is None


async def test_validate_yaml_success(sdwc_client, respx_mock):
    respx_mock.post("http://sdwc-test:8080/api/v1/validate").respond(
        200, json={"valid": True, "errors": [], "warnings": []}
    )
    result = await sdwc_client.validate_yaml("project:\n  name: test\n")
    assert result["valid"] is True
    assert result["errors"] == []


async def test_validate_yaml_validation_failure(sdwc_client, respx_mock):
    error_response = {
        "valid": False,
        "errors": [
            {
                "type": "https://sdwc.dev/errors/validation-failed",
                "title": "Validation Failed",
                "status": 422,
                "detail": "project.name: empty",
                "instance": "/api/v1/validate",
            }
        ],
        "warnings": [],
    }
    respx_mock.post("http://sdwc-test:8080/api/v1/validate").respond(200, json=error_response)
    result = await sdwc_client.validate_yaml("project:\n  name: \n")
    assert result["valid"] is False
    assert len(result["errors"]) == 1


async def test_validate_yaml_server_error(sdwc_client, respx_mock):
    respx_mock.post("http://sdwc-test:8080/api/v1/validate").respond(500)
    with pytest.raises(ExternalServiceError, match="SDwC"):
        await sdwc_client.validate_yaml("project:\n  name: test\n")


async def test_generate_zip_success(sdwc_client, respx_mock):
    zip_bytes = b"PK\x03\x04fake-zip"
    respx_mock.post("http://sdwc-test:8080/api/v1/generate").respond(200, content=zip_bytes)
    result = await sdwc_client.generate_zip("project:\n  name: test\n")
    assert result == zip_bytes


async def test_generate_zip_server_error(sdwc_client, respx_mock):
    respx_mock.post("http://sdwc-test:8080/api/v1/generate").respond(500)
    with pytest.raises(ExternalServiceError, match="SDwC"):
        await sdwc_client.generate_zip("project:\n  name: test\n")


async def test_generate_zip_timeout(sdwc_client, respx_mock):
    respx_mock.post("http://sdwc-test:8080/api/v1/generate").side_effect = httpx.ReadTimeout(
        "timed out"
    )
    with pytest.raises(ExternalServiceError, match="ZIP generation failed"):
        await sdwc_client.generate_zip("project:\n  name: test\n")
