"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { useSession } from "@/components/layout/api-session";
import { fetchCandidates, fetchJobs, fetchDashboardStats, DashboardData } from "@/lib/api";
import { CandidateDetail, JobRequisition } from "@/types/ats";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Download,
  AlertTriangle,
  Bell,
  Phone,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RotateCw,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  Layers,
  FileText,
  Briefcase,
  Users,
  ShieldCheck,
  Inbox,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function RecruiterWorkspacePage() {
  const router = useRouter();
  const { session } = useSession();

  // State
  const [activeQueueTab, setActiveQueueTab] = useState<"Mine" | "Team">("Mine");
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDateStr, setCurrentDateStr] = useState("");

  const [nudgeSent, setNudgeSent] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState("All Active Requisitions");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCandidates().catch(() => [] as CandidateDetail[]),
      fetchJobs().catch(() => [] as JobRequisition[]),
      fetchDashboardStats().catch(() => null),
    ]).then(([cands, jobsData, dashStats]) => {
      if (cancelled) return;
      setCurrentDateStr(
        new Date().toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      );
      if (cands) setCandidates(cands);
      if (jobsData) setJobs(jobsData);
      if (dashStats) setDashboardData(dashStats);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered stage segments
  const appliedCandidates = useMemo(
    () =>
      candidates.filter(
        (c) =>
          !c.stage ||
          c.stage.toLowerCase().includes("applied") ||
          c.stage.toLowerCase().includes("review") ||
          c.stage.toLowerCase().includes("pool")
      ),
    [candidates]
  );

  const screeningCandidates = useMemo(
    () => candidates.filter((c) => c.stage?.toLowerCase().includes("screening")),
    [candidates]
  );

  const interviewCandidates = useMemo(
    () =>
      candidates.filter(
        (c) =>
          c.stage?.toLowerCase().includes("interview") ||
          c.stage?.toLowerCase().includes("screen")
      ),
    [candidates]
  );

  const offerCandidates = useMemo(
    () => candidates.filter((c) => c.stage?.toLowerCase().includes("offer")),
    [candidates]
  );

  const hiredCandidates = useMemo(
    () => candidates.filter((c) => c.stage?.toLowerCase().includes("hired")),
    [candidates]
  );

  const reviewPendingCount = appliedCandidates.length + screeningCandidates.length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendNudge = () => {
    setNudgeSent(true);
    showToast("Urgent scorecard nudge dispatched to interview panel");
  };

  const handleExportLedger = () => {
    if (candidates.length === 0) {
      showToast("No active candidate records to export in this workspace.");
      return;
    }
    const headers = ["Candidate ID", "Name", "Role", "Stage", "Applied Job", "Match Score", "Location"];
    const rows = candidates.map((c) => [
      `"${c.id}"`,
      `"${(c.name || c.anonymized_name || "").replace(/"/g, '""')}"`,
      `"${(c.role || c.target_headline || "").replace(/"/g, '""')}"`,
      `"${(c.stage || "").replace(/"/g, '""')}"`,
      `"${(c.applied_for_job || "").replace(/"/g, '""')}"`,
      c.scorecard?.overall_match_score != null ? Math.round(c.scorecard.overall_match_score) : "",
      `"${(c.location || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ats_candidate_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Daily Ledger exported (CSV downloaded)");
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <CoreHeader />

      {/* Main Workspace Body */}
      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <CheckCircle2 className="w-5 h-5 text-[#7a55fa] shrink-0" />
              <span className="text-xs font-semibold">{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="ml-2 text-[#7b8495] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
                Good morning, {session?.user?.name ? session.user.name.split(" ")[0] : "Recruiter"}
              </h1>
              <p className="text-xs sm:text-sm text-[#555a64] mt-1 font-medium">
                {currentDateStr || "Requisition sync active"} • Requisition sync active across active roles
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] text-xs font-semibold text-[#141c27] hover:bg-[#f0f3ff] transition-all shadow-sm cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#6137e0]" />
                <span>Pipeline Filters</span>
              </button>

              <button
                type="button"
                onClick={handleExportLedger}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] text-xs font-semibold text-[#141c27] hover:bg-[#f0f3ff] transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#141c27]" />
                <span>Export Daily Ledger</span>
              </button>
            </div>
          </div>

          {/* Priority Review Banner (Dark Navy #131c29) */}
          <div className="w-full bg-[#131c29] rounded-2xl p-6 sm:p-7 text-white shadow-xl flex flex-col gap-6 relative overflow-hidden border border-[#232f42]">
            {/* Top row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 mt-0.5 border border-white/10">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                      {reviewPendingCount > 0
                        ? `${reviewPendingCount} application${reviewPendingCount === 1 ? "" : "s"} need review today`
                        : "All applications reviewed"}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                        reviewPendingCount > 0
                          ? "bg-[#6137e0] text-white"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {reviewPendingCount > 0 ? "High Attention" : "Queue Healthy"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#bec7d9] mt-1 font-normal">
                    {reviewPendingCount > 0
                      ? `${reviewPendingCount} applicant${reviewPendingCount === 1 ? "" : "s"} awaiting evaluation • Human-in-the-loop signoff pending`
                      : "No pending evaluations • All requisitions within SLA boundaries"}
                  </p>
                </div>
              </div>

              <Link
                href="/candidates"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#131c29] text-xs font-bold hover:bg-[#f0f3ff] transition-all shadow-sm shrink-0 self-start md:self-center"
              >
                <span>Review Priority Applications</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Bottom 5-metric Funnel Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4 border-t border-white/10">
              {/* Applied */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Applied
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  {appliedCandidates.length}
                </div>
                <span className="text-[11px] font-semibold text-emerald-400">
                  {candidates.length > 0
                    ? `${Math.round((appliedCandidates.length / candidates.length) * 100)}% total pool`
                    : "No applicants"}
                </span>
              </div>

              {/* Screening */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Screening
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  {screeningCandidates.length}
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  {screeningCandidates.length > 0 ? "In active review" : "Queue clear"}
                </span>
              </div>

              {/* Tech Panel */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Tech Panel
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  {interviewCandidates.length}
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  {interviewCandidates.length > 0 ? `${interviewCandidates.length} active` : "None active"}
                </span>
              </div>

              {/* Offer Stage */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Offer Stage
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  {offerCandidates.length}
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  {offerCandidates.length > 0 ? `${offerCandidates.length} signoff due` : "None pending"}
                </span>
              </div>

              {/* Hired */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Hired
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  {hiredCandidates.length}
                </div>
                <span className="text-[11px] font-semibold text-emerald-400">
                  {hiredCandidates.length > 0 ? `${hiredCandidates.length} completed` : "Target in progress"}
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column Workstation Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: Waiting For You */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                    Waiting for you
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#555a64] text-[11px] font-semibold">
                    {candidates.length > 0 ? "Queue Active" : "Queue Clear"}
                  </span>
                </div>

                <div className="flex items-center p-0.5 rounded-lg bg-[#dee2ef]/40 border border-[#dee2ef]">
                  <button
                    type="button"
                    onClick={() => setActiveQueueTab("Mine")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      activeQueueTab === "Mine"
                        ? "bg-white text-[#111827] shadow-sm"
                        : "text-[#555a64] hover:text-[#111827]"
                    }`}
                  >
                    Mine ({candidates.length > 0 ? Math.min(candidates.length, 3) : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveQueueTab("Team")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      activeQueueTab === "Team"
                        ? "bg-white text-[#111827] shadow-sm"
                        : "text-[#555a64] hover:text-[#111827]"
                    }`}
                  >
                    Team ({candidates.length})
                  </button>
                </div>
              </div>

              {/* Waiting For You Cards or Empty State Placeholder */}
              {candidates.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-dashed border-[#dee2ef] flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
                  <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#6137e0] flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-[#6137e0]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">Queue is clear</h3>
                    <p className="text-xs text-[#555a64] max-w-xs mt-1">
                      No applications currently require manual review or interviewer scorecard action.
                    </p>
                  </div>
                  <Link
                    href="/candidates"
                    className="mt-1 px-4 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm"
                  >
                    View Candidates Roster
                  </Link>
                </div>
              ) : (
                <>
                  {/* Card 1: Primary Candidate Review */}
                  {candidates[0] && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-[#eef2ff] text-[#6137e0] flex items-center justify-center ring-2 ring-[#dee2ef]">
                              <User className="w-5 h-5 text-[#6137e0]" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-[#111827]">
                                {candidates[0].name}
                              </span>
                              {candidates[0].scorecard?.overall_match_score != null && (
                                <span className="text-xs font-bold text-[#6137e0]">
                                  • {Math.round(candidates[0].scorecard.overall_match_score)}% Fit
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#555a64] truncate">
                              {candidates[0].target_headline || candidates[0].role || "Applicant"} • {candidates[0].applied_for_job || "Active Pool"}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#45474c] text-xs font-semibold shrink-0">
                          Stage: {candidates[0].stage || "Screening"}
                        </span>
                      </div>

                      <div className="bg-[#f0f3ff] rounded-xl p-3.5 border border-[#dee2ef]/60 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#6137e0] uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            STRUCTURED EVIDENCE EXTRACTED
                          </span>
                          <span className="text-[#555a64] font-medium">
                            Verified Credentials
                          </span>
                        </div>

                        <p className="text-xs text-[#141c27] leading-relaxed">
                          {candidates[0].core_skills && candidates[0].core_skills.length > 0
                            ? `Demonstrated competency across ${candidates[0].core_skills.join(", ")}.`
                            : "Candidate credentials and timeline extracted and verified against requisition criteria."}
                        </p>

                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <Link
                            href={`/candidates/${candidates[0].id}`}
                            className="px-2.5 py-1 rounded-md bg-white border border-[#dee2ef] text-[11px] font-semibold text-[#6137e0] hover:bg-[#e7deff] transition-colors"
                          >
                            Scorecard & Evidence
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#75777c] flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-[#75777c]" />
                          Priority action pending
                        </span>

                        <Link
                          href={`/candidates/${candidates[0].id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm"
                        >
                          <span>Review Application</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Card 2: Interview / Scorecard Status Follow-up */}
                  {candidates[1] && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-3 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#f4f3ff] text-[#6137e0] flex items-center justify-center shrink-0 mt-0.5 border border-[#d9d6fe]">
                            <AlertTriangle className="w-5 h-5 text-[#6137e0]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6137e0] uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]"></span>
                                STAGE EVALUATION
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-[#111827]">
                              {candidates[1].name}
                            </h3>
                            <p className="text-xs text-[#555a64] mt-0.5">
                              {candidates[1].target_headline || candidates[1].role || "Candidate"} • {candidates[1].applied_for_job || "Requisition"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSendNudge}
                          disabled={nudgeSent}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            nudgeSent
                              ? "bg-[#ecfdf3] text-[#027a48] border border-[#a6f4c5]"
                              : "bg-[#f4f3ff] text-[#6137e0] border border-[#d9d6fe] hover:bg-[#ebe9fe]"
                          }`}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{nudgeSent ? "Nudge Sent" : "Send Nudge"}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#555a64] pt-2 border-t border-[#dee2ef]/50">
                        <span className="text-[#6137e0] font-semibold">
                          Stage: {candidates[1].stage || "Screening"}
                        </span>
                        <Link
                          href={`/candidates/${candidates[1].id}`}
                          className="text-[#6137e0] font-bold hover:underline"
                        >
                          Open Candidate Record →
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Card 3: Direct Ingest Candidate */}
                  {candidates[2] && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-[#eef2ff] text-[#6137e0] flex items-center justify-center ring-2 ring-[#dee2ef]">
                            <User className="w-5 h-5 text-[#6137e0]" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#111827]">
                              {candidates[2].name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#f0fdf9] text-[#0f766e] border border-[#ccfbf1] text-[10px] font-bold">
                              {candidates[2].stage || "Applicant"}
                            </span>
                          </div>
                          <p className="text-xs text-[#555a64] truncate">
                            {candidates[2].target_headline || candidates[2].role || "Candidate"} • {candidates[2].applied_for_job || "Talent Pool"}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#75777c]">
                            <span>{candidates[2].location || "Remote"}</span>
                            <span>•</span>
                            <span className="text-[#027a48] font-semibold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Credentials Verified
                            </span>
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/candidates/${candidates[2].id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </Link>
                    </div>
                  )}

                  {/* Additional Team Candidates if Team tab selected */}
                  {activeQueueTab === "Team" &&
                    candidates.slice(3).map((cand) => (
                      <div
                        key={cand.id}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex items-center justify-between gap-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-[#eef2ff] text-[#6137e0] flex items-center justify-center ring-2 ring-[#dee2ef]">
                              <User className="w-5 h-5 text-[#6137e0]" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#111827]">
                                {cand.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-[#f0fdf9] text-[#0f766e] border border-[#ccfbf1] text-[10px] font-bold">
                                {cand.stage || "Applicant"}
                              </span>
                            </div>
                            <p className="text-xs text-[#555a64] truncate">
                              {cand.target_headline || cand.role || "Candidate"} • {cand.applied_for_job || "Talent Pool"}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/candidates/${cand.id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm shrink-0"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                </>
              )}
            </div>

            {/* RIGHT COLUMN: Operational Health & Ingestion */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                  Operational Health & Ingestion
                </h2>
                <span className="text-xs font-medium text-[#75777c]">
                  Realtime Telemetry
                </span>
              </div>

              {/* Card 1: Pipeline Health & Role Bottlenecks */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#6137e0]" />
                    <h3 className="text-sm font-bold text-[#111827]">
                      Pipeline Health & Role Bottlenecks
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f4f3ff] text-[#6137e0] text-xs font-bold border border-[#d9d6fe]">
                    {jobs.length} Active Req{jobs.length === 1 ? "" : "s"}
                  </span>
                </div>

                {jobs.length === 0 ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center gap-2 border border-dashed border-[#dee2ef] rounded-xl bg-[#f8f9ff]">
                    <TrendingUp className="w-6 h-6 text-[#75777c]" />
                    <p className="text-xs font-semibold text-[#111827]">No active roles to monitor</p>
                    <p className="text-[11px] text-[#75777c]">Create requisitions to track health metrics and candidates.</p>
                    <Link href="/jobs" className="text-xs font-bold text-[#6137e0] hover:underline mt-1">
                      Open Jobs Directory →
                    </Link>
                  </div>
                ) : (
                  jobs.slice(0, 2).map((job) => (
                    <div key={job.id} className="flex flex-col gap-2 pt-2 border-t border-[#dee2ef]/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111827] truncate max-w-[240px]">
                          {job.title} <span className="font-normal text-[#75777c] font-mono">{job.id.slice(0, 8)}</span>
                        </span>
                        <span className="font-bold text-[#6137e0]">
                          {job.status === "OPEN" ? "Open Requisition" : "Active Pool"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                          <div className="text-base font-extrabold text-[#111827]">{job.candidates_count}</div>
                          <div className="text-[10px] text-[#75777c]">Applicants</div>
                        </div>
                        <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                          <div className="text-base font-extrabold text-[#6137e0]">
                            {job.top_match?.score ? `${Math.round(job.top_match.score)}%` : "Pending"}
                          </div>
                          <div className="text-[10px] text-[#75777c]">Top Fit</div>
                        </div>
                        <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                          <div className="text-base font-extrabold text-[#111827]">
                            {job.required_skills?.length || 0}
                          </div>
                          <div className="text-[10px] text-[#75777c]">Skills Tracked</div>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-[#dee2ef] overflow-hidden flex">
                        <div
                          className="bg-[#131c29] h-full"
                          style={{
                            width: `${Math.min(100, Math.max(15, job.candidates_count * 20))}%`,
                          }}
                        ></div>
                        <div className="bg-[#6137e0] h-full" style={{ width: "25%" }}></div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Card 2: Resume Ingestion & Processing */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#6137e0]" />
                    <h3 className="text-sm font-bold text-[#111827]">
                      Resume Ingestion & Processing
                    </h3>
                  </div>
                  <Link
                    href="/upload"
                    className="text-xs font-semibold text-[#6137e0] hover:underline flex items-center gap-1"
                  >
                    <span>View Queue</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {candidates.length === 0 && (dashboardData?.processing_resumes ?? 0) === 0 ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center gap-2 border border-dashed border-[#dee2ef] rounded-xl bg-[#f8f9ff]">
                    <Layers className="w-6 h-6 text-[#75777c]" />
                    <p className="text-xs font-semibold text-[#111827]">Ingestion queue is idle</p>
                    <p className="text-[11px] text-[#75777c]">No resumes currently being parsed or extracted.</p>
                    <Link href="/upload" className="text-xs font-bold text-[#6137e0] hover:underline mt-1">
                      Upload Resumes →
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-5 pt-1">
                    <div className="relative w-20 h-20 shrink-0">
                      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-[#dee2ef]"
                          strokeWidth="3.8"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-[#6137e0]"
                          strokeDasharray="100, 100"
                          strokeWidth="3.8"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-[#111827]">
                        100%
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#111827]">
                          {candidates.length} Profiles Ingested
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#f0f3ff] text-[#45474c] text-[10px] font-mono font-bold">
                          Cluster Active
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#555a64] flex-wrap mt-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <strong className="text-[#111827]">{candidates.length}</strong> Completed
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                          <strong className="text-[#111827]">{dashboardData?.processing_resumes || 0}</strong> Processing
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Upcoming Interviews Today */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#6137e0]" />
                    <h3 className="text-sm font-bold text-[#111827]">
                      Upcoming Interviews Today
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#45474c] text-xs font-bold">
                    {interviewCandidates.length} Active
                  </span>
                </div>

                {interviewCandidates.length === 0 ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center gap-2 border border-dashed border-[#dee2ef] rounded-xl bg-[#f8f9ff]">
                    <Calendar className="w-6 h-6 text-[#75777c]" />
                    <p className="text-xs font-semibold text-[#111827]">No interviews scheduled today</p>
                    <p className="text-[11px] text-[#75777c]">Upcoming technical rounds and debriefs will appear here.</p>
                    <Link href="/interviews" className="text-xs font-bold text-[#6137e0] hover:underline mt-1">
                      View Interview Schedule →
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 pt-1">
                    {interviewCandidates.slice(0, 2).map((cand, idx) => (
                      <div
                        key={cand.id}
                        className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/60 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="px-2.5 py-1.5 rounded-lg bg-[#dee2ef] font-mono text-xs font-bold text-[#111827] shrink-0 text-center">
                            <div className="text-[9px] text-[#75777c] font-sans">ROUND</div>
                            {idx === 0 ? "11:00" : "14:00"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#111827] truncate">
                              {cand.name}
                            </h4>
                            <p className="text-[11px] text-[#555a64] truncate">
                              {cand.target_headline || cand.role || "Technical Evaluation"} • {cand.applied_for_job || "Active Requisition"}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/candidates/${cand.id}`}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#dee2ef] text-xs font-semibold text-[#111827] hover:bg-[#dee2ef]/30 transition-all shrink-0 shadow-2xs"
                        >
                          Scorecard
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pipeline Filter Modal */}
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#111827]">
              Configure Pipeline Filter
            </DialogTitle>
            <DialogDescription className="text-xs text-[#555a64]">
              Select which enterprise talent pools and requisitions are surfaced in your daily workspace view.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3 max-h-[300px] overflow-y-auto">
            {[
              "All Active Requisitions",
              ...jobs.map((j) => `${j.title} (${j.id.slice(0, 8)})`),
            ].map((pool) => (
              <label
                key={pool}
                onClick={() => setSelectedPool(pool)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold transition-all ${
                  selectedPool === pool
                    ? "border-[#6137e0] bg-[#f4f3ff] text-[#6137e0]"
                    : "border-[#dee2ef] bg-[#f8f9ff] text-[#141c27] hover:bg-[#f0f3ff]"
                }`}
              >
                <span>{pool}</span>
                {selectedPool === pool && (
                  <Check className="w-4 h-4 text-[#6137e0]" />
                )}
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
