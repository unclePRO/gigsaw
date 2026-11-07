from __future__ import annotations

from pydantic import Field

from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.schemas.common import SchemaModel
from gigsaw_ai.schemas.projects import ProjectAnalysis
from gigsaw_ai.schemas.work_packages import WorkPackage
from gigsaw_ai.services.project_analyzer import canonical_service_category


class TaskDecompositionOutput(SchemaModel):
    work_packages: list[WorkPackage] = Field(min_length=1)


TEMPLATES = {
    "website development": ("Website", ["responsive design", "web development", "seo"], ["Responsive website", "Launch-ready pages"], 14, ["logo and branding", "food photography", "digital menu design"]),
    "logo and branding": ("Brand identity", ["logo design", "brand strategy", "typography"], ["Primary logo", "Colour and typography guide"], 10, []),
    "graphic design": ("Launch graphic design", ["graphic design", "layout", "adobe illustrator"], ["Launch design assets"], 7, ["logo and branding"]),
    "social media creatives": ("Social creative pack", ["social design", "instagram", "content templates"], ["Social post templates", "Story creative pack"], 7, ["logo and branding", "food photography"]),
    "food photography": ("Food photography", ["food photography", "styling", "lightroom"], ["Edited food photographs", "Web-ready image set"], 5, ["logo and branding"]),
    "digital menu design": ("Digital menu", ["menu design", "layout", "accessibility"], ["Digital menu", "Print-ready menu"], 6, ["logo and branding"]),
    "social media management": ("Social media launch management", ["social media strategy", "community management", "copywriting"], ["30-day content calendar", "Launch-month management"], 10, ["social media creatives"]),
    "digital marketing": ("Digital launch campaign", ["paid social", "local seo", "analytics"], ["Campaign plan", "Performance baseline"], 21, ["logo and branding", "social media creatives"]),
}


class TaskDecomposer:
    def __init__(self, llm: GeminiClient) -> None:
        self.llm = llm

    @staticmethod
    def _demo_output(analysis: ProjectAnalysis) -> TaskDecompositionOutput:
        category_ids = {category: f"wp-{index:02d}" for index, category in enumerate(analysis.required_services, start=1)}
        packages = []
        for category in analysis.required_services:
            name, skills, deliverables, days, dependency_categories = TEMPLATES.get(
                category, (category.title(), [category], [f"Completed {category}"], 7, [])
            )
            package = WorkPackage(
                work_package_id=category_ids[category], name=name, service_category=category,
                description=f"Deliver {category} work supporting {analysis.project_name}.",
                required_skills=skills, deliverables=deliverables,
                dependencies=[category_ids[item] for item in dependency_categories if item in category_ids],
                estimated_days=days,
            )
            if category == "social media management":
                package = package.model_copy(update={"delivery_period_days": 30})
            packages.append(package)
        return TaskDecompositionOutput(work_packages=packages)

    async def decompose(self, analysis: ProjectAnalysis) -> list[WorkPackage]:
        demo = self._demo_output(analysis)
        result = await self.llm.generate_structured("task_decomposition", analysis.model_dump(mode="json"), TaskDecompositionOutput, demo)
        packages = [
            package.model_copy(update={"service_category": canonical_service_category(package.service_category)})
            for package in result.work_packages
        ]
        by_id = {package.work_package_id: package for package in packages}
        normalized: list[WorkPackage] = []
        for package in packages:
            dependencies = list(package.dependencies)
            if package.service_category == "digital menu design":
                dependencies = [
                    dependency for dependency in dependencies
                    if by_id.get(dependency) is None or by_id[dependency].service_category != "food photography"
                ]
            if package.service_category == "social media management" and package.estimated_days > 15:
                package = package.model_copy(update={"estimated_days": 10, "delivery_period_days": 30})
            normalized.append(package.model_copy(update={"dependencies": dependencies}))
        return normalized
