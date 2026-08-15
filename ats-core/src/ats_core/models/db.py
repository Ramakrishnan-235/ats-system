import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from sqlalchemy import (
    String, Text, Numeric, Integer, DateTime, ForeignKey, 
    UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anonymized_name: Mapped[str] = mapped_column(String(100), default="[CANDIDATE_NAME]", nullable=False)
    target_headline: Mapped[str] = mapped_column(String(255), nullable=False)
    years_of_experience: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    location: Mapped[str] = mapped_column(String(100), default="Remote", nullable=False)
    highest_education: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    core_skills: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    raw_anonymized_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_profile: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    parsing_engine: Mapped[str] = mapped_column(String(50), default="hybrid-pymupdf-docling")
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    applications: Mapped[List["Application"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    scoring_audits: Mapped[List["ScoringAudit"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location: Mapped[str] = mapped_column(String(100), default="Remote", nullable=False)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    min_years_experience: Mapped[float] = mapped_column(Numeric(4, 1), default=0.0, nullable=False)
    required_skills: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)
    structured_criteria: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    applications: Mapped[List["Application"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    scoring_audits: Mapped[List["ScoringAudit"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="APPLIED", nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="Initial Ingestion", nullable=False)
    current_match_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    candidate: Mapped["Candidate"] = relationship(back_populates="applications")
    job: Mapped["JobPosting"] = relationship(back_populates="applications")
    scoring_audits: Mapped[List["ScoringAudit"]] = relationship(back_populates="application")


class ScoringAudit(Base):
    __tablename__ = "scoring_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    overall_match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    qualification_tier: Mapped[str] = mapped_column(String(30), nullable=False)
    criteria_breakdown: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    pros: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    cons_or_risks: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    recommended_interview_questions: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    recruiter_summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Telemetry
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    raw_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_llm_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    application: Mapped[Optional["Application"]] = relationship(back_populates="scoring_audits")
    candidate: Mapped["Candidate"] = relationship(back_populates="scoring_audits")
    job: Mapped["JobPosting"] = relationship(back_populates="scoring_audits")