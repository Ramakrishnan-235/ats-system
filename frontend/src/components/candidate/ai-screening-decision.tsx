"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { evaluateCandidateForJob, fetchCandidateScorecard, getErrorMessage } from "@/lib/api";
import type { CandidateDetail } from "@/types/ats";

const DECISIONS = {
  ACCEPT: { label: "Accept for screening", style: "bg-emerald-50 text-emerald-800 border-emerald-200", why: "Why the LLM recommends acceptance" },
  REJECT: { label: "Reject for this job", style: "bg-rose-50 text-rose-800 border-rose-200", why: "Why the LLM recommends rejection" },
  REVIEW: { label: "Needs review", style: "bg-amber-50 text-amber-900 border-amber-200", why: "Why the LLM requests review" },
};

const KEY_POINT_PATTERNS = [
  /\b(?:no|zero)\s+(?:[\w/+.#-]+\s+){0,9}(?:experience|evidence|expertise|skills?|knowledge|background|ownership)\b/gi,
  /\b(?:has|have|had)\s+never\s+(?:built|used|worked)\b/gi,
  /\b(?:none of which(?:\s+(?:is|are|was|were))?|(?:is|are)\s+not|not)\s+(?:demonstrated|evidenced|met|verified|supported|shown)\b/gi,
  /\b(?:does|do|did)\s+not\s+(?:demonstrate|meet|show|have)\b/gi,
  /\b(?:missing|insufficient|unverified|unrelated)\b/gi,
  /\b(?:job|role|position)\s+requires?\s+[^.!?;\n]{1,100}?(?=\s+with\b|[.!?;\n]|$)/gi,
  /\b(?:meets?|meeting|matches?|matching|satisfies|satisfying)\s+(?:all\s+)?(?:the\s+)?(?:required\s+skills|core\s+requirements|essential\s+requirements|requirements)\b/gi,
  /\b(?:(?:direct|production|technical|backend)\s+ownership|(?:exceeds?|exceeding)\s+(?:the\s+)?(?:\d+(?:\.\d+)?[ -]year\s+)?minimum|(?:proven|demonstrated)\s+(?:experience|expertise))\b/gi,
  /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)(?:\s*[-–]\s*|\s*)(?:years?|months?|milliseconds?|ms|seconds?|percent|%)(?![\w])/gi,
];

function highlightKeyPoints(text: string, skills: string[]) {
  const ranges: { start: number; end: number }[] = [];
  for (const pattern of KEY_POINT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  for (const skill of skills) {
    if (!skill.trim()) continue;
    const escaped = skill.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\w])(${escaped})(?![\\w+#])`, "gi");
    for (const match of text.matchAll(pattern)) {
      const start = match.index + match[1].length;
      ranges.push({ start, end: start + match[2].length });
    }
  }
  // Merge overlapping phrases so emphasis never duplicates or changes model text.
  const merged: typeof ranges = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  let cursor = 0;
  const parts = merged.map(({ start, end }) => {
    const before = text.slice(cursor, start);
    cursor = end;
    return <span key={start}>{before}<mark className="rounded bg-amber-100 px-0.5 font-semibold text-zinc-900 box-decoration-clone">{text.slice(start, end)}</mark></span>;
  });
  return <>{parts}{text.slice(cursor)}</>;
}

interface Props {
  candidate: CandidateDetail;
  onScorecardUpdated: (scorecard: CandidateDetail["scorecard"]) => void;
}

export function AIScreeningDecision({ candidate, onScorecardUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const card = candidate.scorecard;
  const decision = card.screening_decision;
  const recommendation = card.evaluation_status === "COMPLETED"
    && decision && Object.hasOwn(DECISIONS, decision) && card.decision_explanation?.trim()
    ? DECISIONS[decision] : null;
  const hasJob = Boolean(candidate.applied_for_job_id);
  const terminal = ["Rejected", "Withdrawn"].includes(candidate.stage);
  const processing = ["PENDING", "PROCESSING"].includes(card.evaluation_status || "");
  const canGenerate = hasJob && !terminal && candidate.processing_status === "COMPLETED";

  const generate = async () => {
    if (!canGenerate || busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      await evaluateCandidateForJob(candidate.applied_for_job_id!, candidate.id, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const saved = await fetchCandidateScorecard(candidate.id, candidate.applied_for_job_id!);
      if (!controller.signal.aborted) onScorecardUpdated(saved);
    } catch (reason) {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  let emptyMessage = "This saved evaluation has no LLM decision explanation. Generate a new AI decision to get job-specific reasons.";
  if (!hasJob) emptyMessage = "Assign this candidate to a job to get an LLM screening decision and explanation.";
  else if (card.evaluation_status === "FAILED") emptyMessage = "The LLM evaluation failed. No AI decision was made. You can retry when the resume is ready.";
  else if (processing) emptyMessage = "The AI decision is not available yet. Generate or check the evaluation for this job.";
  else if (terminal) emptyMessage = "No LLM explanation was saved for this application. Its recorded pipeline stage does not establish an AI decision or reason.";

  return (
    <section aria-label="AI screening decision" className="bg-white rounded-2xl border border-zinc-200/80 p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" /> AI screening decision
          </h2>
          <p className="text-xs text-zinc-500">For {candidate.applied_for_job || "the selected job"}</p>
        </div>
        {recommendation && <span className={`text-xs font-semibold rounded-full border px-3 py-1 ${recommendation.style}`}>{recommendation.label}</span>}
      </div>
      {recommendation ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">{recommendation.why}</h3>
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line break-words">{highlightKeyPoints(card.decision_explanation!, candidate.core_skills || [])}</p>
          <p className="text-xs text-zinc-500 break-words">Generated by {card.model_version || "the configured LLM"}{card.evaluated_at ? ` · ${card.evaluated_at}` : ""}</p>
        </div>
      ) : <p className="text-sm text-zinc-600 leading-relaxed">{emptyMessage}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <p className="text-xs text-zinc-500">LLM screening recommendation. The recruiter records the final hiring decision separately.</p>
        {canGenerate && (
          <button type="button" disabled={busy} onClick={generate}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60 disabled:cursor-wait">
            {busy ? "Evaluating with LLM…" : recommendation ? "Re-evaluate with LLM" : processing ? "Generate / check AI decision" : "Generate AI decision"}
          </button>
        )}
      </div>
      {busy && <p role="status" className="text-xs text-violet-700">The LLM is evaluating the resume against this job. This can take a few minutes.{recommendation ? " The previous decision is shown above until the new result is saved." : ""}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
