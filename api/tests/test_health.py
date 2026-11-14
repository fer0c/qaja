"""Tests for basic root and health endpoints."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root() -> None:
    """GET / returns a running message and docs path."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "qaja API running", "docs": "/docs"}


def test_health() -> None:
    """GET /health returns ok status and service metadata."""
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "qaja-api"
    assert "environment" in payload
