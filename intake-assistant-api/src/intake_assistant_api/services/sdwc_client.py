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

    async def close(self) -> None:
        await self._http.aclose()
