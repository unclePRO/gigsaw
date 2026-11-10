from fastapi.testclient import TestClient

from gigsaw_ai.main import create_app


def test_health_and_project_analysis_api():
    with TestClient(create_app()) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        response = client.post("/api/v1/projects/analyze", json={
            "customer_request": "I need a website, logo and food photography for my new cafe.",
            "budget": "1600",
            "currency": "USD",
        })
    assert response.status_code == 200
    assert response.json()["analysis"]["required_services"]


def test_project_scoping_and_chat_room_endpoints():
    with TestClient(create_app()) as client:
        # Step 2: Conversational Scoping Chat
        chat_res = client.post("/api/v1/projects/scoping/chat", json={
            "initial_goal": "I need a website for my coffee shop",
            "messages": [],
        })
        assert chat_res.status_code == 200
        data = chat_res.json()
        assert "reply" in data
        assert data.get("project_name")
        assert len(data["suggested_replies"]) > 0

        title_res = client.post("/api/v1/projects/scoping/title", json={
            "initial_goal": "I need a website for my coffee shop",
            "messages": [{"role": "user", "content": "lets take project name as Copper Cup"}],
        })
        assert title_res.status_code == 200
        assert "copper cup" in title_res.json()["project_name"].lower()

        # Step 2 -> 3: Finalize Scoping
        finalize_res = client.post("/api/v1/projects/scoping/finalize", json={
            "initial_goal": "I need a website for my coffee shop",
            "messages": [
                {"role": "user", "content": "Modern minimalist aesthetic with digital menu"}
            ],
            "budget": "1400",
            "auto_decompose": True,
        })
        assert finalize_res.status_code == 200
        fin_data = finalize_res.json()
        assert fin_data["analysis_result"] is not None
        assert len(fin_data["analysis_result"]["work_packages"]) > 0
        assert len(fin_data["freelancer_matches"]) == len(fin_data["analysis_result"]["work_packages"])

        # Step 4: Freelancer Swap
        swap_res = client.post("/api/v1/matching/freelancers/swap", json={
            "service_category": "website development",
            "current_freelancer_id": "fre-001",
            "budget": "900",
        })
        assert swap_res.status_code == 200
        assert "swapped" in swap_res.json()

        # Step 5: Project Chat Room Assist
        room_res = client.post("/api/v1/projects/chat-room/assist", json={
            "project_name": "Coffee Shop Launch",
            "merchant_name": "Coffee Merchant",
            "members": [
                {"name": "Coffee Merchant", "role": "merchant"},
                {"name": "Dev Specialist", "role": "freelancer", "package_title": "Website"},
            ],
            "action": "kickoff",
        })
        assert room_res.status_code == 200
        assert "message" in room_res.json()

        # Step 5: Freelancer Invitation Review
        invite_res = client.post("/api/v1/freelancer-assistant/invitation-review", json={
            "freelancer_id": "fre-001",
            "project_name": "Coffee Shop Launch",
            "merchant_name": "Coffee Merchant",
            "work_package_title": "Website Development",
            "service_category": "website development",
            "description": "Next.js responsive website with online ordering",
            "deliverables": ["Responsive website", "Admin menu panel"],
            "allocated_price": "850",
            "estimated_days": 10,
        })
        assert invite_res.status_code == 200
        assert invite_res.json()["feasibility_assessment"] in ("high", "moderate")


def test_api_does_not_expose_stack_trace_for_business_error():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/proposals/generate", json={
            "project_id": "p",
            "project_name": "P",
            "quotations": [{
                "quotation_id": "q",
                "freelancer_id": "f",
                "work_package_id": "w",
                "amount": "10",
                "delivery_days": 1,
                "scope": "x",
                "status": "pending",
            }],
        })
    assert response.status_code == 422
    assert "traceback" not in response.text.lower()
