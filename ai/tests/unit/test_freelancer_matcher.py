import asyncio
from decimal import Decimal

from fastapi.testclient import TestClient

from gigsaw_ai.database.repositories.freelancer_repository import InMemoryFreelancerRepository, _backend_user_to_freelancer
from gigsaw_ai.database.chroma import InMemoryPortfolioStore
from gigsaw_ai.main import create_app
from gigsaw_ai.retrieval.freelancer_retriever import FreelancerRetriever
from gigsaw_ai.schemas.freelancers import Freelancer, PortfolioReference
from gigsaw_ai.schemas.matching import (
    FreelancerMatchingRequest,
    FreelancerSwapRequest,
    MatchingWeights,
)
from gigsaw_ai.schemas.scoping import ChatMessage, ProjectScopingFinalizeRequest
from gigsaw_ai.services.freelancer_matcher import FreelancerMatcher
from gigsaw_ai.services.matching_feedback import MatchingFeedbackEvent, MatchingFeedbackTracker


def _build_custom_matcher(
    freelancers: list[Freelancer],
    *,
    default_weights: MatchingWeights | None = None,
) -> FreelancerMatcher:
    repo = InMemoryFreelancerRepository(freelancers)
    store = InMemoryPortfolioStore()
    for fl in freelancers:
        asyncio.run(store.upsert(fl.freelancer_id, f"{fl.portfolio_description} {' '.join(fl.skills)}"))
    retriever = FreelancerRetriever(store, repo)
    return FreelancerMatcher(repo, retriever, default_weights=default_weights)


def _make_fl(
    fid: str,
    name: str,
    *,
    skills: list[str],
    categories: list[str],
    experience_years: int = 5,
    rating: float = 4.7,
    completed_projects: int = 10,
    availability: bool = True,
    price: str = "600",
    price_basis: str = "project",
    delivery_days: int = 10,
    portfolio_description: str = "Experienced creative specialist.",
    location: str = "Austin, TX",
    is_profile_complete: bool = True,
    remote_ok: bool = True,
    travel_radius_km: int | None = None,
    negotiable_pricing: bool = False,
    active_project_count: int = 0,
    max_concurrent_projects: int = 3,
    available_from_days: int = 0,
    verified: bool = False,
    response_rate: float | None = None,
    on_time_rate: float | None = None,
    cancellation_rate: float | None = None,
    domain_experience_tags: list[str] | None = None,
) -> Freelancer:
    return Freelancer(
        freelancer_id=fid,
        name=name,
        skills=skills,
        service_categories=categories,
        experience_years=experience_years,
        rating=rating,
        completed_projects=completed_projects,
        availability=availability,
        indicative_price=Decimal(price),
        price_basis=price_basis,
        delivery_days=delivery_days,
        portfolio_description=portfolio_description,
        location=location,
        portfolio_references=[PortfolioReference(title=f"{name} Work", url=f"https://example.test/{fid}")],
        is_profile_complete=is_profile_complete,
        remote_ok=remote_ok,
        travel_radius_km=travel_radius_km,
        negotiable_pricing=negotiable_pricing,
        active_project_count=active_project_count,
        max_concurrent_projects=max_concurrent_projects,
        available_from_days=available_from_days,
        verified=verified,
        response_rate=response_rate,
        on_time_rate=on_time_rate,
        cancellation_rate=cancellation_rate,
        domain_experience_tags=domain_experience_tags or [],
    )


def test_matcher_combines_rank_factors(container):
    result = asyncio.run(
        container.freelancer_matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                required_skills=["responsive design", "seo"],
                brief="Responsive restaurant website with a digital menu",
                budget=Decimal("900"),
                limit=3,
            )
        )
    )
    assert result.matches
    assert result.matches[0].freelancer.freelancer_id == "fre-001"
    assert set(result.matches[0].score_breakdown) == {
        "service_relevance",
        "skill_compatibility",
        "portfolio_relevance",
        "project_experience",
        "budget_compatibility",
        "availability",
        "location",
        "reliability",
    }
    assert 0 <= result.matches[0].score <= 100
    assert result.search_metadata["eligible_after_filters"] >= len(result.matches)


def test_matcher_excludes_and_swaps(container):
    result = asyncio.run(
        container.freelancer_matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                brief="Responsive restaurant website with a digital menu",
                budget=Decimal("900"),
                limit=3,
                exclude_freelancer_ids=["fre-001"],
            )
        )
    )
    for m in result.matches:
        assert m.freelancer.freelancer_id != "fre-001"

    swap_res = asyncio.run(
        container.freelancer_matcher.swap(
            FreelancerSwapRequest(
                service_category="website development",
                current_freelancer_id="fre-001",
                budget=Decimal("900"),
            )
        )
    )
    assert swap_res.previous_freelancer_id == "fre-001"
    assert swap_res.swapped is True


def test_matcher_exact_vs_related_category_and_domain_boundary():
    exact_food = _make_fl(
        "f-food",
        "Clara ChefLens",
        skills=["food photography", "lightroom"],
        categories=["food photography"],
        portfolio_description="On-location cafe and plated dish food photography.",
    )
    related_photo = _make_fl(
        "f-photo",
        "Marcus Studio",
        skills=["product photography", "lightroom"],
        categories=["photography"],
        portfolio_description="Commercial beverage and tabletop studio shoots.",
    )
    conflicting_wedding = _make_fl(
        "f-wed",
        "Derek Bridal",
        skills=["wedding photography", "lightroom"],
        categories=["wedding photography"],
        portfolio_description="Candid ceremony and reception wedding photography.",
    )
    matcher = _build_custom_matcher([exact_food, related_photo, conflicting_wedding])

    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="food photography",
                required_skills=["food photography"],
                brief="Plated dishes and coffee drinks for new cafe",
                location="Austin, TX",
            )
        )
    )
    ids = [m.freelancer.freelancer_id for m in res.matches]
    assert "f-wed" not in ids
    assert ids == ["f-food", "f-photo"]
    assert res.matches[0].category_match_type == "exact"
    assert res.matches[1].category_match_type == "related"


def test_matcher_skills_synonym_matching_and_mandatory_filter():
    exact_skill = _make_fl(
        "f-exact",
        "Nina Dev",
        skills=["react", "figma", "seo"],
        categories=["website development"],
        portfolio_description="SaaS dashboards and responsive web apps in React.",
    )
    synonym_skill = _make_fl(
        "f-syn",
        "Sam UI",
        skills=["reactjs", "ui/ux design"],
        categories=["website development"],
        portfolio_description="User interface and React web development.",
    )
    missing_mandatory = _make_fl(
        "f-miss",
        "Bob WP",
        skills=["wordpress", "html"],
        categories=["website development"],
        portfolio_description="Brochure WordPress websites.",
    )
    matcher = _build_custom_matcher([exact_skill, synonym_skill, missing_mandatory])

    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                mandatory_skills=["react"],
                required_skills=["figma", "seo"],
                brief="React dashboard with Figma design tokens and SEO",
            )
        )
    )
    returned_ids = [m.freelancer.freelancer_id for m in res.matches]
    assert "f-miss" not in returned_ids
    assert returned_ids[0] == "f-exact"
    assert "f-syn" in returned_ids
    assert any("missing listed skills" in gap.lower() for gap in res.matches[1].potential_gaps)


def test_matcher_budget_edge_cases_soft_margin_negotiable_hourly_unknown():
    within = _make_fl("b-within", "Within Budget", skills=["logo design"], categories=["logo and branding"], price="500")
    slightly_over = _make_fl("b-slight", "Slightly Over", skills=["logo design"], categories=["logo and branding"], price="620")
    negotiable_high = _make_fl("b-neg", "Negotiable Pro", skills=["logo design"], categories=["logo and branding"], price="850", negotiable_pricing=True)
    too_expensive = _make_fl("b-far", "Luxury Agency", skills=["logo design"], categories=["logo and branding"], price="1500", negotiable_pricing=False)
    hourly = _make_fl("b-hr", "Hourly Expert", skills=["logo design"], categories=["logo and branding"], price="45", price_basis="hour")
    unknown = _make_fl("b-unk", "Unpriced New", skills=["logo design"], categories=["logo and branding"], price="0", rating=0.0, completed_projects=0)

    matcher = _build_custom_matcher([within, slightly_over, negotiable_high, too_expensive, hourly, unknown])
    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="logo and branding",
                required_skills=["logo design"],
                brief="Modern cafe brand identity and logo",
                budget=Decimal("500"),
                limit=10,
            )
        )
    )
    status_by_id = {m.freelancer.freelancer_id: m.budget_status for m in res.matches}
    assert "b-far" not in status_by_id
    assert status_by_id["b-within"] == "within_budget"
    assert status_by_id["b-slight"] == "slightly_above_budget"
    assert status_by_id["b-neg"] == "negotiable"
    assert status_by_id["b-hr"] == "hourly_estimate"
    assert status_by_id["b-unk"] == "unknown"


def test_matcher_onsite_location_and_availability_filters():
    local_ready = _make_fl(
        "loc-ok",
        "Local Shoot",
        skills=["food photography"],
        categories=["food photography"],
        location="Austin, TX",
        delivery_days=4,
    )
    traveler = _make_fl(
        "loc-travel",
        "Regional Shoot",
        skills=["food photography"],
        categories=["food photography"],
        location="San Antonio, TX",
        travel_radius_km=150,
        delivery_days=4,
    )
    far_away = _make_fl(
        "loc-far",
        "Distant Shoot",
        skills=["food photography"],
        categories=["food photography"],
        location="Milan, Italy",
        delivery_days=4,
    )
    busy = _make_fl(
        "loc-busy",
        "Busy Shoot",
        skills=["food photography"],
        categories=["food photography"],
        location="Austin, TX",
        active_project_count=3,
        max_concurrent_projects=3,
    )
    slow = _make_fl(
        "loc-slow",
        "Slow Shoot",
        skills=["food photography"],
        categories=["food photography"],
        location="Austin, TX",
        delivery_days=20,
    )
    matcher = _build_custom_matcher([local_ready, traveler, far_away, busy, slow])

    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="food photography",
                required_skills=["food photography"],
                brief="On-location cafe menu photoshoot",
                location="Austin",
                require_onsite=True,
                max_delivery_days=5,
                limit=10,
            )
        )
    )
    ids = [m.freelancer.freelancer_id for m in res.matches]
    assert "loc-far" not in ids
    assert "loc-busy" not in ids
    assert "loc-slow" not in ids
    assert ids[0] == "loc-ok"
    assert "loc-travel" in ids


def test_matcher_profile_completeness_and_zero_mock_new_specialist_baseline():
    incomplete = _make_fl(
        "p-inc",
        "Incomplete Profile",
        skills=["react"],
        categories=["website development"],
        is_profile_complete=False,
    )
    new_specialist = _make_fl(
        "p-new",
        "Zero Rated Newcomer",
        skills=["react", "responsive design"],
        categories=["website development"],
        rating=0.0,
        completed_projects=0,
        experience_years=2,
        verified=True,
    )
    matcher = _build_custom_matcher([incomplete, new_specialist])

    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                required_skills=["react", "responsive design"],
                brief="Responsive react website",
            )
        )
    )
    assert [m.freelancer.freelancer_id for m in res.matches] == ["p-new"]
    assert res.matches[0].score_breakdown["reliability"] > 0
    assert any("new specialist" in r.lower() for r in res.matches[0].reasons)

    # Also verify Mongoose backend mapping respects isProfileComplete and defaults rating to 0 without fake 5.0
    mapped_incomplete = _backend_user_to_freelancer({
        "_id": "mongo-inc",
        "name": "Pending User",
        "role": "freelancer",
        "category": "dev",
        "isProfileComplete": False,
    })
    assert mapped_incomplete.is_profile_complete is False
    assert mapped_incomplete.rating == 0.0
    assert mapped_incomplete.completed_projects == 0


def test_matcher_empty_pool_and_irrelevant_chroma_guard():
    repo = InMemoryFreelancerRepository([
        _make_fl(
            "inc-chroma",
            "Incomplete But Vector Indexed",
            skills=["react"],
            categories=["website development"],
            is_profile_complete=False,
            portfolio_description="Responsive restaurant cafe website showcase",
        )
    ])
    store = InMemoryPortfolioStore()
    asyncio.run(store.upsert("inc-chroma", "Responsive restaurant cafe website showcase"))
    matcher = FreelancerMatcher(repo, FreelancerRetriever(store, repo))

    res = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                brief="Responsive restaurant cafe website showcase",
            )
        )
    )
    assert res.matches == []
    assert "no eligible freelancers" in res.search_note.lower()
    assert res.search_metadata["rejected_counts"]["incomplete_profile"] == 1


def test_matcher_custom_weights_determinism_and_feedback_api():
    portfolio_star = _make_fl(
        "w-port",
        "Portfolio Star",
        skills=["wordpress"],
        categories=["website development"],
        price="850",
        portfolio_description="Custom stationery online store e-commerce checkout templates with gift bundles.",
        domain_experience_tags=["stationery", "ecommerce"],
    )
    budget_star = _make_fl(
        "w-budg",
        "Budget Star",
        skills=["react", "responsive design"],
        categories=["website development"],
        price="350",
        portfolio_description="Generic software developer.",
    )
    matcher = _build_custom_matcher([portfolio_star, budget_star])

    budget_heavy = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                brief="Stationery online store with gift bundles",
                budget=Decimal("500"),
                weights=MatchingWeights(
                    service_relevance=0.05,
                    skill_compatibility=0.05,
                    portfolio_relevance=0.05,
                    project_experience=0.05,
                    budget_compatibility=0.70,
                    availability=0.05,
                    location=0.025,
                    reliability=0.025,
                ),
            )
        )
    )
    assert budget_heavy.matches[0].freelancer.freelancer_id == "w-budg"

    portfolio_heavy = asyncio.run(
        matcher.match(
            FreelancerMatchingRequest(
                service_category="website development",
                brief="Stationery online store with gift bundles",
                budget=Decimal("500"),
                weights=MatchingWeights(
                    service_relevance=0.10,
                    skill_compatibility=0.05,
                    portfolio_relevance=0.70,
                    project_experience=0.05,
                    budget_compatibility=0.02,
                    availability=0.03,
                    location=0.025,
                    reliability=0.025,
                ),
            )
        )
    )
    assert portfolio_heavy.matches[0].freelancer.freelancer_id == "w-port"

    # Feedback tracker unit & API check
    tracker = MatchingFeedbackTracker()
    asyncio.run(tracker.record(MatchingFeedbackEvent(freelancer_id="w-port", service_category="website development", event_type="shown", rank_position=1)))
    asyncio.run(tracker.record(MatchingFeedbackEvent(freelancer_id="w-port", service_category="website development", event_type="selected", rank_position=1)))
    asyncio.run(tracker.record(MatchingFeedbackEvent(freelancer_id="w-port", service_category="website development", event_type="rated", rating=4.9)))
    summary = asyncio.run(tracker.summarize(freelancer_id="w-port"))
    assert summary.total_events == 3
    assert summary.average_rating == 4.9
    assert summary.selection_rate == 1.0

    with TestClient(create_app()) as client:
        post_res = client.post(
            "/api/v1/matching/feedback",
            json={
                "freelancer_id": "fre-001",
                "service_category": "website development",
                "event_type": "selected",
                "rank_position": 1,
                "match_score": 88.5,
            },
        )
        assert post_res.status_code == 200
        sum_res = client.get("/api/v1/matching/feedback/summary", params={"freelancer_id": "fre-001"})
        assert sum_res.status_code == 200
        assert sum_res.json()["counts_by_type"]["selected"] == 1


def test_finalize_matches_multi_service_without_duplicate_top_assignments(container):
    shared_specialist = _make_fl(
        "dup-1",
        "Versatile Hybrid",
        skills=["logo design", "menu design", "graphic design", "layout"],
        categories=["logo and branding", "digital menu design"],
        rating=5.0,
        completed_projects=25,
        price="200",
        portfolio_description="Logo identity systems and cafe digital menu design.",
    )
    backup_menu = _make_fl(
        "dup-2",
        "Menu Designer Pro",
        skills=["menu design", "layout", "accessibility"],
        categories=["digital menu design"],
        rating=4.7,
        completed_projects=12,
        price="180",
        portfolio_description="Printable and QR cafe digital menu specialist.",
    )
    original_matcher = container.freelancer_matcher
    container.freelancer_matcher = _build_custom_matcher([shared_specialist, backup_menu])
    try:
        res = asyncio.run(
            container.project_scoping_assistant.finalize(
                ProjectScopingFinalizeRequest(
                    initial_goal="I need a logo and digital menu for my cafe",
                    messages=[
                        ChatMessage(role="user", content="QR mobile menu with 20 coffee items and warm cafe logo"),
                    ],
                    budget=Decimal("600"),
                    auto_decompose=True,
                )
            )
        )
    finally:
        container.freelancer_matcher = original_matcher

    top_picks = [
        pkg_match.match_result.matches[0].freelancer.freelancer_id
        for pkg_match in res.freelancer_matches
        if pkg_match.match_result.matches
    ]
    assert len(top_picks) == 2
    assert len(set(top_picks)) == 2
