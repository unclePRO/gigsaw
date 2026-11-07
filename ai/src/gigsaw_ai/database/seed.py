"""Clearly fictional demo catalogue. It is never loaded unless demo mode or seed script is used."""
from __future__ import annotations

from decimal import Decimal

from gigsaw_ai.schemas.freelancers import Freelancer, PortfolioReference, ServiceCatalogItem
from gigsaw_ai.schemas.proposals import Quotation


def demo_services() -> list[ServiceCatalogItem]:
    rows = [
        ("website development", "Website development", 700, 450, 1400, "Responsive launch website with CMS-ready pages."),
        ("logo and branding", "Logo and branding", 300, 180, 700, "Logo, palette, type and basic brand guide."),
        ("graphic design", "Graphic design", 220, 120, 500, "Campaign and print-ready visual design."),
        ("social media creatives", "Social media creatives", 180, 100, 450, "Reusable launch social posts and stories."),
        ("food photography", "Food photography", 350, 200, 900, "On-location plated-food photography session."),
        ("digital menu design", "Digital menu design", 180, 90, 400, "Mobile-friendly and print-ready menu design."),
        ("social media management", "Social media management", 400, 250, 900, "One month of social publishing and community support."),
        ("digital marketing", "Digital marketing", 350, 200, 1000, "Local launch campaign planning and ad creative."),
    ]
    return [
        ServiceCatalogItem(
            service_id=f"svc-{index:02d}", category=category, description=description,
            baseline_price=Decimal(str(baseline)), minimum_price=Decimal(str(minimum)),
            maximum_price=Decimal(str(maximum)),
        )
        for index, (category, _title, baseline, minimum, maximum, description) in enumerate(rows, start=1)
    ]


def demo_freelancers() -> list[Freelancer]:
    # Each record is fictional. Prices are indicative only and remain in MongoDB, not ChromaDB.
    records = [
        ("fre-001", "Maya Chen", ["react", "responsive design", "seo", "restaurant websites"], ["website development"], 7, 4.9, 780, 14, "Singapore", "Builds fast, accessible restaurant and local-business websites with online menus and conversion-focused booking flows."),
        ("fre-002", "Arjun Rao", ["wordpress", "web design", "cms", "menu integration"], ["website development", "digital menu design"], 5, 4.7, 580, 10, "Bengaluru", "Practical small-business websites and easy-to-edit digital menus for cafes, bakeries and food trucks."),
        ("fre-003", "Sofia Martinez", ["logo design", "brand strategy", "typography", "packaging"], ["logo and branding", "graphic design"], 8, 4.9, 420, 12, "Madrid", "Warm, distinctive identities and packaging systems for independent coffee shops and food brands."),
        ("fre-004", "Noah Williams", ["illustration", "brand identity", "adobe illustrator"], ["logo and branding", "graphic design"], 4, 4.6, 280, 8, "Toronto", "Bold hand-drawn logos, signage concepts and launch collateral for neighborhood hospitality businesses."),
        ("fre-005", "Priya Nair", ["social design", "instagram", "canva", "content templates"], ["social media creatives", "graphic design"], 6, 4.8, 240, 7, "Mumbai", "Creates cohesive Instagram carousels, stories and food launch campaigns that small teams can reuse."),
        ("fre-006", "Luca Bianchi", ["food photography", "styling", "restaurant photography", "lightroom"], ["food photography"], 9, 4.9, 520, 5, "Milan", "Editorial food photography, menu hero shots and natural-light restaurant interiors for new cafe openings."),
        ("fre-007", "Aisha Khan", ["menu design", "layout", "print production", "accessibility"], ["digital menu design", "graphic design"], 5, 4.7, 210, 6, "Dubai", "Clear, appetizing digital and print menus designed for quick reading and easy seasonal changes."),
        ("fre-008", "Ethan Brooks", ["social media strategy", "community management", "copywriting", "instagram"], ["social media management", "digital marketing"], 6, 4.8, 460, 30, "Austin", "Launch-month social strategy, daily community management and local audience growth for cafes and restaurants."),
        ("fre-009", "Mei Tan", ["paid social", "google ads", "local seo", "analytics"], ["digital marketing"], 7, 4.7, 500, 21, "Kuala Lumpur", "Measurable local launch campaigns combining paid social, search ads and neighbourhood audience research."),
        ("fre-010", "Omar Haddad", ["product photography", "videography", "reels", "food styling"], ["food photography", "social media creatives"], 5, 4.6, 390, 6, "Amman", "Short-form food video and high-energy social assets for restaurant launches and delivery brands."),
        ("fre-011", "Grace Okafor", ["brand writing", "content calendar", "instagram", "copywriting"], ["social media management", "social media creatives"], 4, 4.5, 330, 30, "Lagos", "Friendly launch voice, content calendars and community replies for independent food and lifestyle brands."),
        ("fre-012", "Daniel Kim", ["next.js", "ecommerce", "performance", "accessibility"], ["website development"], 8, 4.8, 920, 18, "Seoul", "Premium performant web builds for hospitality brands needing online ordering, analytics and multilingual pages."),
    ]
    return [
        Freelancer(
            freelancer_id=identifier, name=name, skills=skills, service_categories=categories,
            experience_years=experience, rating=rating, availability=True, indicative_price=Decimal(str(price)),
            delivery_days=days, portfolio_description=description, location=location,
            portfolio_references=[PortfolioReference(title=f"Fictional {categories[0]} portfolio", url=f"https://example.test/portfolio/{identifier}")],
        )
        for identifier, name, skills, categories, experience, rating, price, days, location, description in records
    ]


def demo_quotations() -> list[Quotation]:
    return [
        Quotation(quotation_id="quote-001", freelancer_id="fre-001", work_package_id="wp-website", amount=Decimal("760"), delivery_days=14, scope="Five-page responsive cafe website", status="accepted"),
        Quotation(quotation_id="quote-002", freelancer_id="fre-003", work_package_id="wp-brand", amount=Decimal("390"), delivery_days=12, scope="Logo and mini brand system", status="accepted"),
        Quotation(quotation_id="quote-003", freelancer_id="fre-006", work_package_id="wp-photo", amount=Decimal("500"), delivery_days=5, scope="Half-day food photography shoot", status="counteroffer"),
        Quotation(quotation_id="quote-004", freelancer_id="fre-008", work_package_id="wp-social", amount=Decimal("450"), delivery_days=30, scope="One month social management", status="declined"),
    ]


def demo_project_document() -> dict:
    return {
        "project_id": "demo-cafe-launch",
        "name": "Copper Cup Cafe launch",
        "customer_request": "Launch a cafe with a website, logo, food photography, menu and Instagram promotion.",
        "currency": "USD",
        "budget": "2000.00",
        "is_demo": True,
    }


def demo_work_package_documents() -> list[dict]:
    """Small persisted example tied to the fictional cafe project."""
    return [
        {"project_id": "demo-cafe-launch", "work_package_id": "wp-brand", "name": "Brand identity", "service_category": "logo and branding", "status": "completed", "is_demo": True},
        {"project_id": "demo-cafe-launch", "work_package_id": "wp-website", "name": "Website", "service_category": "website development", "dependencies": ["wp-brand"], "status": "in_progress", "is_demo": True},
        {"project_id": "demo-cafe-launch", "work_package_id": "wp-photo", "name": "Food photography", "service_category": "food photography", "dependencies": ["wp-brand"], "status": "blocked", "is_demo": True},
    ]


async def seed_repositories(
    freelancer_repository, service_repository, portfolio_store, project_repository=None,
    work_package_collection=None, quotation_collection=None,
) -> None:
    """Idempotently seed only explicitly selected demo repositories."""
    freelancers = demo_freelancers()
    await freelancer_repository.upsert_many(freelancers)
    await service_repository.upsert_many(demo_services())
    for freelancer in freelancers:
        text = " ".join([freelancer.portfolio_description, *freelancer.skills, *freelancer.service_categories])
        await portfolio_store.upsert(freelancer.freelancer_id, text)
    if project_repository is not None:
        await project_repository.upsert(demo_project_document())
    if work_package_collection is not None:
        for document in demo_work_package_documents():
            await work_package_collection.replace_one(
                {"project_id": document["project_id"], "work_package_id": document["work_package_id"]}, document, upsert=True
            )
    if quotation_collection is not None:
        for quotation in demo_quotations():
            document = quotation.model_dump(mode="json") | {"project_id": "demo-cafe-launch", "is_demo": True}
            await quotation_collection.replace_one({"quotation_id": quotation.quotation_id}, document, upsert=True)
