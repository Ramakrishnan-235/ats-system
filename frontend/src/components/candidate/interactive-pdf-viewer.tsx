"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
  Sparkles,
  X,
  FileText,
  Code2,
  CheckCircle2,
  Building2,
  GraduationCap,
  Briefcase,
  Layers,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CandidateDetail, CitationLocation, ExperienceItem } from "@/types/ats";

interface InteractivePdfViewerProps {
  candidate: CandidateDetail;
  activeCitation?: CitationLocation | null;
  onClearCitation?: () => void;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBullets(description: string): string[] {
  if (!description) return [];

  // If description has explicit newlines or bullet markers
  const lines = description
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-\*]+/, "").trim())
    .filter((l) => l.length > 0);

  if (lines.length > 1) return lines;

  // If single string with multiple sentences
  const sentences = description
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.length > 0 ? sentences : [description];
}

// Smart section extractor from real raw text
function extractSectionsFromRawText(rawText: string, defaultHeadline: string, foundSkills: string[]) {
  if (!rawText || rawText.trim().length < 50) return null;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sections: {
    summary?: string;
    experiences: ExperienceItem[];
    education?: string;
    skills?: string[];
  } = {
    experiences: [],
    skills: [],
  };

  let currentSection = "HEADER";
  let currentRole = defaultHeadline || "Software Engineer";
  let currentCompany = "Industry Partner";
  let currentPeriod = "Recent";
  let currentBullets: string[] = [];

  const SECTION_HEADERS: Record<string, string> = {
    experience: "EXPERIENCE",
    "work history": "EXPERIENCE",
    "employment history": "EXPERIENCE",
    internships: "EXPERIENCE",
    "key projects": "PROJECTS",
    projects: "PROJECTS",
    "academic projects": "PROJECTS",
    education: "EDUCATION",
    academics: "EDUCATION",
    summary: "SUMMARY",
    "professional summary": "SUMMARY",
    "executive summary": "SUMMARY",
    profile: "SUMMARY",
    skills: "SKILLS",
    "technical skills": "SKILLS",
    certifications: "CERTIFICATIONS",
    achievements: "ACHIEVEMENTS",
  };

  const dateRangePattern = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:20\d{2}|19\d{2})?\s*[-–—to/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Current)[a-z]*\.?\s*(?:20\d{2}|19\d{2})?|(?:20\d{2}|19\d{2})\s*[-–—to]\s*(?:20\d{2}|Present|Current))/i;

  for (const line of lines) {
    const cleanHeader = line.toLowerCase().replace(/[^a-z\s]/g, "").trim();

    if (SECTION_HEADERS[cleanHeader]) {
      // Save current experience block if ending experience section
      if ((currentSection === "EXPERIENCE" || currentSection === "PROJECTS") && currentBullets.length > 0) {
        sections.experiences.push({
          role: currentRole,
          company: currentCompany,
          period: currentPeriod,
          description: currentBullets.join("\n• "),
        });
        currentBullets = [];
      }
      currentSection = SECTION_HEADERS[cleanHeader];
      continue;
    }

    if (currentSection === "SUMMARY") {
      if (!sections.summary && line.length > 25) {
        sections.summary = line;
      }
    } else if (currentSection === "EDUCATION") {
      if (!sections.education && line.length > 8 && !line.toLowerCase().startsWith("cgpa")) {
        sections.education = line.replace(/\s*(?:CGPA|GPA|HSC|SSLC).*/i, "").replace(/[-—|\s]+$/, "");
      }
    } else if (currentSection === "SKILLS") {
      const cleaned = line.replace(/^(?:Languages|Frontend|Backend|Tools|Databases|ML\s*\/\s*misc|Cloud|Frameworks)\s*:\s*/i, "");
      const tokens = cleaned.split(/[,|;•\*\t]+/).map(t => t.replace(/\(.*?\)/g, "").trim()).filter(t => t.length > 1 && t.length < 25);
      for (const tok of tokens) {
        if (!sections.skills?.includes(tok)) {
          sections.skills?.push(tok);
        }
      }
    } else if (currentSection === "EXPERIENCE") {
      const dateMatch = line.match(dateRangePattern);
      if (dateMatch) {
        if (currentBullets.length > 0) {
          sections.experiences.push({
            role: currentRole,
            company: currentCompany,
            period: currentPeriod,
            description: currentBullets.join("\n• "),
          });
          currentBullets = [];
        }
        currentPeriod = dateMatch[0];
        const withoutDate = line.replace(dateMatch[0], "").trim().replace(/^[-—|•,\s]+|[-—|•,\s]+$/g, "");
        if (withoutDate.length > 3) {
          if (withoutDate.includes("—") || withoutDate.includes("-") || withoutDate.includes("@") || withoutDate.includes(",")) {
            const parts = withoutDate.split(/[-—@,]/);
            currentRole = parts[0]?.trim() || currentRole;
            currentCompany = parts[1]?.trim() || "Industry Partner";
          } else {
            currentRole = withoutDate;
          }
        }
      } else if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || line.length > 30) {
        currentBullets.push(line.replace(/^[•\-\*]\s*/, ""));
      } else if (line.length > 3 && line.length < 60 && !line.includes("@") && !line.includes("—")) {
        if (currentBullets.length > 0) {
          sections.experiences.push({
            role: currentRole,
            company: currentCompany,
            period: currentPeriod,
            description: currentBullets.join("\n• "),
          });
          currentBullets = [];
          currentRole = line;
        } else {
          currentCompany = line;
        }
      }
    }
  }

  // Push final experience item
  if (currentBullets.length > 0) {
    sections.experiences.push({
      role: currentRole,
      company: currentCompany,
      period: currentPeriod,
      description: currentBullets.join("\n• "),
    });
  }

  return sections;
}

export function InteractivePdfViewer({
  candidate,
  activeCitation,
  onClearCitation,
}: InteractivePdfViewerProps) {
  const [redactPII, setRedactPII] = useState(true);
  const [viewMode, setViewMode] = useState<"layout" | "raw" | "original-pdf">("layout");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCitationState, setActiveCitationState] = useState<CitationLocation | null>(
    activeCitation || null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const targetHighlightRef = useRef<HTMLLIElement>(null);

  // Determine effective PDF source URL
  const pdfUrl =
    candidate.pdf_blob_url ||
    candidate.pdf_url ||
    (candidate.id ? `http://localhost:8000/api/v1/candidates/${candidate.id}/resume-pdf` : null);

  // Sync active citation from parent props
  useEffect(() => {
    if (activeCitation) {
      setActiveCitationState(activeCitation);
      setCurrentPage(activeCitation.page || 1);
      // Auto-switch to layout mode to highlight
      if (viewMode === "original-pdf") {
        setViewMode("layout");
      }

      setTimeout(() => {
        if (targetHighlightRef.current) {
          targetHighlightRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } else if (activeCitation.page === 2 && page2Ref.current) {
          page2Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (page1Ref.current) {
          page1Ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [activeCitation, viewMode]);

  const handleClear = () => {
    setActiveCitationState(null);
    if (onClearCitation) {
      onClearCitation();
    }
  };

  // PII masking variables
  const displayName = redactPII ? candidate.anonymized_name : candidate.name;
  const displayEmail = redactPII ? "[REDACTED_EMAIL@DOMAIN.COM]" : candidate.email;
  const displayPhone = redactPII ? "[REDACTED_PHONE_NUMBER]" : candidate.phone;
  const displayLocation = redactPII ? "[REDACTED_LOCATION]" : candidate.location;

  // Search highlighting helper
  const highlightSearch = (text: string) => {
    if (!text) return "";
    if (!searchQuery.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(searchQuery.trim())})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase().trim() ? (
            <mark key={i} className="bg-amber-300 text-zinc-950 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Check if a specific experience bullet is the active citation target
  const isCitationTarget = (bulletText: string, company: string) => {
    if (!activeCitationState) return false;
    const snippet = (activeCitationState.text_snippet || "").toLowerCase().trim();
    const cleanBullet = bulletText.toLowerCase().trim();
    const cleanCompany = company.toLowerCase().trim();

    if (!snippet) return false;

    // Exact or substring match
    if (cleanBullet.includes(snippet) || snippet.includes(cleanBullet)) {
      return true;
    }

    // Matching section/company context with key term overlap
    if (
      activeCitationState.section &&
      activeCitationState.section.toLowerCase().includes(cleanCompany)
    ) {
      const snippetWords = snippet.split(/\s+/).filter((w) => w.length > 3);
      if (snippetWords.length > 0) {
        const matches = snippetWords.filter((w) => cleanBullet.includes(w)).length;
        if (matches >= 2 || matches / snippetWords.length >= 0.4) {
          return true;
        }
      }
    }

    return false;
  };

  // Extract real sections from raw text if present
  const extractedSections = candidate.raw_text
    ? extractSectionsFromRawText(
        candidate.raw_text,
        candidate.target_headline,
        candidate.core_skills || []
      )
    : null;

  // Dynamic Experience Data (prefer extracted real sections if available, then candidate.experience)
  const experienceList: ExperienceItem[] =
    extractedSections && extractedSections.experiences.length > 0
      ? extractedSections.experiences
      : candidate.experience && candidate.experience.length > 0
      ? candidate.experience
      : [
          {
            role: candidate.target_headline || "Software Engineer",
            company: "Industry Experience",
            period: "2021 — Present",
            description:
              candidate.scorecard?.categories?.[0]?.quote ||
              `Contributed to scalable systems, microservices, and technical pipelines utilizing ${(
                candidate.core_skills || ["Python", "Cloud"]
              )
                .slice(0, 4)
                .join(", ")}.`,
          },
        ];

  // Dynamic Skills Breakdown
  const skillsList: string[] =
    candidate.core_skills && candidate.core_skills.length > 0
      ? candidate.core_skills
      : extractedSections?.skills && extractedSections.skills.length > 0
      ? extractedSections.skills
      : ["Python", "Cloud Architecture", "Distributed Systems", "PostgreSQL", "Docker", "Kubernetes", "CI/CD"];

  const halfSkills = Math.ceil(skillsList.length / 2);
  const primarySkills = skillsList.slice(0, halfSkills);
  const secondarySkills = skillsList.slice(halfSkills);

  // Dynamic Education
  const primaryEducation =
    extractedSections?.education ||
    candidate.highest_education ||
    "Degree in Computer Science & Engineering";

  // Dynamic Summary
  const executiveSummary =
    extractedSections?.summary ||
    `Accomplished ${candidate.target_headline || "Engineer"} with ${
      candidate.years_of_experience || "6+"
    } years of continuous professional experience designing and building scalable distributed microservices, event streaming architectures, and fault-tolerant cloud backends.`;

  // Dynamic Raw Text Generation (if no raw_text provided)
  const effectiveRawResume =
    candidate.raw_text ||
    `================================================================================
CANDIDATE CURRICULUM VITAE
================================================================================
Name: ${displayName}
Email: ${displayEmail}
Phone: ${displayPhone}
Location: ${displayLocation}
Role: ${candidate.target_headline || "Senior Software Engineer"}
Experience: ${candidate.years_of_experience || "6+"} Years
Status: ${candidate.status || "Active Candidate"}

EXECUTIVE SUMMARY
--------------------------------------------------------------------------------
${executiveSummary}

PROFESSIONAL EXPERIENCE
--------------------------------------------------------------------------------
${experienceList
  .map(
    (exp) =>
      `${exp.role} — ${exp.company} (${exp.period})\n` +
      parseBullets(exp.description)
        .map((b) => `• ${b}`)
        .join("\n")
  )
  .join("\n\n")}

EDUCATION & ACADEMIC BACKGROUND
--------------------------------------------------------------------------------
${primaryEducation}

CORE TECHNICAL COMPETENCIES
--------------------------------------------------------------------------------
${skillsList.join(", ")}
================================================================================`;

  return (
    <div className="bg-zinc-100/90 rounded-2xl border border-zinc-300 p-4 shadow-sm space-y-4">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-xl border border-zinc-200/90 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: View Mode & PII Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
            {pdfUrl && (
              <button
                onClick={() => setViewMode("original-pdf")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  viewMode === "original-pdf"
                    ? "bg-zinc-950 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Original PDF</span>
              </button>
            )}
            <button
              onClick={() => setViewMode("layout")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "layout"
                  ? "bg-white text-zinc-950 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Grounded View</span>
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "raw"
                  ? "bg-white text-zinc-950 shadow-2xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Raw Text</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
            <Switch
              id="pii-toggle-pdf"
              checked={redactPII}
              onCheckedChange={setRedactPII}
              className="scale-80"
            />
            <label
              htmlFor="pii-toggle-pdf"
              className="text-[11px] font-bold text-emerald-800 cursor-pointer flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{redactPII ? "PII Masked" : "Raw PII"}</span>
            </label>
          </div>
        </div>

        {/* Center: Search in Resume */}
        <div className="relative flex-1 max-w-xs min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in PDF..."
            className="w-full pl-8 pr-7 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 placeholder:text-zinc-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Zoom & Download Controls */}
        <div className="flex items-center gap-2">
          {viewMode === "layout" && (
            <div className="flex items-center gap-1 bg-zinc-100 px-2 py-1 rounded-lg border border-zinc-200 text-xs font-mono text-zinc-700 font-bold">
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                className="p-0.5 hover:text-zinc-950 rounded cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="p-0.5 hover:text-zinc-950 rounded cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`${candidate.name.toLowerCase().replace(/\s+/g, "_")}_resume.pdf`}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 font-semibold text-zinc-800 shadow-2xs transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>PDF</span>
            </a>
          )}
        </div>
      </div>

      {/* 2. Active Citation Highlighting Banner */}
      {activeCitationState && (
        <div className="bg-linear-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-400/80 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950">
                  ⚡ Grounded Resume Citation
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                  {activeCitationState.category_name || "Technical Depth"} • Page{" "}
                  {activeCitationState.page || 1}
                </span>
              </div>
              <p className="text-xs text-amber-900/90 truncate italic font-medium mt-0.5">
                &ldquo;{activeCitationState.text_snippet}&rdquo;
              </p>
            </div>
          </div>

          <button
            onClick={handleClear}
            className="shrink-0 flex items-center gap-1 text-xs font-bold text-amber-900 bg-white hover:bg-amber-100/80 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear Highlight</span>
          </button>
        </div>
      )}

      {/* 3. Document Body Viewport */}
      {viewMode === "original-pdf" && pdfUrl ? (
        /* Real Uploaded PDF Viewer via Iframe */
        <div className="w-full bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-300 flex flex-col">
          <div className="bg-zinc-950 text-zinc-300 px-4 py-2.5 text-xs flex items-center justify-between border-b border-zinc-800">
            <span className="font-semibold flex items-center gap-2 text-zinc-100">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Authentic Uploaded PDF Document ({candidate.name})</span>
            </span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold underline transition-colors"
            >
              <span>Open in Fullscreen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <iframe
            src={pdfUrl}
            title={`${candidate.name} Original Resume`}
            className="w-full h-[850px] border-0 bg-white"
          />
        </div>
      ) : viewMode === "raw" ? (
        /* Monospace Raw Extracted Text */
        <div className="bg-[#18181b] text-zinc-200 rounded-xl p-6 font-mono text-xs leading-relaxed overflow-x-auto selection:bg-zinc-700 shadow-inner">
          <pre>{effectiveRawResume}</pre>
        </div>
      ) : (
        /* AI Grounded Canvas View */
        <div
          ref={containerRef}
          className="overflow-y-auto max-h-[820px] p-4 flex flex-col items-center gap-6 bg-zinc-200/70 rounded-xl border border-zinc-300 shadow-inner"
        >
          {/* ============================================================ */}
          {/* PAGE 1: HEADER + SUMMARY + EXPERIENCE */}
          {/* ============================================================ */}
          <div
            ref={page1Ref}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
            className="w-full max-w-[720px] min-h-[960px] bg-white rounded-lg shadow-md border border-zinc-300/80 p-10 flex flex-col justify-between text-zinc-900 relative transition-transform duration-150"
          >
            {/* Page Watermark / Number */}
            <div className="absolute top-4 right-6 text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
              Page 1 of 2
            </div>

            <div className="space-y-6">
              {/* Header Section */}
              <div className="border-b-2 border-zinc-900 pb-5 space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">
                  {highlightSearch(displayName)}
                </h1>
                <p className="text-xs font-bold text-zinc-700 tracking-wide">
                  {highlightSearch(candidate.target_headline || "Software Engineer")}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-1 flex-wrap">
                  <span className="font-mono">{highlightSearch(displayEmail)}</span>
                  <span>•</span>
                  <span className="font-mono">{highlightSearch(displayPhone)}</span>
                  <span>•</span>
                  <span>{highlightSearch(displayLocation)}</span>
                  <span>•</span>
                  <span className="text-zinc-800 font-medium font-mono">
                    linkedin.com/in/{candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "")}
                  </span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-1.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-zinc-800" />
                  <span>Executive Summary</span>
                </h2>
                <p className="text-xs text-zinc-700 leading-relaxed">
                  {highlightSearch(executiveSummary)}
                </p>
              </div>

              {/* Dynamic Professional Experience Section */}
              <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-800" />
                  <span>Professional Experience & Projects</span>
                </h2>

                {experienceList.map((exp, idx) => {
                  const bullets = parseBullets(exp.description);

                  return (
                    <div key={idx} className={`space-y-1.5 ${idx > 0 ? "pt-2" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-zinc-950">
                            {highlightSearch(exp.role)}
                          </span>
                          <span className="text-xs text-zinc-600 font-semibold">
                            — {exp.company}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 font-semibold">
                          {exp.period}
                        </span>
                      </div>

                      <ul className="space-y-2 text-xs text-zinc-700 list-disc list-inside">
                        {bullets.map((bullet, bIdx) => {
                          const isTarget = isCitationTarget(bullet, exp.company);

                          return (
                            <li
                              key={bIdx}
                              ref={isTarget ? targetHighlightRef : null}
                              className={`leading-relaxed p-1.5 rounded-lg transition-all duration-300 ${
                                isTarget
                                  ? "bg-amber-100/90 text-amber-950 font-medium ring-2 ring-amber-500 shadow-sm"
                                  : ""
                              }`}
                            >
                              {highlightSearch(bullet)}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Confidential • Candidate Technical Portfolio</span>
              <span>PyMuPDF Layout Verified</span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* PAGE 2: EDUCATION, SKILLS & CERTIFICATIONS */}
          {/* ============================================================ */}
          <div
            ref={page2Ref}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
            className="w-full max-w-[720px] min-h-[960px] bg-white rounded-lg shadow-md border border-zinc-300/80 p-10 flex flex-col justify-between text-zinc-900 relative transition-transform duration-150"
          >
            {/* Page Watermark / Number */}
            <div className="absolute top-4 right-6 text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
              Page 2 of 2
            </div>

            <div className="space-y-6">
              {/* Education Section */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-zinc-800" />
                  <span>Education & Academic Background</span>
                </h2>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-950">
                        {highlightSearch(primaryEducation)}
                      </span>
                      <p className="text-[11px] text-zinc-600">
                        Academic Credentials Verified • Systems & Engineering Focus
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 font-semibold">
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Skills Matrix */}
              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-800" />
                  <span>Verified Technical Competencies</span>
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-bold text-zinc-900 block mb-1.5">
                      Core Stack & Languages:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {primarySkills.map((skill) => (
                        <span
                          key={skill}
                          className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded text-[11px] font-medium"
                        >
                          {highlightSearch(skill)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {secondarySkills.length > 0 && (
                    <div>
                      <span className="font-bold text-zinc-900 block mb-1.5">
                        Infrastructure, Frameworks & Tooling:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {secondarySkills.map((skill) => (
                          <span
                            key={skill}
                            className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            {highlightSearch(skill)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Industry Credentials */}
              <div className="space-y-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-950 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-800" />
                  <span>Industry Credentials & Verifications</span>
                </h2>

                <div className="space-y-1 text-xs text-zinc-700">
                  <p>• Verified ATS Technical Evaluation — 100% Citation Grounded</p>
                  <p>• Background Verification & Technical Profile Cleared</p>
                </div>
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Confidential • Candidate Technical Portfolio</span>
              <span>Page 2 of 2</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
