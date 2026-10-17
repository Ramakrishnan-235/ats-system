"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { fetchCandidates, updateCandidateStage, fetchJobs, getErrorMessage } from "@/lib/api";
import { CandidateDetail, JobRequisition } from "@/types/ats";
import {
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  Video,
  ExternalLink,
  ChevronDown,
  Search,
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  Bell,
  RefreshCw,
  Send,
  Hourglass,
  Check,
  ArrowRight,
  ShieldCheck,
  Building2,
  FolderGit2,
  Sparkles,
  Briefcase,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function InterviewsPage() {
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFilterTab, setActiveFilterTab] = useState<"upcoming" | "pending" | "completed">("upcoming");
  const [selectedSlot, setSelectedSlot] = useState<string>("11:00 AM");
  const [attachRubric, setAttachRubric] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isNewLoopModalOpen, setIsNewLoopModalOpen] = useState<boolean>(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New loop form
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [loopStageType, setLoopStageType] = useState<string>("Technical Architecture Screen");
  const [isSavingLoop, setIsSavingLoop] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, jobsData] = await Promise.all([
        fetchCandidates().catch(() => [] as CandidateDetail[]),
        fetchJobs().catch(() => [] as JobRequisition[]),
      ]);
      setCandidates(cands);
      setJobs(jobsData);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCandidates().catch(() => [] as CandidateDetail[]),
      fetchJobs().catch(() => [] as JobRequisition[]),
    ]).then(([cands, jobsData]) => {
      if (!active) return;
      setCandidates(cands);
      setJobs(jobsData);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const interviewCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const isInterview =
        c.stage?.toLowerCase() === "interview" ||
        c.applications?.some((a) => a.stage.toLowerCase() === "interview");
      if (!isInterview) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (c.name || c.anonymized_name || "").toLowerCase().includes(q);
        const matchRole = (c.applied_for_job || c.target_headline || "").toLowerCase().includes(q);
        return matchName || matchRole;
      }
      return true;
    });
  }, [candidates, searchQuery]);

  const candidatesForNewLoop = useMemo(() => {
    return candidates.filter((c) => {
      const stage = c.stage?.toLowerCase() || "";
      return !["interview", "offer", "hired"].includes(stage);
    });
  }, [candidates]);

  const handleInitializeLoop = async (e: React.FormEvent) => {
    e.preventDefault();
    const candId = selectedCandidateId || candidatesForNewLoop[0]?.id;
    if (!candId) {
      showToast("Please select a candidate to initialize an interview loop.");
      return;
    }
    const cand = candidates.find((c) => c.id === candId);
    setIsSavingLoop(true);
    try {
      const jobId = cand?.applied_for_job_id || cand?.applications?.[0]?.job_id;
      await updateCandidateStage(candId, "Interview", jobId);
      showToast(`Interview loop initialized for ${cand?.name || cand?.anonymized_name || "candidate"}.`);
      setIsNewLoopModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setIsSavingLoop(false);
    }
  };

  const handleAdvanceToOffer = async (cand: CandidateDetail) => {
    try {
      const jobId = cand.applied_for_job_id || cand.applications?.[0]?.job_id;
      await updateCandidateStage(cand.id, "Offer", jobId);
      showToast(`Candidate ${cand.name || cand.anonymized_name} advanced to Offer stage.`);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-6">
          
          {/* Top Breadcrumb & Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-1.5 text-xs text-[#75777c] font-semibold uppercase tracking-wider mb-0.5">
                <span>Recruitment Operations</span>
                <span>›</span>
                <span className="text-[#6137e0]">Interviews</span>
                <span>›</span>
                <span className="text-[#141c27]">Panel Evaluations</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                Interviews &amp; Panel Evaluations
              </h1>
              <p className="text-sm text-[#45474c] mt-0.5">
                Coordinate panel schedules, monitor interviewer feedback velocity, and resolve calendar conflicts across active loops with verified evidence trails.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => showToast("Panel scheduling preferences opened.")}
                className="h-10 px-4 rounded-xl bg-white text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef] transition-colors text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#75777c]" />
                <span>Panel Preferences</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewLoopModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] transition-all text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>New Interview Loop</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Interview Loops</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">
                  {loading ? "..." : interviewCandidates.length}
                </span>
                <span className="text-xs text-[#75777c]">active candidates</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#069669]">
                <span>Confirmed in Interview Stage</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Completed Scorecards</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#6137e0]">
                  <FileText className="w-4 h-4 text-[#6137e0]" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">
                  {loading ? "..." : candidates.filter((c) => c.scorecard?.overall_match_score != null).length}
                </span>
                <span className="text-xs text-[#75777c]">evaluated</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-2 h-2 rounded-full bg-[#069669]" />
                <span>AI scorecards generated</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Candidate Pool</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                  <Users className="w-4 h-4 text-[#141c27]" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">
                  {loading ? "..." : candidates.length}
                </span>
                <span className="text-xs text-[#75777c]">total in pipeline</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#6137e0] font-medium">
                <span>{candidatesForNewLoop.length} eligible for interview</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Open Requisitions</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#6137e0]">
                  <Briefcase className="w-4 h-4 text-[#6137e0]" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">
                  {loading ? "..." : jobs.length}
                </span>
                <span className="text-xs font-medium text-[#75777c]">roles</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#069669] font-medium">
                <span>Active job postings</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#eff4ff] rounded-xl border border-[#dee2ef]/50 cursor-pointer font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#75777c]" />
                <span>This Week: Oct 6–12</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-[#eff4ff] rounded-xl border border-[#dee2ef]/50 cursor-pointer font-medium">
                <Briefcase className="w-3.5 h-3.5 text-[#75777c]" />
                <span>Job: Req-204 Senior Platform Eng (+1)</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-[#eff4ff] rounded-xl border border-[#dee2ef]/50 cursor-pointer font-medium">
                <Users className="w-3.5 h-3.5 text-[#75777c]" />
                <span>Panelist: All Interviewers</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Status Tabs */}
              <div className="p-1 bg-[#eff4ff] rounded-xl flex items-center gap-1 border border-[#dee2ef]/40">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab("upcoming")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeFilterTab === "upcoming"
                      ? "bg-white text-[#141c27] shadow-xs"
                      : "text-[#75777c] hover:text-[#141c27]"
                  }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab("pending")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeFilterTab === "pending"
                      ? "bg-white text-[#141c27] shadow-xs"
                      : "text-[#75777c] hover:text-[#141c27]"
                  }`}
                >
                  Pending Feedback (4)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab("completed")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeFilterTab === "completed"
                      ? "bg-white text-[#141c27] shadow-xs"
                      : "text-[#75777c] hover:text-[#141c27]"
                  }`}
                >
                  Completed
                </button>
              </div>

              {/* Search */}
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-[#75777c] absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter session or name..."
                  className="w-full h-9 pl-8 pr-3 bg-[#f8f9ff] text-xs rounded-xl border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                />
              </div>
            </div>
          </div>

          {/* Urgent Calendar Conflict Alert */}
          <div className="p-4 rounded-2xl bg-[#ffdad6]/40 border border-[#ba1a1a]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ba1a1a] text-white flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#ba1a1a]">Calendar Conflict Detected</span>
                  <span className="px-2 py-0.2 rounded-full bg-[#ba1a1a] text-white font-bold text-[10px]">
                    URGENT
                  </span>
                </div>
                <p className="text-xs text-[#45474c] mt-0.5">
                  Chris Miller is overbooked at 15:30 with &quot;Q4 Platform Planning &amp; Roadmap&quot; while assigned to Candidate Priya Sharma loop. Proposed alternative: 16:30 today (Free 45m window)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsConflictModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#ba1a1a] text-white hover:bg-[#93000a] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <span>Re-slot Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Split View: Left Scheduled Sessions (8 cols) & Right Builder/Monitor (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Cols: Scheduled Sessions */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#141c27]">Today&apos;s Scheduled Sessions</h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#141c27] text-xs font-semibold">
                    {interviewCandidates.length} session{interviewCandidates.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#75777c]">
                  <span className="w-2 h-2 rounded-full bg-[#069669]" />
                  <span>Pipeline Stage: Interview</span>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs text-[#75777c] bg-white rounded-2xl border border-[#dee2ef]">
                  Loading interview loops...
                </div>
              ) : interviewCandidates.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 shadow-xs border border-[#dee2ef]/70 text-center flex flex-col items-center justify-center gap-3">
                  <Calendar className="w-8 h-8 text-[#75777c]" />
                  <h3 className="text-sm font-bold text-[#141c27]">No interview loops active</h3>
                  <p className="text-xs text-[#75777c] max-w-sm">
                    No candidates are currently in the Interview stage. Select a candidate and initialize an interview loop.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewLoopModalOpen(true)}
                    className="px-4 py-2 bg-[#131c29] text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
                  >
                    + New Interview Loop
                  </button>
                </div>
              ) : (
                interviewCandidates.map((cand, idx) => {
                  const candName = cand.name || cand.anonymized_name || `Candidate #${cand.id.slice(0, 8)}`;
                  const role = cand.applied_for_job || cand.target_headline || "Candidate Evaluation";
                  const score = cand.scorecard?.overall_match_score;
                  const times = ["11:00", "14:00", "16:00", "17:30"];
                  const timeStr = times[idx % times.length];

                  return (
                    <div key={cand.id} className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-[#eff4ff] flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">START</span>
                            <span className="text-lg font-black text-[#141c27]">{timeStr}</span>
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-[#141c27]">{candName}</h3>
                              <span className="text-xs text-[#75777c]">ID #{cand.id.slice(0, 8)}</span>
                              <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-semibold text-[11px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" /> Interview Stage
                              </span>
                            </div>
                            <span className="text-xs text-[#45474c] mt-0.5">
                              {role} • Panel Evaluation (60m)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/candidates/${cand.id}`}
                            className="h-10 px-4 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Scorecard</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleAdvanceToOffer(cand)}
                            className="h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-black text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
                          >
                            <ArrowRight className="w-4 h-4" />
                            <span>Advance to Offer</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#eff4ff] text-xs text-[#75777c]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#6137e0] text-white flex items-center justify-center text-[10px] font-bold">
                            {candName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] text-[#75777c]">Target Headline</span>
                            <span className="font-semibold text-[#141c27] truncate max-w-[150px]">
                              {cand.target_headline || "Candidate"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col justify-center">
                          <span className="text-[11px] text-[#75777c]">AI Match Score</span>
                          <span className="font-medium text-[#141c27]">
                            {score != null ? `${score.toFixed(0)}% Overall Fit` : "Pending Evaluation"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#6137e0]" />
                          <div className="flex flex-col">
                            <span className="text-[11px] text-[#75777c]">Scorecard Status</span>
                            <span className="font-semibold text-[#6137e0]">Rubric Attached</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right 4 Cols: Session Builder & Monitor */}
            <div className="lg:col-span-4 flex flex-col gap-5 sticky top-24">
              
              {/* Session Builder */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#eff4ff]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6137e0]">
                    Session Builder
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#75777c]">Req-204</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#141c27]">Schedule Technical Interview</h3>
                  <div className="p-3 rounded-xl bg-[#eff4ff] mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-xs">
                        DK
                      </div>
                      <div>
                        <div className="font-bold text-[#141c27]">David K.</div>
                        <div className="text-[11px] text-[#75777c]">Candidate #8812</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#6137e0]">
                      Stage: System Design Round
                    </span>
                  </div>
                </div>

                {/* Interviewer Multi-Availability */}
                <div className="flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#141c27]">Interviewer Multi-Availability</span>
                    <span className="text-[11px] text-[#75777c]">Oct 8, 2026</span>
                  </div>

                  {/* Chris Miller Availability */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#141c27] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" />
                        Chris Miller (Lead SWE)
                      </span>
                      <span className="text-[11px] text-[#069669] font-semibold">3 slots free</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {["09:30 AM", "11:00 AM", "14:30 PM"].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                            selectedSlot === slot
                              ? "bg-[#6137e0] text-white shadow-2xs"
                              : "bg-[#eff4ff] text-[#141c27] hover:bg-[#dee2ef]"
                          }`}
                        >
                          {slot} {selectedSlot === slot && "✓"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tomas Novak Availability */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#141c27] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" />
                        Tomas Novak (Dir. Design)
                      </span>
                      <span className="text-[11px] text-[#069669] font-semibold">2 slots free</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {["13:00 PM", "16:00 PM"].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] font-mono text-[11px] font-semibold transition-colors"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rubric Injection Checkbox */}
                <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/50 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="rubricCheck"
                    checked={attachRubric}
                    onChange={(e) => setAttachRubric(e.target.checked)}
                    className="mt-0.5 accent-[#6137e0] rounded cursor-pointer"
                  />
                  <label htmlFor="rubricCheck" className="text-xs cursor-pointer">
                    <strong className="text-[#141c27] block font-semibold">
                      Attach Req-204 Rubric &amp; Key Verification Questions
                    </strong>
                    <span className="text-[11px] text-[#75777c] leading-snug block mt-0.5">
                      Automatically injects tailored technical screening prompts and scorecard links directly into the calendar invitation body.
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => showToast("Panel invitations dispatched via Google Calendar API.")}
                  className="w-full h-10 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Panel Invitations</span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => showToast("Rescheduling flow opened.")}
                    className="text-xs text-[#75777c] hover:text-[#141c27] font-medium"
                  >
                    Reschedule Session
                  </button>
                </div>
              </div>

              {/* Feedback Status Monitor */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#eff4ff]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#6137e0]" />
                    <h3 className="text-sm font-bold text-[#141c27]">Feedback Status Monitor</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-bold text-[10px]">
                    4 Overdue
                  </span>
                </div>

                <p className="text-xs text-[#75777c]">
                  Loops pending formal evaluation submission past the 24-hour compliance window.
                </p>

                <div className="flex flex-col gap-2.5">
                  {/* Item 1: Chris Miller */}
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#141c27]">Chris Miller</div>
                      <div className="text-[11px] text-[#75777c]">Candidate: Alex Morgan</div>
                      <span className="text-[11px] font-semibold text-[#ba1a1a]">Overdue by 31 hrs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => showToast("Nudge sent to Chris Miller.")}
                      className="h-8 px-3 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#6137e0] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Send Nudge</span>
                    </button>
                  </div>

                  {/* Item 2: Sarah Jenkins */}
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#141c27]">Sarah Jenkins</div>
                      <div className="text-[11px] text-[#75777c]">Candidate: Liam Wu</div>
                      <span className="text-[11px] font-semibold text-[#ba1a1a]">Overdue by 26 hrs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => showToast("Nudge sent to Sarah Jenkins.")}
                      className="h-8 px-3 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#6137e0] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Send Nudge</span>
                    </button>
                  </div>

                  {/* Item 3: David Zhang */}
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#141c27]">David Zhang</div>
                      <div className="text-[11px] text-[#75777c]">Candidate: Tara Collins</div>
                      <span className="text-[11px] text-[#069669] font-medium">14 hrs elapsed (On track)</span>
                    </div>
                    <Hourglass className="w-4 h-4 text-[#75777c]" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Active Interview Operations Banner */}
          <div className="w-full p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-[#45474c]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#6137e0] shrink-0" />
              <p>
                <strong className="text-[#141c27] font-semibold">Active Interview Operations:</strong> Stage transitions directly persist candidate evaluation status to workspace records.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] shrink-0 font-medium">
              <span className="text-[#069669] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#069669]" />
                Live Stage Synchronization
              </span>
              <span>{interviewCandidates.length} Active Loops</span>
            </div>
          </div>

        </div>
      </main>

      {/* Conflict Resolution Modal */}
      <Dialog open={isConflictModalOpen} onOpenChange={setIsConflictModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
              <span>Resolve Panel Collision</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Select an alternative free slot for Chris Miller and Priya Sharma.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3 text-xs">
            <div className="p-3 bg-[#eff4ff] rounded-xl text-[#141c27] flex items-center justify-between">
              <div>
                <div className="font-bold">16:30 – 17:30 Today (Recommended)</div>
                <div className="text-[11px] text-[#75777c]">Both parties 100% available with 0 collisions</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConflictModalOpen(false);
                  showToast("Interview successfully moved to 16:30 today.");
                }}
                className="px-3 py-1.5 rounded-lg bg-[#6137e0] text-white font-semibold cursor-pointer"
              >
                Accept Slot
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Interview Loop Modal */}
      <Dialog open={isNewLoopModalOpen} onOpenChange={setIsNewLoopModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              New Interview Loop
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Select a candidate from your pipeline and advance them into the Interview stage.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInitializeLoop} className="flex flex-col gap-3 mt-3 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Select Candidate *</label>
              {candidatesForNewLoop.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                  All active candidates are already in Interview, Offer, or Hired stages.
                </div>
              ) : (
                <select
                  value={selectedCandidateId || candidatesForNewLoop[0]?.id || ""}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-xs font-medium cursor-pointer"
                >
                  {candidatesForNewLoop.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.anonymized_name} — {c.applied_for_job || c.target_headline || "Applicant"} ({c.stage || "Applied"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Stage Type</label>
              <select
                value={loopStageType}
                onChange={(e) => setLoopStageType(e.target.value)}
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-xs font-medium cursor-pointer"
              >
                <option>Technical Screen II (Architecture)</option>
                <option>Portfolio &amp; Design Review</option>
                <option>Executive Debrief Loop</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingLoop || candidatesForNewLoop.length === 0}
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSavingLoop ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Initialize Loop &amp; Save Stage</span>
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <CoreFooter />
    </div>
  );
}
