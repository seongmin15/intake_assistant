import httpx
import pytest

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
