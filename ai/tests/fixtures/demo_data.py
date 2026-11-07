from decimal import Decimal

from gigsaw_ai.database.seed import demo_freelancers, demo_services
from gigsaw_ai.schemas.projects import ProjectAnalyzeRequest


CAFE_REQUEST = ProjectAnalyzeRequest(
    project_name="Copper Cup Cafe launch",
    customer_request="I need a website, logo, Instagram promotional banners, food photography, digital menu and social media management for a new cafe.",
    budget=Decimal("2000"),
    currency="USD",
)

FREELANCERS = demo_freelancers()
SERVICES = demo_services()
