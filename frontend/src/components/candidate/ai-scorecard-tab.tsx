"use client";

import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  MessageSquareCode,
  MoreVertical,
  ArrowUpRight,
  Send,
  Bold,
  Paperclip,
  Code2,
  Workflow,
  Users2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CandidateDetail, TeamNote, CitationLocation } from "@/types/ats";
import { addCandidateNote } from "@/lib/api";

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
  const [notes, setNotes] = useState<TeamNote[]>(scorecard.team_notes || []);
  const [newNoteText, setNewNoteText] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsSubmittingNote(true);
    try {
      const added = await addCandidateNote(candidate.id, newNoteText);
      setNotes([...notes, added]);
      setNewNoteText("");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleCitationClick = (cat: typeof scorecard.categories[0]) => {
    if (!onSelectCitation) return;
    const loc: CitationLocation = cat.citation_location || {
      page: 1,
      section: `Professional Experience`,
      text_snippet: cat.quote || "",
      category_name: cat.name,
      bbox: { x: 8, y: 32, width: 84, height: 6 },
    };
    onSelectCitation(loc);
  };

  return (
    <div className="space-y-6">
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
                  (scorecard.overall_match_score / 100) * (2 * Math.PI * 40)
                }
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute font-bold text-2xl text-zinc-950">
              {scorecard.overall_match_score}
            </span>
          </div>

          {/* Title & Telemetry */}
          <div>
            <h3 className="text-lg font-bold text-zinc-950">
              {scorecard.match_tier}
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
          const scorePercent = (cat.score / cat.max_score) * 100;

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
                      <span>Locate in Resume • {cat.source_ref || "Page 1"}</span>
                      <ArrowUpRight className="w-3 h-3 text-amber-800" />
                    </button>

                    <span className="text-[10px] text-zinc-400 font-mono">
                      Grounded via PyMuPDF
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Risk Flags & Suggested Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Flags */}
        <div className="bg-[#fff7f7] rounded-2xl border border-red-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-red-600 uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>RISK FLAGS</span>
          </div>
          <div className="space-y-2">
            {scorecard.risk_flags.map((risk, i) => (
              <p
                key={i}
                className="text-xs text-zinc-800 leading-relaxed font-normal"
              >
                • {risk}
              </p>
            ))}
          </div>
        </div>

        {/* Suggested Improvements / Areas for Improvement */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-zinc-800 uppercase">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>AREAS FOR IMPROVEMENT</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/60">
              Role & Resume Gap
            </span>
          </div>
          <div className="space-y-2.5">
            {((scorecard.suggested_improvements && scorecard.suggested_improvements.length > 0)
              ? scorecard.suggested_improvements
              : scorecard.suggested_questions
            ).map((item, i) => (
              <div
                key={i}
                className="text-xs text-zinc-700 leading-relaxed font-normal flex items-start gap-2 p-2 bg-zinc-50/60 rounded-lg border border-zinc-100"
              >
                <span className="font-semibold text-zinc-900 shrink-0 select-none">
                  {item.match(/^\d+\./) ? "" : `${i + 1}.`}
                </span>
                <span className="flex-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Team Notes Section */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
        <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
          TEAM NOTES
        </span>

        {/* Existing Comments */}
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs shrink-0">
                {note.initials}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-xs text-zinc-950">
                    {note.author}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    {note.timestamp}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed">
                  {note.content.split("@Sarah").map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="bg-zinc-100 font-semibold px-1 py-0.5 rounded text-zinc-950">
                          @Sarah
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Rich Note Input Form */}
        <form onSubmit={handleSendNote} className="space-y-2 pt-2">
          <div className="border border-zinc-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-zinc-950">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Add a note or @mention someone..."
              rows={2}
              className="w-full p-3 text-xs text-zinc-900 focus:outline-none resize-none leading-relaxed placeholder:text-zinc-400"
            />
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50/60 border-t border-zinc-100">
              <div className="flex items-center gap-2 text-zinc-400">
                <button
                  type="button"
                  className="hover:text-zinc-800 p-1 rounded transition-colors"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="hover:text-zinc-800 p-1 rounded transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!newNoteText.trim() || isSubmittingNote}
                className="h-7 px-3 text-xs font-semibold rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white hover:text-zinc-300 transition-colors"
              >
                <Send className="w-3 h-3 mr-1" />
                <span>Post Note</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
