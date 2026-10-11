"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
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
  const [activeFilterTab, setActiveFilterTab] = useState<"upcoming" | "pending" | "completed">("upcoming");
  const [selectedSlot, setSelectedSlot] = useState<string>("11:00 AM");
  const [attachRubric, setAttachRubric] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isNewLoopModalOpen, setIsNewLoopModalOpen] = useState<boolean>(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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
                <span className="text-[10px] font-bold uppercase tracking-wider">Scheduled This Week</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">18</span>
                <span className="text-xs text-[#75777c]">interviews queued</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#069669]">
                <span>↗ +4 vs previous cycle</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Scorecards</span>
                <div className="w-7 h-7 rounded-lg bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a]">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">4</span>
                <span className="text-xs font-semibold text-[#ba1a1a]">overdue (&gt;24h)</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                <span>Requires coordinator nudge</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Conflict Alerts</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#ba1a1a]">
                  <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">1</span>
                <span className="text-xs text-[#75777c]">overlapping slot</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#6137e0] font-medium">
                <span>⚡ 15:30 Chris Miller collision</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Avg Feedback Latency</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#6137e0]">
                  <Clock className="w-4 h-4 text-[#6137e0]" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">18.4</span>
                <span className="text-xs font-medium text-[#75777c]">hrs</span>
                <span className="text-[11px] font-semibold text-[#069669] ml-auto">Target &lt;24h</span>
              </div>
              <div className="mt-3 h-1.5 w-full bg-[#dee2ef] rounded-full overflow-hidden">
                <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "76%" }} />
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
                    3 sessions
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#75777c]">
                  <span className="w-2 h-2 rounded-full bg-[#069669]" />
                  <span>Syncing with Google Calendar API</span>
                </div>
              </div>

              {/* Session 1: David K. */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#eff4ff] flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">START</span>
                      <span className="text-lg font-black text-[#141c27]">11:00</span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-[#141c27]">David K.</h3>
                        <span className="text-xs text-[#75777c]">ID #8812</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Starting in 45m
                        </span>
                      </div>
                      <span className="text-xs text-[#45474c] mt-0.5">
                        Req-204 Senior Platform Engineer • Technical Architecture Screen (60m)
                      </span>
                    </div>
                  </div>

                  <a
                    href="https://meet.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-5 rounded-xl bg-[#6137e0] text-white hover:bg-[#4b12cb] text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Meet Room</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#eff4ff] text-xs text-[#75777c]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#131c29] text-white flex items-center justify-center text-[10px] font-bold">
                      CM
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#75777c]">Primary Panelist</span>
                      <span className="font-semibold text-[#141c27]">Chris Miller (Lead SWE)</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] text-[#75777c]">Location</span>
                    <span className="font-medium text-[#141c27]">London Pod 4 / Meet Link</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#6137e0]" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#75777c]">Scorecard Status</span>
                      <span className="font-semibold text-[#6137e0]">Rubric Brief Attached</span>
                    </div>
                  </div>
                </div>

                {/* Core Topic Bar */}
                <div className="p-3 rounded-xl bg-[#eff4ff] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[#45474c]">
                    <Sparkles className="w-4 h-4 text-[#6137e0]" />
                    <span>
                      <strong className="text-[#141c27]">Core Topic Focus:</strong> Distributed Consensus, Raft KV Implementation, and High P99 Latency Isolation
                    </span>
                  </div>
                  <span className="font-bold text-[#6137e0] shrink-0">Scorecard Ready</span>
                </div>
              </div>

              {/* Session 2: Marcus Vance */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#eff4ff] flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">START</span>
                      <span className="text-lg font-black text-[#141c27]">14:00</span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-[#141c27]">Marcus Vance</h3>
                        <span className="text-xs text-[#75777c]">ID #7409</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-semibold text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" /> Confirmed
                        </span>
                      </div>
                      <span className="text-xs text-[#45474c] mt-0.5">
                        Req-204 Senior Platform Engineer • Screening Recruiter Deep-dive (45m)
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/candidates/cand-mv"
                    className="h-10 px-4 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Agenda</span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#eff4ff] text-xs text-[#75777c]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#6137e0] text-white flex items-center justify-center text-[10px] font-bold">
                      EV
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#75777c]">Interviewer</span>
                      <span className="font-semibold text-[#141c27]">Elena Varga (Lead Recruiter)</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] text-[#75777c]">Mode</span>
                    <span className="font-medium text-[#141c27]">Google Meet (Auto-recorded)</span>
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] text-[#75777c]">Focus Areas</span>
                    <span className="font-semibold text-[#141c27]">Notice Period • Base Expectation</span>
                  </div>
                </div>
              </div>

              {/* Session 3: Priya Sharma */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#eff4ff] flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">START</span>
                      <span className="text-lg font-black text-[#141c27]">16:00</span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-[#141c27]">Priya Sharma</h3>
                        <span className="text-xs text-[#75777c]">ID #9034</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-semibold text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" /> Pending Scorecard
                        </span>
                      </div>
                      <span className="text-xs text-[#45474c] mt-0.5">
                        Req-188 Lead Product Designer • Portfolio Review &amp; Design Systems (60m)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => showToast("Scorecard reminder nudge sent to Tomas Novak.")}
                    className="h-10 px-4 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-[#6137e0]" />
                    <span>Nudge Tomas</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#eff4ff] text-xs text-[#75777c]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#131c29] text-white flex items-center justify-center text-[10px] font-bold">
                      TN
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#75777c]">Evaluator</span>
                      <span className="font-semibold text-[#141c27]">Tomas Novak (Dir. Design)</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] text-[#75777c]">Room</span>
                    <span className="font-medium text-[#141c27]">Design Studio A / Zoom</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#ba1a1a]">
                    <Clock className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#75777c]">Evaluation Age</span>
                      <span className="font-bold">Session ended • 2.5h pending</span>
                    </div>
                  </div>
                </div>
              </div>

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

          {/* Prototype Scope Banner */}
          <div className="w-full p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-[#45474c]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#6137e0] shrink-0" />
              <p>
                <strong className="text-[#141c27] font-semibold">Proposed prototype scope:</strong> Live calendar bi-directional synchronization connects via Google Workspace &amp; MS Outlook Graph API.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] shrink-0 font-medium">
              <span className="text-[#069669] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#069669]" />
                Graph API v1.0 Connected
              </span>
              <span>Latency: 42ms</span>
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
                className="px-3 py-1.5 rounded-lg bg-[#6137e0] text-white font-semibold"
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
              Configure interview panel stages, panelists, and scorecard rubrics.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsNewLoopModalOpen(false);
              showToast("New interview loop initialized and synced.");
            }}
            className="flex flex-col gap-3 mt-3 text-xs"
          >
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Candidate</label>
              <input
                required
                placeholder="e.g. Marcus Vance"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Stage Type</label>
              <select className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef]">
                <option>Technical Screen II (Architecture)</option>
                <option>Portfolio &amp; Design Review</option>
                <option>Executive Debrief Loop</option>
              </select>
            </div>
            <button
              type="submit"
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl"
            >
              Initialize Loop
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
