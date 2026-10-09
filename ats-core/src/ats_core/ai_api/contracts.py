import math
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Dispatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal[1]
    job_id: UUID


class AIResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal[1] = 1
    attempt_id: UUID
    document_id: UUID
    document_version: int = Field(ge=1)
    input_revision: int = Field(ge=1)
    job_revision: int | None = None
    extraction_status: Literal["COMPLETED", "FAILED", "SKIPPED"]
    evaluation_status: Literal["COMPLETED", "FAILED", "SKIPPED", "PENDING"]
    profile: dict[str, Any] = Field(default_factory=dict)
    contact: dict[str, Any] = Field(default_factory=dict)
    sanitized_text: str = Field(default="", max_length=500000)
    scorecard: dict[str, Any] | None = None
    embedding: list[float] | None = None
    embedding_model: str | None = None
    preprocessing_version: str | None = None
    warnings: list[str] = Field(default_factory=list, max_length=100)
    error_code: str | None = Field(default=None, pattern=r"^[A-Z0-9_]{1,100}$")

    @field_validator("embedding")
    @classmethod
    def embedding_contract(cls, value):
        if value is not None and (
            len(value) != 768 or not all(math.isfinite(x) for x in value) or not any(value)
        ):
            raise ValueError("Expected a finite nonzero 768-dimensional embedding")
        return value

    @model_validator(mode="after")
    def result_versions(self):
        if self.embedding is not None and (
            self.embedding_model != "google/embeddinggemma-2"
            or self.preprocessing_version != "candidate-summary-v1"
        ):
            raise ValueError("Incompatible embedding version")
        if self.evaluation_status == "COMPLETED":
            card = self.scorecard or {}
            score = card.get("overall_match_score")
            if (
                type(score) not in (int, float)
                or not math.isfinite(score)
                or not 0 <= score <= 100
                or not isinstance(card.get("categories"), list)
                or not card.get("categories")
                or not card.get("model_version")
            ):
                raise ValueError("Completed evaluations require a valid scorecard")
            for category in card["categories"]:
                if (
                    not isinstance(category, dict)
                    or not isinstance(category.get("name"), str)
                    or not category["name"].strip()
                    or type(category.get("score")) not in (int, float)
                    or not math.isfinite(category["score"])
                    or not 1 <= category["score"] <= 5
                    or category.get("max_score") != 5
                    or not isinstance(category.get("assessment"), str)
                    or not category["assessment"].strip()
                ):
                    raise ValueError("Evaluation rubric requires scored assessments")
        return self


class QueryEmbedding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=50000)


class Rerank(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=50000)
    candidates: list[dict[str, Any]] = Field(max_length=100)
    top_k: int = Field(ge=1, le=50)


class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: UUID
    search_phrase: str = Field(min_length=1, max_length=2000)
