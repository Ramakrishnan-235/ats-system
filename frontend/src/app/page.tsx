"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
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
  Laptop,
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

  // State
  const [activeQueueTab, setActiveQueueTab] = useState<"Mine" | "Team">("Mine");
  const [nudgeSent, setNudgeSent] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState("All 14 Pools");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendNudge = () => {
    setNudgeSent(true);
    showToast("Urgent scorecard nudge dispatched to Chris Miller via Slack & Email");
  };

  const handleExportLedger = () => {
    showToast("Daily Ledger exported (CSV & Audit JSON generated)");
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

          {/* Top Breadcrumb & Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6137e0] uppercase tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                <span className="text-[#6137e0]">Recruiter Workspace</span>
                <span className="text-[#9ea3ae]">/</span>
                <span className="text-[#555a64]">Tablet Optimized (768px Viewport)</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
                Good morning, Elena
              </h1>
              <p className="text-xs sm:text-sm text-[#555a64] mt-1 font-medium">
                Tuesday, 6 October • Requisition sync active across 14 enterprise pools
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
                      12 applications need review today
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#6137e0] text-white text-[11px] font-bold tracking-wide">
                      High Attention
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#bec7d9] mt-1 font-normal">
                    6 executive roles nearing SLA boundary • Human-in-the-loop signoff pending
                  </p>
                </div>
              </div>

              <Link
                href="/candidates/cand-mv"
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
                  142
                </div>
                <span className="text-[11px] font-semibold text-emerald-400">
                  +14 past 24h
                </span>
              </div>

              {/* Screening */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Screening
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  128
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  38% total pool
                </span>
              </div>

              {/* Tech Panel */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Tech Panel
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  86
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  12 panels active
                </span>
              </div>

              {/* Offer Stage */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Offer Stage
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  18
                </div>
                <span className="text-[11px] font-medium text-[#bec7d9]">
                  3 signoffs due
                </span>
              </div>

              {/* Hired (Q4) */}
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[11px] font-medium text-[#bec7d9] uppercase tracking-wider">
                  Hired (Q4)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white my-1">
                  15
                </div>
                <span className="text-[11px] font-semibold text-emerald-400">
                  83% target
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
                    Queue Active
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
                    Mine (4)
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
                    Team (9)
                  </button>
                </div>
              </div>

              {/* Card 1: Marcus Vance */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-4 hover:shadow-md transition-shadow">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-[#dee2ef]"
                        alt="Marcus Vance"
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-[#111827]">
                          Marcus Vance
                        </span>
                        <span className="text-xs font-bold text-[#6137e0]">
                          • 94 Fit
                        </span>
                      </div>
                      <p className="text-xs text-[#555a64] truncate">
                        Senior Platform Engineer • Req-204
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#45474c] text-xs font-semibold shrink-0">
                    Stage: Screening
                  </span>
                </div>

                {/* Evidence Box */}
                <div className="bg-[#f0f3ff] rounded-xl p-3.5 border border-[#dee2ef]/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#6137e0] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      STRUCTURED EVIDENCE EXTRACTED
                    </span>
                    <span className="text-[#555a64] font-medium">
                      GitHub & Referral Source
                    </span>
                  </div>

                  <p className="text-xs text-[#141c27] leading-relaxed">
                    11y continuous Go/Kubernetes experience across high-throughput distributed messaging nodes.
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <Link
                      href="/candidates/cand-mv"
                      className="px-2.5 py-1 rounded-md bg-white border border-[#dee2ef] text-[11px] font-semibold text-[#6137e0] hover:bg-[#e7deff] transition-colors"
                    >
                      Resume: P.2 §Architecture
                    </Link>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-white border border-[#dee2ef] text-[11px] font-semibold text-[#6137e0] hover:bg-[#e7deff] transition-colors"
                    >
                      PR: #1042 Envoy-Mesh
                    </a>
                  </div>
                </div>

                {/* Footer action row */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#75777c] flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#75777c]" />
                    Waiting 3h for first contact
                  </span>

                  <Link
                    href="/candidates/cand-mv"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm"
                  >
                    <span>Review Application</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Chris Miller for David K. (Scorecard Missing) */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#fee4e2] text-[#d92d20] flex items-center justify-center shrink-0 mt-0.5 border border-[#fecdca]">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d92d20] uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d92d20]"></span>
                          SCORECARD MISSING
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#111827]">
                        Chris Miller for David K.
                      </h3>
                      <p className="text-xs text-[#555a64] mt-0.5">
                        System Architecture Deep-Dive • Held 22h ago
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
                    <span>{nudgeSent ? "Nudge Dispatched" : "Send Nudge"}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#555a64] pt-2 border-t border-[#dee2ef]/50">
                  <span className="text-[#d92d20] font-semibold">
                    Next Stage: Final Executive Debrief will stall in 2h
                  </span>
                  <span className="font-mono text-[11px] text-[#75777c]">
                    SLA Ref: ESC-881
                  </span>
                </div>
              </div>

              {/* Card 3: Priya Sharma (Referral) */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/70 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-[#dee2ef]"
                      alt="Priya Sharma"
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#111827]">
                        Priya Sharma
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f0fdf9] text-[#0f766e] border border-[#ccfbf1] text-[10px] font-bold">
                        Referral
                      </span>
                    </div>
                    <p className="text-xs text-[#555a64] truncate">
                      Lead Product Designer • Req-188
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#75777c]">
                      <span>Referred by: Marcus Lee (VP Product)</span>
                      <span>•</span>
                      <span className="text-[#027a48] font-semibold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Portfolio Verified
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/interviews"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Initial Screen</span>
                </Link>
              </div>

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
                    2 Critical Reqs
                  </span>
                </div>

                {/* Role 1: Senior Platform Engineer */}
                <div className="flex flex-col gap-2 pt-1 border-t border-[#dee2ef]/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#111827]">
                      Senior Platform Engineer <span className="font-normal text-[#75777c]">Req-204</span>
                    </span>
                    <span className="font-bold text-[#d92d20]">
                      48h Avg Screen Time
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#111827]">48</div>
                      <div className="text-[10px] text-[#75777c]">Applicants</div>
                    </div>
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#6137e0]">12</div>
                      <div className="text-[10px] text-[#75777c]">Screening</div>
                    </div>
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#111827]">6</div>
                      <div className="text-[10px] text-[#75777c]">Interviews</div>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1.5 rounded-full bg-[#dee2ef] overflow-hidden flex">
                    <div className="bg-[#131c29] h-full" style={{ width: "45%" }}></div>
                    <div className="bg-[#6137e0] h-full" style={{ width: "35%" }}></div>
                    <div className="bg-[#a4bcff] h-full" style={{ width: "20%" }}></div>
                  </div>
                </div>

                {/* Role 2: Lead Product Designer */}
                <div className="flex flex-col gap-2 pt-3 border-t border-[#dee2ef]/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#111827]">
                      Lead Product Designer <span className="font-normal text-[#75777c]">Req-188</span>
                    </span>
                    <span className="font-bold text-emerald-600">
                      Pacing Ahead (92%)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#111827]">31</div>
                      <div className="text-[10px] text-[#75777c]">Applicants</div>
                    </div>
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#6137e0]">8</div>
                      <div className="text-[10px] text-[#75777c]">Screening</div>
                    </div>
                    <div className="bg-[#f8f9ff] rounded-lg p-2 border border-[#dee2ef]/50">
                      <div className="text-base font-extrabold text-[#111827]">4</div>
                      <div className="text-[10px] text-[#75777c]">Design Review</div>
                    </div>
                  </div>
                </div>
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
                    href="/imports"
                    className="text-xs font-semibold text-[#6137e0] hover:underline flex items-center gap-1"
                  >
                    <span>View Queue</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex items-center gap-5 pt-1">
                  {/* Donut Chart representation */}
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
                        strokeDasharray="80, 100"
                        strokeWidth="3.8"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-[#111827]">
                      80%
                    </div>
                  </div>

                  {/* Summary & Legend */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#111827]">
                        64 Files Batch Status
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#f0f3ff] text-[#45474c] text-[10px] font-mono font-bold">
                        Cluster-04
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#555a64] flex-wrap mt-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <strong className="text-[#111827]">51</strong> Completed
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                        <strong className="text-[#111827]">9</strong> Processing
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <strong className="text-[#111827]">2</strong> Warnings
                      </span>
                    </div>
                  </div>
                </div>
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
                    2 Scheduled
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 pt-1">
                  {/* Session 1 */}
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#dee2ef] font-mono text-xs font-bold text-[#111827] shrink-0 text-center">
                        <div className="text-[9px] text-[#75777c] font-sans">START</div>
                        11:00
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#111827] truncate">
                          David K.
                        </h4>
                        <p className="text-[11px] text-[#555a64] truncate">
                          Architecture Review • Req-204
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/interviews"
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#dee2ef] text-xs font-semibold text-[#111827] hover:bg-[#dee2ef]/30 transition-all shrink-0 shadow-2xs"
                    >
                      Join Call
                    </Link>
                  </div>

                  {/* Session 2 */}
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="px-2.5 py-1.5 rounded-lg bg-[#dee2ef] font-mono text-xs font-bold text-[#111827] shrink-0 text-center">
                        <div className="text-[9px] text-[#75777c] font-sans">START</div>
                        14:00
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#111827] truncate">
                          Marcus Vance
                        </h4>
                        <p className="text-[11px] text-[#555a64] truncate">
                          Screening Sync • Req-204
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/candidates/cand-mv"
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#dee2ef] text-xs font-semibold text-[#111827] hover:bg-[#dee2ef]/30 transition-all shrink-0 shadow-2xs"
                    >
                      Pre-Brief
                    </Link>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Designer Scope Annotation Box */}
          <div className="w-full bg-[#f0f3ff] rounded-xl p-4 border border-[#dee2ef] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[#45474c]">
              <Laptop className="w-4 h-4 text-[#6137e0] shrink-0" />
              <div>
                <strong className="text-[#111827] uppercase tracking-wider font-bold">
                  DESIGNER SCOPE ANNOTATION:
                </strong>{" "}
                Proposed prototype scope: Tablet layout automatically collapses sidebar navigation into a touch gesture drawer.
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-white text-[#6137e0] font-mono text-[11px] font-bold border border-[#dee2ef] shrink-0">
              Viewport: 768px w-mode
            </span>
          </div>

        </div>
      </main>

      {/* Double Footer Ribbons */}
      <footer className="w-full bg-white border-t border-[#dee2ef]">
        {/* Ribbon 1 */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#75777c] border-b border-[#f0f3ff]">
          <span>© 2025 CORE ATS Inc. AI-assisted recruitment workspace.</span>
          <span className="font-mono text-[11px]">
            Build 412.0 • Halden Global Production Node
          </span>
        </div>

        {/* Ribbon 2 */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#555a64]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#111827]">CORE ATS © 2025</span>
            <span>•</span>
            <span>EEOC compliant</span>
            <span>•</span>
            <span>SOC2 Type II Certified</span>
            <span>•</span>
            <span>Verifiable human-in-the-loop audit trails</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/audit-log" className="hover:text-[#111827] transition-colors">
              Audit Log
            </Link>
            <Link href="/settings" className="hover:text-[#111827] transition-colors">
              Data Retention
            </Link>
            <Link href="/settings" className="hover:text-[#111827] transition-colors">
              Security
            </Link>
            <Link href="/settings" className="hover:text-[#111827] transition-colors">
              System Status
            </Link>
          </div>
        </div>
      </footer>

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

          <div className="flex flex-col gap-3 py-3">
            {[
              "All 14 Enterprise Pools (Halden Global)",
              "Req-204: Senior Platform Engineer",
              "Req-188: Lead Product Designer",
              "Req-208: Staff Data Architect",
              "Executive Search & Direct Sourcing",
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
