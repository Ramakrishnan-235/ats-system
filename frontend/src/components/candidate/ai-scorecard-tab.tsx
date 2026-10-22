"use client";

import React, { useRef, useState } from "react";
import {
  Sparkles,
  MoreVertical,
  ArrowUpRight,
  Code2,
  Workflow,
  Users2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CandidateDetail, CitationLocation } from "@/types/ats";
import { locateCandidateCitation, getErrorMessage } from "@/lib/api";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Technical Depth": Code2,
  "System Design": Workflow,
  Leadership: Users2,
};

interface AIScorecardTabProps {
  candidate: CandidateDetail;
  onSelectCitation?: (citation: CitationLocation) => void;
}

export function AIScorecardTab({ candidate, onSelectCitation }: AIScorecardTabProps) {
  const { scorecard } = candidate;
  const [error, setError] = useState<string | null>(null);
  const scopeVersion = useRef(0);

  const handleCitationClick = async (cat: typeof scorecard.categories[0]) => {
    if (!onSelectCitation || !cat.quote) return;
    const version = scopeVersion.current;
    try {
      const result = cat.citation_location
        ? { found: true, location: cat.citation_location }
        : await locateCandidateCitation(candidate.id, cat.quote);
      if (version !== scopeVersion.current) return;
      if (!result.found || !result.location) {
        setError("This quote could not be located in the original resume.");
        return;
      }
      setError(null);
      onSelectCitation({ ...result.location, category_name: cat.name });
    } catch (reason) {
      if (version === scopeVersion.current) setError(getErrorMessage(reason));
    }
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {/* 1. Top Match Gauge Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Circular Score Gauge */}
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-zinc-100"
                strokeWidth="9"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-black"
                strokeWidth="9"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={
                  2 * Math.PI * 40 -
                  ((scorecard.overall_match_score ?? 0) / 100) * (2 * Math.PI * 40)
                }
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute font-bold text-2xl text-zinc-950">
              {scorecard.overall_match_score ?? "—"}
            </span>
          </div>

          {/* Title & Telemetry */}
          <div>
            <h3 className="text-lg font-bold text-zinc-950">
              {scorecard.overall_match_score === null
                ? `Evaluation ${scorecard.evaluation_status || "pending"}`
                : scorecard.match_tier}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-zinc-600" />
                {scorecard.model_version}
              </span>
              <span>•</span>
              <span>{scorecard.evaluated_at}</span>
            </div>
          </div>
        </div>

        <button
          title="More options"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Category Dimension Breakdown Cards */}
      <div className="space-y-4">
        {scorecard.categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.name] || Code2;
          const scorePercent = cat.max_score > 0 ? (cat.score / cat.max_score) * 100 : 0;

          return (
            <div
              key={cat.name}
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-3 hover:border-zinc-300 transition-colors"
            >
              {/* Category Header with Score & Progress Bar */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                  <Icon className="w-4 h-4 text-zinc-600" />
                  <span>{cat.name}</span>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-xs justify-end">
                  <div className="w-40">
                    <Progress value={scorePercent} className="h-1.5 bg-zinc-100" />
                  </div>
                  <span className="text-xs font-bold text-zinc-950 shrink-0 font-mono">
                    {cat.score}
                  </span>
                </div>
              </div>

              {/* Verbatim quote or description with interactive highlighting */}
              {cat.assessment && (
                <p className="text-sm text-zinc-700 leading-relaxed">{cat.assessment}</p>
              )}
              {cat.quote && (
                <div className="bg-zinc-50/80 rounded-xl p-3.5 border border-zinc-200/80 space-y-2.5">
                  <p className="text-xs text-zinc-700 italic leading-relaxed font-normal">
                    &ldquo;{cat.quote}&rdquo;
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60">
                    <button
                      onClick={() => handleCitationClick(cat)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-950 bg-amber-100/90 hover:bg-amber-200/90 border border-amber-300 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer group"
                    >
                      <Sparkles className="w-3 h-3 text-amber-700 group-hover:scale-110 transition-transform" />
                      <span>Locate in Resume</span>
                      <ArrowUpRight className="w-3 h-3 text-amber-800" />
                    </button>

                    <span className="text-[10px] text-zinc-400 font-mono">
                      Verify source location
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
