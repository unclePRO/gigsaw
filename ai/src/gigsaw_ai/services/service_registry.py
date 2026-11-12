"""Central registry of service taxonomy, skill normalization, query expansion, and consultation priorities."""
from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(frozen=True)
class ServiceDefinition:
    category: str
    aliases: tuple[str, ...]
    related_categories: tuple[str, ...] = ()
    conflicting_categories: tuple[str, ...] = ()
    query_expansion_terms: tuple[str, ...] = ()
    onsite_typical: bool = False
    remote_ok: bool = True
    essential_dimensions: tuple[str, ...] = ()
    quotation_dimensions: tuple[str, ...] = ()
    optional_dimensions: tuple[str, ...] = ()
    technical_spec_hints: tuple[str, ...] = ()


SERVICE_REGISTRY: dict[str, ServiceDefinition] = {
    "website development": ServiceDefinition(
        category="website development",
        aliases=(
            "website",
            "web site",
            "web app",
            "web application",
            "landing page",
            "ecommerce",
            "e-commerce",
            "online store",
            "shopify",
            "wordpress",
            "woocommerce",
            "nextjs",
            "next.js",
            "saas",
            "web portal",
            "web development",
        ),
        related_categories=("digital menu design", "ui ux design"),
        query_expansion_terms=(
            "responsive website",
            "web design",
            "frontend",
            "backend",
            "cms",
            "booking system",
            "seo setup",
            "mobile friendly",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "website type and business purpose",
            "key pages and core features (menu, booking, e-commerce, contact)",
            "budget",
            "timeline",
        ),
        quotation_dimensions=(
            "existing website, domain, or codebase status",
            "copy, photos, and content readiness",
            "third-party integrations (payments, reservations, CMS)",
        ),
        optional_dimensions=(
            "reference websites or aesthetic style",
            "post-launch maintenance preferences",
        ),
        technical_spec_hints=(
            "Mobile-responsive layout and HTTPS setup",
            "SEO-ready page metadata and fast asset delivery",
        ),
    ),
    "logo and branding": ServiceDefinition(
        category="logo and branding",
        aliases=(
            "logo",
            "branding",
            "brand identity",
            "visual identity",
            "brand guidelines",
            "rebrand",
            "wordmark",
            "monogram",
        ),
        related_categories=("graphic design", "social media creatives"),
        query_expansion_terms=(
            "logo design",
            "brand strategy",
            "typography",
            "color palette",
            "brand guidelines",
            "vector source files",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "brand or business name",
            "target audience and brand feel",
            "where the logo will be used (website, signage, packaging, social)",
            "budget",
            "timeline",
        ),
        quotation_dimensions=(
            "starting from scratch vs refreshing an existing logo",
            "required variations (icon mark, monochrome, packaging lockup)",
            "brand guidelines or editable files need",
        ),
        optional_dimensions=(
            "preferred colors or reference brands",
            "brand personality keywords",
        ),
        technical_spec_hints=(
            "Deliver scalable vector files (SVG/EPS/AI) plus transparent PNGs",
        ),
    ),
    "food photography": ServiceDefinition(
        category="food photography",
        aliases=(
            "food photography",
            "food photo",
            "food photos",
            "dish photography",
            "menu photography",
            "menu photoshoot",
            "culinary photography",
            "restaurant photography",
            "cafe photography",
        ),
        related_categories=("photography", "social media creatives"),
        conflicting_categories=("wedding photography", "real estate photography", "event photography"),
        query_expansion_terms=(
            "plated dish photography",
            "culinary styling",
            "lightroom retouching",
            "natural light restaurant interior",
            "menu hero images",
        ),
        onsite_typical=True,
        remote_ok=False,
        essential_dimensions=(
            "what needs to be photographed (dishes, drinks, interior, lifestyle)",
            "approximate quantity of dishes or final edited photos needed",
            "physical photoshoot location (city/neighborhood)",
            "photoshoot timing or readiness",
            "budget",
        ),
        quotation_dimensions=(
            "intended usage (website, print menu, delivery apps, Instagram)",
            "food styling and prop requirements",
            "editing and retouching turnaround",
        ),
        optional_dimensions=(
            "mood and lighting preference (bright airy vs moody)",
            "reference food photos",
        ),
        technical_spec_hints=(
            "High-resolution edited JPEGs for print/menus plus web-optimized crops",
        ),
    ),
    "photography": ServiceDefinition(
        category="photography",
        aliases=(
            "photography",
            "photoshoot",
            "photo shoot",
            "product photography",
            "commercial photography",
        ),
        related_categories=("food photography", "social media creatives"),
        conflicting_categories=("wedding photography",),
        query_expansion_terms=(
            "commercial photography",
            "photo editing",
            "lightroom",
            "product styling",
            "high-resolution images",
        ),
        onsite_typical=True,
        remote_ok=False,
        essential_dimensions=(
            "photography subject and shoot type",
            "approximate quantity of subjects or edited photos",
            "location (on-site city or studio shipping)",
            "target photoshoot date or deadline",
            "budget",
        ),
        quotation_dimensions=(
            "intended usage (web, print, ads)",
            "editing style and props",
        ),
        optional_dimensions=("visual mood references",),
        technical_spec_hints=("Color-corrected high-res masters and web crops",),
    ),
    "graphic design": ServiceDefinition(
        category="graphic design",
        aliases=(
            "graphic design",
            "flyer",
            "poster",
            "brochure",
            "packaging",
            "signage",
            "print design",
            "banner",
            "visual design",
        ),
        related_categories=("logo and branding", "social media creatives", "digital menu design"),
        query_expansion_terms=(
            "print layout",
            "packaging design",
            "adobe illustrator",
            "indesign",
            "promotional collateral",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "exact design deliverables and quantities needed",
            "intended use (online display vs physical print/packaging)",
            "budget",
            "timeline",
        ),
        quotation_dimensions=(
            "existing brand colors, logo, or text availability",
            "dimensions or printer format requirements",
        ),
        optional_dimensions=("creative style references",),
        technical_spec_hints=(
            "CMYK print-ready PDF with bleed for print; RGB PNG/PDF for digital use",
        ),
    ),
    "social media creatives": ServiceDefinition(
        category="social media creatives",
        aliases=(
            "instagram banner",
            "instagram banners",
            "instagram promotional",
            "promotional banner",
            "promotional banners",
            "instagram post",
            "instagram posts",
            "social banner",
            "social banners",
            "social creative",
            "social creatives",
            "social media graphics",
            "story template",
            "carousel",
            "ad creative",
            "reels cover",
        ),
        related_categories=("graphic design", "social media management", "logo and branding"),
        query_expansion_terms=(
            "instagram carousels",
            "story templates",
            "canva templates",
            "social launch kit",
            "short-form creative",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "target platforms and formats (Instagram feed, stories, ads, banners)",
            "approximate number of creatives or reusable templates",
            "budget",
            "timeline",
        ),
        quotation_dimensions=(
            "existing photos, copy, or brand logo availability",
            "need for editable Canva/Figma templates",
        ),
        optional_dimensions=("visual tone or campaign angle",),
        technical_spec_hints=("1080x1080 square and 1080x1920 vertical social ratios",),
    ),
    "digital menu design": ServiceDefinition(
        category="digital menu design",
        aliases=(
            "digital menu",
            "qr menu",
            "cafe menu",
            "restaurant menu",
            "menu design",
            "menu card",
            "print menu",
        ),
        related_categories=("graphic design", "website development"),
        query_expansion_terms=(
            "menu layout",
            "qr menu design",
            "print-ready menu",
            "typography hierarchy",
            "easy seasonal edits",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "menu format (QR mobile menu, in-store screen, or printable PDF)",
            "approximate number of sections/items or pages",
            "budget",
            "timeline",
        ),
        quotation_dimensions=(
            "menu item list/prices readiness and logo assets",
            "whether the merchant needs easy self-editing later",
        ),
        optional_dimensions=("layout style and photo inclusion",),
        technical_spec_hints=("Mobile-readable PDF/QR layout plus editable source file",),
    ),
    "social media management": ServiceDefinition(
        category="social media management",
        aliases=(
            "social media management",
            "manage instagram",
            "community management",
            "content calendar",
            "social posting",
            "social media account",
        ),
        related_categories=("social media creatives", "digital marketing"),
        query_expansion_terms=(
            "content calendar",
            "daily community replies",
            "social growth strategy",
            "caption copywriting",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "platforms to manage and posting cadence",
            "duration of management (e.g., 1 month launch support)",
            "budget",
        ),
        quotation_dimensions=(
            "who supplies raw photos/videos vs captions and hashtags",
            "community DM/comment response expectations",
        ),
        optional_dimensions=("tone of voice and local engagement goals",),
        technical_spec_hints=("Structured weekly content calendar and engagement reporting",),
    ),
    "digital marketing": ServiceDefinition(
        category="digital marketing",
        aliases=(
            "digital marketing",
            "marketing campaign",
            "paid ads",
            "google ads",
            "meta ads",
            "instagram ads",
            "facebook ads",
            "local seo",
            "launch promotion",
            "lead generation",
        ),
        related_categories=("social media management", "social media creatives"),
        query_expansion_terms=(
            "paid social",
            "local seo",
            "campaign analytics",
            "conversion tracking",
            "local launch ads",
        ),
        onsite_typical=False,
        remote_ok=True,
        essential_dimensions=(
            "campaign goal (store visits, online orders, leads, awareness)",
            "target geographic area and channels",
            "management fee budget vs ad spend clarity",
            "launch timeframe",
        ),
        quotation_dimensions=(
            "existing ad accounts or website tracking status",
            "whether ad creatives already exist",
        ),
        optional_dimensions=("KPI targets and audience segments",),
        technical_spec_hints=("Conversion pixel/analytics setup and local audience targeting",),
    ),
}

# Preserve existing lowercase aliases mapping for backward compatibility with ProjectAnalyzer.
SERVICE_ALIASES: dict[str, tuple[str, ...]] = {
    definition.category: definition.aliases
    for definition in SERVICE_REGISTRY.values()
}

# Controlled skill normalization & equivalents (kept narrow so unrelated skills do not inflate scores).
SKILL_CANONICAL_MAP: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "nextjs": "next.js",
    "next": "next.js",
    "nodejs": "node.js",
    "ui design": "ui/ux design",
    "ux design": "ui/ux design",
    "ui ux": "ui/ux design",
    "ui/ux": "ui/ux design",
    "user experience": "ui/ux design",
    "user interface": "ui/ux design",
    "responsive web design": "responsive design",
    "mobile responsive": "responsive design",
    "illustrator": "adobe illustrator",
    "photoshop": "adobe photoshop",
    "brand design": "brand identity",
    "branding": "brand strategy",
    "visual identity": "brand identity",
    "logo": "logo design",
    "local seo": "seo",
    "search engine optimization": "seo",
    "woocommerce": "wordpress",
    "e-commerce": "ecommerce",
    "online ordering": "ecommerce",
    "culinary styling": "food styling",
    "dish styling": "food styling",
    "instagram ads": "paid social",
    "meta ads": "paid social",
    "facebook ads": "paid social",
    "social banners": "social design",
    "instagram banners": "social design",
    "social media design": "social design",
    "qr menu": "menu design",
}

SKILL_SYNONYM_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({"figma", "ui/ux design", "wireframing", "web design"}),
    frozenset({"react", "next.js", "frontend", "web development"}),
    frozenset({"wordpress", "cms", "menu integration", "web design"}),
    frozenset({"responsive design", "web design", "web development", "accessibility"}),
    frozenset({"logo design", "brand identity", "brand strategy", "typography"}),
    frozenset({"adobe illustrator", "illustration", "vector design", "graphic design"}),
    frozenset({"food photography", "restaurant photography", "product photography", "food styling"}),
    frozenset({"lightroom", "photo retouching", "photo editing"}),
    frozenset({"social design", "instagram", "canva", "content templates"}),
    frozenset({"social media strategy", "community management", "content calendar", "copywriting"}),
    frozenset({"paid social", "google ads", "digital marketing", "analytics"}),
    frozenset({"menu design", "layout", "print production"}),
)

_CLEAN_TOKEN_RE = re.compile(r"[^a-z0-9+.#/\s-]+")


def normalize_token(value: str) -> str:
    cleaned = _CLEAN_TOKEN_RE.sub(" ", (value or "").lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_skill(skill: str) -> str:
    norm = normalize_token(skill)
    return SKILL_CANONICAL_MAP.get(norm, norm)


def canonicalize_service(value: str) -> str:
    lowered = normalize_token(value)
    if lowered in SERVICE_REGISTRY:
        return lowered
    # Check longest aliases first so "food photography" beats generic "photography"
    alias_pairs = [
        (alias, category)
        for category, definition in SERVICE_REGISTRY.items()
        for alias in definition.aliases
    ]
    alias_pairs.sort(key=lambda pair: len(pair[0]), reverse=True)
    for alias, category in alias_pairs:
        if alias in lowered:
            return category
    return lowered or "custom service"


def detect_services_from_text(text: str) -> list[str]:
    lowered = normalize_token(text)
    if not lowered:
        return []
    found: list[str] = []
    # Prioritize specific categories before broad ones (e.g. food photography before photography)
    ordered_categories = sorted(
        SERVICE_REGISTRY.keys(),
        key=lambda cat: (cat == "photography", -len(cat)),
    )
    for category in ordered_categories:
        definition = SERVICE_REGISTRY[category]
        if any(alias in lowered for alias in definition.aliases):
            # Avoid adding generic "photography" when "food photography" already matched unless requested separately.
            if category == "photography" and "food photography" in found:
                continue
            found.append(category)
    return found


def classify_category_match(
    requested_category: str,
    candidate_categories: Sequence[str],
    candidate_primary: str | None = None,
) -> Literal["exact", "related", "unrelated"]:
    req_canon = canonicalize_service(requested_category)
    req_raw = normalize_token(requested_category)
    cand_norm_list = [normalize_token(c) for c in candidate_categories if c]
    if candidate_primary:
        cand_norm_list.append(normalize_token(candidate_primary))
    cand_canon_set = {canonicalize_service(c) for c in cand_norm_list if c}

    definition = SERVICE_REGISTRY.get(req_canon)
    # Explicit conflict boundary check (e.g. wedding photographer vs food photography).
    if definition and definition.conflicting_categories:
        joined = " ".join(cand_norm_list)
        for conflict in definition.conflicting_categories:
            conflict_keyword = conflict.split()[0]
            if (conflict in joined or f"{conflict_keyword} photo" in joined) and req_canon not in cand_norm_list:
                return "unrelated"

    if req_canon in cand_canon_set or req_raw in set(cand_norm_list):
        return "exact"

    if definition:
        related_set = set(definition.related_categories)
        if cand_canon_set & related_set:
            return "related"
    return "unrelated"


def expand_matching_query(
    *,
    service_category: str,
    required_skills: Sequence[str] = (),
    mandatory_skills: Sequence[str] = (),
    preferred_skills: Sequence[str] = (),
    brief: str = "",
    location: str | None = None,
    context_tags: Sequence[str] = (),
) -> dict[str, Any]:
    canonical = canonicalize_service(service_category)
    definition = SERVICE_REGISTRY.get(canonical)
    related = list(definition.related_categories) if definition else []

    raw_skills = [*mandatory_skills, *required_skills, *preferred_skills]
    normalized_skills = list(dict.fromkeys(normalize_skill(s) for s in raw_skills if s and s.strip()))

    synonym_terms: list[str] = []
    for norm_skill in normalized_skills:
        for group in SKILL_SYNONYM_GROUPS:
            if norm_skill in group:
                for member in sorted(group):
                    if member not in normalized_skills and member not in synonym_terms:
                        synonym_terms.append(member)

    domain_terms = list(definition.query_expansion_terms) if definition else []
    expanded_terms = list(dict.fromkeys([canonical, *normalized_skills, *synonym_terms[:6], *domain_terms[:5]]))

    parts = [part for part in (brief.strip(), canonical, ", ".join(normalized_skills), ", ".join(domain_terms[:4]), ", ".join(context_tags)) if part]
    if location and location.strip():
        parts.append(f"Location: {location.strip()}")
    expanded_brief = " | ".join(parts)

    return {
        "canonical_category": canonical,
        "related_categories": related,
        "normalized_skills": normalized_skills,
        "expanded_terms": expanded_terms,
        "expanded_brief": expanded_brief,
        "onsite_typical": definition.onsite_typical if definition else False,
    }


def _skills_are_synonymous(left_norm: str, right_norm: str) -> bool:
    if left_norm == right_norm:
        return True
    for group in SKILL_SYNONYM_GROUPS:
        if left_norm in group and right_norm in group:
            return True
    return False


def score_skill_match(
    requested_skills: Sequence[str],
    candidate_skills: Sequence[str],
    *,
    mandatory_skills: Sequence[str] = (),
    portfolio_text: str = "",
) -> tuple[float, list[str], list[str], list[str], bool]:
    """Compare requested/mandatory skills against candidate skills.

    Returns (compatibility_0_to_1, exact_matches, synonym_matches, missing_skills, satisfies_mandatory).
    """
    cand_raw = [normalize_token(s) for s in candidate_skills if s and s.strip()]
    cand_norm = {normalize_skill(s) for s in candidate_skills if s and s.strip()}
    portfolio_norm = normalize_token(portfolio_text)

    mandatory_exact_or_syn = True
    for m_skill in mandatory_skills:
        m_norm = normalize_skill(m_skill)
        if not m_norm:
            continue
        if m_norm in cand_norm or normalize_token(m_skill) in cand_raw:
            continue
        if any(_skills_are_synonymous(m_norm, c) for c in cand_norm):
            continue
        mandatory_exact_or_syn = False
        break

    combined_requested = list(dict.fromkeys([*mandatory_skills, *requested_skills]))
    if not combined_requested:
        return 0.55, [], [], [], mandatory_exact_or_syn

    total_weight = 0.0
    achieved_weight = 0.0
    exact_matches: list[str] = []
    synonym_matches: list[str] = []
    missing_skills: list[str] = []

    mandatory_set = {normalize_skill(s) for s in mandatory_skills if s and s.strip()}
    for req in combined_requested:
        req_clean = req.strip()
        req_norm = normalize_skill(req_clean)
        req_token = normalize_token(req_clean)
        weight = 1.5 if req_norm in mandatory_set else 1.0
        total_weight += weight

        if req_norm in cand_norm or req_token in cand_raw:
            achieved_weight += weight * 1.0
            exact_matches.append(req_clean)
        elif any(_skills_are_synonymous(req_norm, c) for c in cand_norm):
            achieved_weight += weight * 0.75
            synonym_matches.append(req_clean)
        elif (
            any(tok in " ".join(cand_norm) for tok in req_norm.split() if len(tok) >= 4)
            or (req_norm in portfolio_norm and len(req_norm) >= 4)
        ):
            achieved_weight += weight * 0.4
            synonym_matches.append(f"{req_clean} (partial)")
        else:
            missing_skills.append(req_clean)

    ratio = min(1.0, achieved_weight / total_weight) if total_weight > 0 else 0.55
    return round(ratio, 4), exact_matches, synonym_matches, missing_skills, mandatory_exact_or_syn


def build_service_consultation_guidance(detected_services: Sequence[str]) -> dict[str, Any]:
    """Summarize service-specific priorities and plain-English prompts for the scoping chatbot."""
    services_info: list[dict[str, Any]] = []
    onsite_services: list[str] = []
    for raw_service in detected_services:
        canon = canonicalize_service(raw_service)
        definition = SERVICE_REGISTRY.get(canon)
        if definition is None:
            services_info.append(
                {
                    "service": canon,
                    "onsite_typical": False,
                    "essential": ["exact deliverable scope", "quantity/scale", "budget", "timeline"],
                    "quotation": ["reference examples", "existing materials"],
                    "optional": ["creative preferences"],
                }
            )
            continue
        if definition.onsite_typical:
            onsite_services.append(canon)
        services_info.append(
            {
                "service": canon,
                "onsite_typical": definition.onsite_typical,
                "essential": list(definition.essential_dimensions),
                "quotation": list(definition.quotation_dimensions),
                "optional": list(definition.optional_dimensions),
                "technical_spec_hints": list(definition.technical_spec_hints),
            }
        )
    return {
        "detected_services": [item["service"] for item in services_info],
        "onsite_services": onsite_services,
        "services": services_info,
    }
