from gigsaw_ai.database.repositories.freelancer_repository import _backend_user_to_freelancer


def test_backend_user_adapter_excludes_sensitive_fields_and_maps_designer():
    freelancer = _backend_user_to_freelancer({
        "_id": "user-1", "name": "Ava Designer", "email": "secret@example.test", "paypalEmail": "payments@example.test",
        "role": "freelancer", "category": "designer", "hourlyRate": 45, "bio": "Cafe identity designer.",
        "skills": ["Logo design", "Figma"], "rating": 4.8, "completedProjects": 12, "availability": "available",
        "pastProjects": [{"title": "Coffee House", "description": "Brand identity", "technologies": ["Figma"], "projectUrl": "https://example.test/work"}],
    })
    assert freelancer.freelancer_id == "user-1"
    assert freelancer.price_basis == "hour"
    assert "logo and branding" in freelancer.service_categories
    assert freelancer.experience_years == 2
    assert "secret@example.test" not in freelancer.portfolio_description
    assert freelancer.portfolio_references[0].url == "https://example.test/work"
