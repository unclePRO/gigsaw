from fastapi.testclient import TestClient

from gigsaw_ai.main import create_app


def test_health_and_project_analysis_api():
    with TestClient(create_app()) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        response = client.post("/api/v1/projects/analyze", json={
            "customer_request": "I need a website, logo and food photography for my new cafe.", "budget": "1600", "currency": "USD"
        })
    assert response.status_code == 200
    assert response.json()["analysis"]["required_services"]


def test_api_does_not_expose_stack_trace_for_business_error():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/proposals/generate", json={"project_id": "p", "project_name": "P", "quotations": [{"quotation_id": "q", "freelancer_id": "f", "work_package_id": "w", "amount": "10", "delivery_days": 1, "scope": "x", "status": "pending"}]})
    assert response.status_code == 422
    assert "traceback" not in response.text.lower()
