from gigsaw_ai.llm.gemini_client import _gemini_response_schema
from gigsaw_ai.schemas.projects import ProjectAnalysis
from gigsaw_ai.services.task_decomposer import TaskDecompositionOutput


def test_gemini_schema_removes_unsupported_pydantic_fields():
    schema = _gemini_response_schema(ProjectAnalysis)
    serialized = str(schema)
    assert "additionalProperties" not in serialized
    assert "additional_properties" not in serialized


def test_gemini_schema_inlines_nested_references():
    schema = _gemini_response_schema(TaskDecompositionOutput)
    assert schema["properties"]["work_packages"]["items"]["type"] == "object"
