from __future__ import annotations

from pydantic import BaseModel

from ..providers.xai_text_provider import XAITextProvider
from ..schemas.product import ProductContextSchema, ProductImageUnderstandingSchema, ProductRawInputSchema
from .image_understanding_service import product_image_understanding_service
from .input_normalizer import normalize_product_raw_input
from .product_context_builder import product_context_builder_service


class ProductParseArtifacts(BaseModel):
    raw_input: ProductRawInputSchema
    image_understanding: ProductImageUnderstandingSchema
    product_context: ProductContextSchema


class ProductParserService:
    def parse(
        self,
        project_id: int,
        inp: ProductRawInputSchema,
        project_constraints: dict | None = None,
    ) -> ProductParseArtifacts:
        normalized_raw = normalize_product_raw_input(inp)
        image_result = product_image_understanding_service.understand(project_id, normalized_raw)
        product_context = product_context_builder_service.build(
            project_id=project_id,
            raw_input=normalized_raw,
            image_understanding=image_result,
            project_constraints=project_constraints or {},
        )
        return ProductParseArtifacts(
            raw_input=normalized_raw,
            image_understanding=image_result,
            product_context=product_context,
        )


class XAIProductParserProvider:
    """Legacy test shim for the pre-S1 ProductContext parser API."""

    def __init__(self, text_provider: XAITextProvider):
        self._text = text_provider

    def normalize(self, project_id: int, payload: dict) -> ProductContextSchema:
        data = self._text.generate_structured_json(
            project_id=project_id,
            service_name="legacy_product_parser",
            system_prompt="Output only one product context JSON object.",
            user_payload=payload,
            expected_schema_name="LegacyProductContext",
            stage="PRODUCT_CONTEXT_BUILD",
        )
        return ProductContextSchema(
            product_name=str(data.get("product_name") or payload.get("title") or ""),
            product_category=str(data.get("product_category") or data.get("category") or ""),
            product_summary=str(data.get("product_summary") or data.get("notes_for_story") or ""),
            core_selling_points=list(data.get("core_selling_points") or data.get("selling_points") or data.get("core_features") or []),
            target_users=[str(data.get("target_users"))] if isinstance(data.get("target_users"), str) and data.get("target_users") else list(data.get("target_users") or []),
            usage_scenarios=list(data.get("usage_scenarios") or []),
            visual_features=list(data.get("visual_features") or []),
            source_trace={"product_name": "user_input"},
        )


product_parser_service = ProductParserService()
