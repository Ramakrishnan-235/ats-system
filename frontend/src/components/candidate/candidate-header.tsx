"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CandidateDetail } from "@/types/ats";

interface CandidateHeaderProps {
  candidate: CandidateDetail;
  onStageChange?: (newStage: string) => void;
}

export function CandidateHeader({
  candidate,
  onStageChange,
}: CandidateHeaderProps) {
  const [currentStage, setCurrentStage] = useState(candidate.stage || "Contacted");

  React.useEffect(() => {
    if (candidate.stage) setCurrentStage(candidate.stage);
  }, [candidate.stage]);

  const handleAdvance = () => {
    const nextStage = currentStage === "Interviewing" ? "Negotiation" : "Offered";
    setCurrentStage(nextStage);
    if (onStageChange) onStageChange(nextStage);
  };

  const handleReject = () => {
    setCurrentStage("Rejected");
    if (onStageChange) onStageChange("Rejected");
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80">
      {/* Left: Breadcrumbs + Title + Metadata */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2">
          <Link
            href={candidate.applied_for_job_id ? `/jobs/${candidate.applied_for_job_id}` : "/jobs"}
            className="flex items-center gap-1 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Jobs</span>
          </Link>
          <span>›</span>
          <Link
            href={candidate.applied_for_job_id ? `/jobs/${candidate.applied_for_job_id}` : "/jobs"}
            className="text-zinc-700 hover:text-zinc-950 font-semibold truncate max-w-sm"
          >
            {candidate.applied_for_job}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">
            {candidate.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-800 text-xs font-semibold px-3 py-1 rounded-full border border-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
            {currentStage}
          </span>
        </div>

        <p className="text-xs text-zinc-500 font-medium mt-1">
          {candidate.role} • Applied {candidate.applied_date}
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="pillOutline"
          size="sm"
          onClick={handleReject}
          className="text-xs px-4 border-zinc-300 hover:bg-zinc-100"
        >
          Reject
        </Button>
        <Button
          variant="pill"
          size="sm"
          onClick={handleAdvance}
          className="text-xs px-5 gap-1.5 shadow-sm"
        >
          <span>Advance Stage</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
