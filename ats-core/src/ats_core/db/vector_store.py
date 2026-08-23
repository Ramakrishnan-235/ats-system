import logging
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from ats_core.models.db import Candidate, JobPosting, Application, ScoringAudit

logger = logging.getLogger("ats.db.vector_store")


class CandidateSearchParams(BaseModel):
    min_years_experience: Optional[float] = Field(None, ge=0.0, description="Minimum years of experience")
    max_years_experience: Optional[float] = Field(None, ge=0.0, description="Maximum years of experience")
    location: Optional[str] = Field(None, description="Location filter (e.g. 'San Francisco, CA' or 'Remote')")
    highest_education: Optional[List[str]] = Field(None, description="List of acceptable education levels")
    required_skills: Optional[List[str]] = Field(None, description="Skills candidate must possess")
    limit: int = Field(10, ge=1, le=100, description="Maximum candidate matches to return")


class CandidateSearchResult(BaseModel):
    id: uuid.UUID
    anonymized_name: str
    target_headline: str
    years_of_experience: float
    location: str
    highest_education: Optional[str]
    core_skills: List[str]
    similarity_score: float
    structured_profile: Dict[str, Any]


class VectorStore:
    """Async vector store powered by PostgreSQL pgvector with HNSW indexing and metadata filtering."""

    def __init__(self, database_url: str):
        self.engine = create_async_engine(database_url, echo=False)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)

    async def close(self) -> None:
        await self.engine.dispose()

    async def insert_candidate(
        self,
        target_headline: str,
        years_of_experience: float,
        location: str = "Remote",
        highest_education: Optional[str] = None,
        core_skills: Optional[List[str]] = None,
        raw_anonymized_text: str = "",
        structured_profile: Optional[Dict[str, Any]] = None,
        embedding: Optional[List[float]] = None,
        anonymized_name: str = "[CANDIDATE_NAME]",
        parsing_engine: str = "hybrid-pymupdf-docling",
    ) -> Candidate:
        """Insert candidate profile with metadata and vector embedding."""
        candidate = Candidate(
            anonymized_name=anonymized_name,
            target_headline=target_headline,
            years_of_experience=years_of_experience,
            location=location,
            highest_education=highest_education,
            core_skills=core_skills or [],
            raw_anonymized_text=raw_anonymized_text,
            structured_profile=structured_profile or {},
            parsing_engine=parsing_engine,
            embedding=embedding,
        )
        async with self.session_factory() as session:
            async with session.begin():
                session.add(candidate)
            await session.refresh(candidate)
        return candidate

    async def search_candidates_by_vector(
        self,
        query_embedding: List[float],
        params: Optional[CandidateSearchParams] = None,
    ) -> List[CandidateSearchResult]:
        """Perform HNSW cosine distance vector similarity search combined with payload filters."""
        if params is None:
            params = CandidateSearchParams()

        # Cosine distance via pgvector: distance = embedding <=> query_vector
        # Cosine similarity = 1 - distance
        cosine_distance = Candidate.embedding.cosine_distance(query_embedding)
        similarity_score = (1.0 - cosine_distance).label("similarity_score")

        stmt = select(Candidate, similarity_score).where(Candidate.embedding.is_not(None))

        # Payload Filters
        conditions = []
        if params.min_years_experience is not None:
            conditions.append(Candidate.years_of_experience >= params.min_years_experience)

        if params.max_years_experience is not None:
            conditions.append(Candidate.years_of_experience <= params.max_years_experience)

        def _escape_like_pattern(term: str) -> str:
            # Escape literal %, _ and \ characters for SQL LIKE
            escaped = term.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            return f"%{escaped}%"

        if params.location:
            # Match exact or case-insensitive partial / 'Remote'
            loc_pattern = _escape_like_pattern(params.location)
            conditions.append(
                or_(
                    Candidate.location.ilike(loc_pattern, escape="\\"),
                    Candidate.location.ilike("%Remote%"),
                )
            )

        if params.highest_education:
            # Match any education in the allowed list (case-insensitive)
            edu_conditions = [
                Candidate.highest_education.ilike(_escape_like_pattern(edu), escape="\\")
                for edu in params.highest_education
                if edu and edu.strip()
            ]
            if edu_conditions:
                conditions.append(or_(*edu_conditions))

        if params.required_skills:
            # GIN array contains filter
            conditions.append(Candidate.core_skills.contains(params.required_skills))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        # Order by cosine distance ascending (most similar first)
        stmt = stmt.order_by(cosine_distance.asc()).limit(params.limit)

        async with self.session_factory() as session:
            result = await session.execute(stmt)
            rows = result.all()

            search_results = []
            for candidate, score in rows:
                search_results.append(
                    CandidateSearchResult(
                        id=candidate.id,
                        anonymized_name=candidate.anonymized_name,
                        target_headline=candidate.target_headline,
                        years_of_experience=float(candidate.years_of_experience),
                        location=candidate.location,
                        highest_education=candidate.highest_education,
                        core_skills=candidate.core_skills,
                        similarity_score=round(float(score), 4),
                        structured_profile=candidate.structured_profile,
                    )
                )
            return search_results
