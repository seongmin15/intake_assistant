import httpx
import structlog

logger = structlog.get_logger()


class SDwCClient:
    def __init__(self, http_client: httpx.AsyncClient, base_url: str) -> None:
        self._http = http_client
        self._base_url = base_url.rstrip("/")

    async def fetch_template(self) -> str | None:
        url = f"{self._base_url}/api/v1/template"
        try:
            resp = await self._http.get(url, timeout=10.0)
            resp.raise_for_status()
            await logger.ainfo("sdwc_template_fetched", url=url)
            return resp.text
        except httpx.HTTPError as exc:
            await logger.awarning("sdwc_template_fetch_failed", url=url, error=str(exc))
            return None

    async def validate_yaml(self, yaml_content: str) -> dict:
        """Validate YAML content via SDwC /api/v1/validate endpoint."""
        from intake_assistant_api.core.exceptions import ExternalServiceError

        url = f"{self._base_url}/api/v1/validate"
        try:
            resp = await self._http.post(
                url,
                json={"yaml_content": yaml_content},
                timeout=10.0,
            )
            resp.raise_for_status()
            data: dict = resp.json()
            await logger.ainfo("sdwc_validate_completed", success=data.get("success"))
            return data
        except httpx.HTTPError as exc:
            await logger.aerror("sdwc_validate_failed", url=url, error=str(exc))
            raise ExternalServiceError("SDwC", f"Validation request failed: {exc}") from exc

    async def generate_zip(self, yaml_content: str) -> bytes:
        """Send YAML to SDwC /api/v1/generate and return ZIP bytes."""
        from intake_assistant_api.core.exceptions import ExternalServiceError

        url = f"{self._base_url}/api/v1/generate"
        try:
            resp = await self._http.post(
                url,
                json={"yaml_content": yaml_content},
                timeout=30.0,
            )
            resp.raise_for_status()
            await logger.ainfo("sdwc_generate_completed", size=len(resp.content))
            return resp.content
        except httpx.HTTPError as exc:
            await logger.aerror("sdwc_generate_failed", url=url, error=str(exc))
            raise ExternalServiceError("SDwC", f"ZIP generation failed: {exc}") from exc

    async def close(self) -> None:
        await self._http.aclose()
