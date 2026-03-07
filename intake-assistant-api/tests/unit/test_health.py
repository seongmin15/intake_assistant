from intake_assistant_api.services import template_cache


async def test_health_healthy(client):
    template_cache.set_template("project:\n  name: test\n")
    try:
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["sdwc_reachable"] is True
    finally:
        template_cache.clear()


async def test_health_degraded(client):
    template_cache.clear()
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["sdwc_reachable"] is False
