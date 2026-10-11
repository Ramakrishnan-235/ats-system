"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  Calendar,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  X,
  ArrowRight
} from "lucide-react";

interface CandidateReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName?: string;
  roleTitle?: string;
  reqCode?: string;
}

export function CandidateReviewModal({
  open,
  onOpenChange,
  candidateName = "Marcus Vance",
  roleTitle = "Senior Backend Engineer",
  reqCode = "Req-204",
}: CandidateReviewModalProps) {
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setActionTaken(action);
    setTimeout(() => {
      setActionTaken(null);
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border border-[#dee2ef] rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#131c29] text-white p-6 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#6137e0]/30 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[#dbe1ff] text-[11px] font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#6137e0]" />
                Human-in-the-Loop Sign-off Required
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Review Application: {candidateName}
              </h2>
              <p className="text-xs text-[#bec7d9] mt-0.5">
                {roleTitle} · <span className="font-mono text-white">{reqCode}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[#dbe1ff]">94/100</div>
              <div className="text-[10px] text-[#bec7d9]">Rubric Match Score</div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {actionTaken && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{actionTaken} recorded successfully! Advancing workflow...</span>
            </div>
          )}

          {/* Sourcing Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#f0f3ff] border border-[#dee2ef]/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] block mb-1">
                Source Channel
              </span>
              <span className="text-xs font-semibold text-[#171c25] flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#171c25]" />
                GitHub & Referral
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#f0f3ff] border border-[#dee2ef]/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] block mb-1">
                Experience
              </span>
              <span className="text-xs font-semibold text-[#171c25]">
                11+ Years Distributed
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#f0f3ff] border border-[#dee2ef]/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] block mb-1">
                Target Level
              </span>
              <span className="text-xs font-semibold text-[#6137e0]">
                IC5 (Senior / Staff)
              </span>
            </div>
          </div>

          {/* Rubric Competency Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#75777c] mb-2.5">
              Competency Rubric Evidence
            </h3>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-white border border-[#dee2ef] shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#171c25]">Go & High-Concurrency Systems</span>
                  <span className="font-bold text-[#6137e0]">100% Match</span>
                </div>
                <div className="w-full h-1.5 bg-[#eaeefb] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "100%" }}></div>
                </div>
                <p className="text-[11px] text-[#45474c] mt-2 italic">
                  &ldquo;11 years designing low-latency Go microservices, lock-free queues, and Raft consensus storage engine.&rdquo;
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-[#dee2ef] shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#171c25]">Kubernetes & Cloud Infrastructure</span>
                  <span className="font-bold text-[#6137e0]">96% Match</span>
                </div>
                <div className="w-full h-1.5 bg-[#eaeefb] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "96%" }}></div>
                </div>
                <p className="text-[11px] text-[#45474c] mt-2 italic">
                  &ldquo;Maintained production Kubernetes clusters across AWS and bare metal; authored custom operators for auto-failover.&rdquo;
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white border border-[#dee2ef] shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#171c25]">Distributed Systems Architecture</span>
                  <span className="font-bold text-[#497cff]">92% Match</span>
                </div>
                <div className="w-full h-1.5 bg-[#eaeefb] rounded-full overflow-hidden">
                  <div className="h-full bg-[#497cff] rounded-full" style={{ width: "92%" }}></div>
                </div>
                <p className="text-[11px] text-[#45474c] mt-2 italic">
                  &ldquo;Demonstrated deep expertise in partitioning, data consistency models, Kafka event streams, and gRPC contracts.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* AI Reasoning Note */}
          <div className="p-3.5 rounded-xl bg-[#e7deff]/40 border border-[#cbbeff] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#6137e0] shrink-0 mt-0.5" />
            <div className="text-xs text-[#1e0060]">
              <span className="font-bold">Evaluation Governance Note: </span>
              Candidate surpasses technical threshold for Req-204 with exceptional hands-on systems experience. Verified against taxonomy rubrics with 0 PII compliance flags.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#f9f9ff] border-t border-[#dee2ef] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#75777c] hover:text-[#171c25] hover:bg-[#eaeefb] transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAction("Request Secondary Review")}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#dee2ef] text-[#171c25] hover:bg-[#f0f3ff] transition-colors"
            >
              Request Secondary Review
            </button>
            <button
              type="button"
              onClick={() => handleAction("Candidate Advanced to Recruiter Screen")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#6137e0] text-white hover:bg-[#7a55fa] transition-colors shadow-sm flex items-center gap-1.5"
            >
              Advance to Recruiter Screen
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
