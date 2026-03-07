import pytest
from httpx import ASGITransport, AsyncClient

from intake_assistant_api.core import rate_limiter
from intake_assistant_api.main import app


@pytest.fixture(autouse=True)
def _clean_rate_limiter():
    rate_limiter.reset()
    yield
    rate_limiter.reset()


@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac  # type: ignore[misc]


@pytest.mark.asyncio
async def test_rate_limit_returns_429(client: AsyncClient):
    # Exhaust the limit
    for _ in range(20):
        rate_limiter.check("127.0.0.1")

    # Any endpoint (except health) should return 429
    response = await client.get("/api/v1/health")
    # Health bypasses rate limit
    assert response.status_code == 200

    # Non-health endpoint should be blocked
    response = await client.post(
        "/api/v1/analyze",
        json={"user_input": "테스트"},
    )
    assert response.status_code == 429
    assert "Retry-After" in response.headers
    body = response.json()
    assert body["error"] == "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."


@pytest.mark.asyncio
async def test_health_endpoint_bypasses_rate_limit(client: AsyncClient):
    for _ in range(20):
        rate_limiter.check("127.0.0.1")

    response = await client.get("/api/v1/health")
    assert response.status_code == 200
