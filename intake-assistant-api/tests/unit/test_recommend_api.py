from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from intake_assistant_api.main import app
from intake_assistant_api.schemas.recommend import RecommendResponse


@pytest.fixture
def mock_anthropic():
    return AsyncMock()


@pytest.fixture
async def client(mock_anthropic):
    app.state.anthropic = mock_anthropic
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_recommend_endpoint_success(client, mock_anthropic) -> None:
    mock_response = RecommendResponse(
        suggestion="medium",
        rationale="프로젝트 규모를 고려하면 중간 수준이 적절합니다.",
    )

    with patch(
        "intake_assistant_api.routers.recommend.recommend_service.recommend",
        return_value=mock_response,
    ):
        resp = await client.post(
            "/api/v1/recommend",
            json={
                "context": {"project": {"name": "test"}},
                "field_path": "problem.severity",
                "field_info": {
                    "description": "심각도",
                    "enum_values": ["low", "medium", "high"],
                },
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["suggestion"] == "medium"
    assert "rationale" in data


async def test_recommend_endpoint_empty_field_path(client) -> None:
    resp = await client.post(
        "/api/v1/recommend",
        json={
            "context": {},
            "field_path": "",
            "field_info": {},
        },
    )
    assert resp.status_code == 422


async def test_recommend_endpoint_missing_field_path(client) -> None:
    resp = await client.post(
        "/api/v1/recommend",
        json={
            "context": {},
            "field_info": {},
        },
    )
    assert resp.status_code == 422


async def test_recommend_endpoint_default_context(client, mock_anthropic) -> None:
    mock_response = RecommendResponse(
        suggestion="web_app",
        rationale="기본적인 웹 애플리케이션이 적절합니다.",
    )

    with patch(
        "intake_assistant_api.routers.recommend.recommend_service.recommend",
        return_value=mock_response,
    ):
        resp = await client.post(
            "/api/v1/recommend",
            json={
                "field_path": "project.type",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["suggestion"] == "web_app"
