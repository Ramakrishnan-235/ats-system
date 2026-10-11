"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { CandidateReviewModal } from "@/components/dashboard/candidate-review-modal";
import { useSession } from "@/components/layout/api-session";
import { fetchDashboardStats, getErrorMessage } from "@/lib/api";
import { StatMetric, WeeklyData, AIMatchRate, PipelineCandidateItem } from "@/types/ats";
import {
  Sparkles,
  ArrowRight,
  History,
  Clock,
  AlarmClock,
  PenTool,
  Calendar,
  ChevronRight,
  TrendingUp,
  Brain,
  Plus,
  Flame,
  CheckCircle2,
  FileText,
  AlertTriangle
} from "lucide-react";

export default function OverviewPage() {
  const { session } = useSession();
  const [stats, setStats] = useState<StatMetric[]>([]);
  const [activeTab, setActiveTab] = useState<"mine" | "team">("mine");
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{
    name: string;
    role: string;
    req: string;
  }>({
    name: "Marcus Vance",
    role: "Senior Backend Engineer",
    req: "Req-204",
  });
  const [error, setError] = useState<string | null>(null);

  // Load backend metrics if connected
  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchDashboardStats();
        if (data?.stats) setStats(data.stats);
      } catch (err) {
        // Fall back gracefully to rich design system defaults
        console.warn("Using offline design system snapshot for dashboard:", err);
      }
    }
    loadData();
  }, []);

  const openCandidateReview = (name: string, role: string, req: string) => {
    setSelectedCandidate({ name, role, req });
    setIsReviewOpen(true);
  };

  const userName = session?.user?.name || "Elena";
  const orgName = session?.workspaces?.[0]?.name?.toUpperCase() || "HALDEN TALENT PARTNERS";

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#171c25] font-sans antialiased selection:bg-[#6137e0] selection:text-white">
      {/* Top Fixed Header */}
      <CoreHeader />

      {/* Main Container */}
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full gap-6 pb-12">
            
            {/* Top Workspace Header & Greetings */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
                  {orgName} · TUESDAY 8 OCTOBER
                </span>
                <h1 className="text-3xl lg:text-4xl font-bold text-[#171c25] tracking-tight">
                  Good morning, {userName}
                </h1>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* Real-time Agents Running Pill */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-xs border border-[#dee2ef]/60 text-[#45474c] text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6137e0] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6137e0]"></span>
                  </span>
                  <span>
                    <strong className="font-semibold text-[#171c25]">3 parsing agents</strong> running
                  </span>
                  <span className="text-[#c5c6cc]">•</span>
                  <span>84 resumes processed overnight</span>
                </div>

                {/* Create Job Primary CTA */}
                <button
                  type="button"
                  onClick={() => setIsCreateJobOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#131c29] text-white hover:bg-[#2c313a] text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create job</span>
                </button>
              </div>
            </section>

            {/* 2-Column Workstation Layout (8 cols Left Intelligence Deck, 4 cols Right Cockpit) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* LEFT 8 COLS: Intelligence Command Deck */}
              <div className="xl:col-span-8 flex flex-col gap-6">
                
                {/* High-Contrast Agent Briefing Panel */}
                <div className="relative overflow-hidden rounded-2xl bg-[#131c29] text-white p-6 lg:p-8 shadow-xl">
                  {/* Ambient radial glow */}
                  <div className="absolute -right-24 -top-24 w-96 h-96 bg-[#6137e0]/20 rounded-full blur-3xl pointer-events-none"></div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                    
                    {/* Left Briefing Text & Metrics */}
                    <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#dbe1ff] text-[11px] font-semibold tracking-wide">
                          <Brain className="w-3.5 h-3.5 text-[#cbbeff]" />
                          <span className="uppercase tracking-wider">
                            AI-ASSISTED RECRUITMENT WORKSPACE · DAILY HIRING BRIEFING
                          </span>
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                          12 applications need review today
                        </h2>
                        <p className="text-sm text-[#bec7d9] leading-relaxed">
                          Cloud Infrastructure Lead and Senior Product Designer have priority matches waiting. 412 applications in active pipeline across 14 requisitions.
                        </p>
                      </div>

                      {/* Quantitative Health Counter */}
                      <div className="pt-2">
                        <div className="flex items-baseline gap-4">
                          <span className="text-5xl font-extrabold text-white tracking-tight leading-none">
                            412
                          </span>
                          <div className="flex flex-col gap-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-xs font-semibold text-[#dbe1ff]">
                              <span>Active Candidates</span>
                              <span className="opacity-50">·</span>
                              <span>Median time to hire: 24 days</span>
                            </div>
                            <span className="text-[11px] text-[#bec7d9]">
                              412 applications in active pipeline across 14 requisitions · Pipeline health nominal
                            </span>
                          </div>
                        </div>

                        {/* Metric Indicators */}
                        <div className="flex flex-wrap items-center gap-2 pt-4 text-xs">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white">
                            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                            <strong className="font-semibold">14</strong> Aging &gt;5 days in stage
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white">
                            <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                            <strong className="font-semibold">8</strong> Fast-track candidates
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white">
                            <span className="w-2 h-2 rounded-full bg-[#dee2ef]"></span>
                            <strong className="font-semibold">12</strong> Awaiting recruiter review
                          </span>
                        </div>
                      </div>

                      {/* Action CTA Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => openCandidateReview("Marcus Vance", "Senior Backend Engineer", "Req-204")}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6137e0] text-white hover:bg-[#7a55fa] transition-colors text-xs font-semibold shadow-sm cursor-pointer"
                        >
                          <span>Review priority applications</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Right Sourcing Radial Network & Pipeline Breakdown */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[260px]">
                      <div className="w-full flex flex-col justify-center gap-3.5 bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#bec7d9]">
                            Pipeline Breakdown
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-[#dbe1ff]">
                            Total: 412
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {/* Applied */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#dee2ef]"></span>
                                Applied
                              </span>
                              <span className="font-semibold">142 (34%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#dee2ef] rounded-full" style={{ width: "34%" }}></div>
                            </div>
                          </div>

                          {/* Screening */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#497cff]"></span>
                                Screening
                              </span>
                              <span className="font-semibold">128 (31%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#497cff] rounded-full" style={{ width: "31%" }}></div>
                            </div>
                          </div>

                          {/* Interview */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                                Interview
                              </span>
                              <span className="font-semibold">86 (21%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "21%" }}></div>
                            </div>
                          </div>

                          {/* Offer */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#cbbeff]"></span>
                                Offer
                              </span>
                              <span className="font-semibold">38 (9%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#cbbeff] rounded-full" style={{ width: "9%" }}></div>
                            </div>
                          </div>

                          {/* Hired */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#dbe1ff]"></span>
                                Hired
                              </span>
                              <span className="font-semibold">18 (4%)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#dbe1ff] rounded-full" style={{ width: "4%" }}></div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] text-[#bec7d9]">
                          <span>Stage velocity: ~4.2d/stage</span>
                          <span className="text-[#dbe1ff] font-medium">18 hired</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Lower 2-Card Analysis Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card 1: Resume Ingestion & Parsing */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#dee2ef]/60 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3">
                      <div>
                        <h3 className="text-base font-bold text-[#171c25]">
                          Resume Ingestion & Parsing
                        </h3>
                        <p className="text-xs text-[#45474c]">
                          64 files processed overnight · Automated sync
                        </p>
                      </div>
                      <History className="w-5 h-5 text-[#75777c]" />
                    </div>

                    {/* Custom Stacked Hourly Bar Chart */}
                    <div className="pt-2 pb-4">
                      <div className="flex items-end justify-between gap-1.5 h-36 px-1">
                        {[
                          { hour: "22", count: 5, parsed: 3, review: 1, warn: 1 },
                          { hour: "23", count: 8, parsed: 4, review: 2, warn: 2 },
                          { hour: "00", count: 6, parsed: 4, review: 2, warn: 0 },
                          { hour: "01", count: 4, parsed: 3, review: 1, warn: 0 },
                          { hour: "02", count: 9, parsed: 5, review: 3, warn: 1 },
                          { hour: "03", count: 5, parsed: 4, review: 1, warn: 0 },
                          { hour: "04", count: 4, parsed: 2, review: 0, warn: 2 },
                          { hour: "05", count: 8, parsed: 5, review: 2, warn: 1 },
                          { hour: "06", count: 9, parsed: 6, review: 2, warn: 1 },
                          { hour: "07", count: 6, parsed: 4, review: 2, warn: 0 },
                        ].map((col, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                            {/* Hover tooltip */}
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#131c29] text-white text-[10px] py-1 px-1.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-lg">
                              {col.hour}:00 - {col.count} resumes
                            </div>
                            <span className="font-mono text-[10px] text-[#75777c] font-semibold">
                              {col.count}
                            </span>
                            <div
                              className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden bg-[#e4e8f5]"
                              style={{ height: `${col.count * 12}px` }}
                            >
                              <div
                                className="w-full bg-[#dee2ef]"
                                style={{ height: `${(col.parsed / col.count) * 100}%` }}
                              ></div>
                              <div
                                className="w-full bg-[#6137e0]"
                                style={{ height: `${(col.review / col.count) * 100}%` }}
                              ></div>
                              {col.warn > 0 && (
                                <div
                                  className="w-full bg-[#ba1a1a]"
                                  style={{ height: `${(col.warn / col.count) * 100}%` }}
                                ></div>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-[#75777c]">
                              {col.hour}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#dee2ef]/60 text-xs text-[#45474c]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#dee2ef]"></span>
                        Parsed & Structured <strong className="text-[#171c25]">51</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#6137e0]"></span>
                        Needs Review <strong className="text-[#171c25]">11</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#ba1a1a]"></span>
                        Warnings <strong className="text-[#171c25]">2</strong>
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Pipeline health */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#dee2ef]/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2">
                        <h3 className="text-base font-bold text-[#171c25]">
                          Pipeline health
                        </h3>
                        <span className="text-xs text-[#45474c] font-medium">
                          318 of 412 candidates in active flow
                        </span>
                      </div>

                      {/* Segmented Multi-Color Progress Indicator */}
                      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e4e8f5] my-2.5">
                        <div className="h-full bg-[#497cff]" style={{ width: "68%" }}></div>
                        <div className="h-full bg-[#6137e0]" style={{ width: "18%" }}></div>
                        <div className="h-full bg-[#ba1a1a]" style={{ width: "8%" }}></div>
                        <div className="h-full bg-[#dee2ef]" style={{ width: "6%" }}></div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#45474c] pb-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#497cff]"></span>218 Active
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>58 Screen
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>24 Stalled
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#dee2ef]"></span>18 Offer
                        </span>
                      </div>

                      {/* Pipeline Item Rows */}
                      <div className="space-y-2.5 pt-1">
                        {/* Row 1: Aging alert */}
                        <div
                          onClick={() => openCandidateReview("Marcus Vance", "Senior Backend Engineer", "Req-204")}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-[#ffdad6] text-[#ba1a1a]">
                              <AlarmClock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#171c25] truncate">
                                Senior Platform Engineer (Req-204)
                              </p>
                              <p className="text-[11px] text-[#ba1a1a] font-medium">
                                3 in stage &gt;6 days
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold">
                            Aging alert
                          </span>
                        </div>

                        {/* Row 2: Final round */}
                        <div
                          onClick={() => openCandidateReview("Priya Sharma", "Lead Product Designer", "Req-108")}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-[#e4e8f5] text-[#171c25]">
                              <PenTool className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#171c25] truncate">
                                Lead Product Designer
                              </p>
                              <p className="text-[11px] text-[#45474c]">
                                1 candidate in Final Round
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#171c25] text-[10px] font-medium">
                            Final round
                          </span>
                        </div>

                        {/* Row 3: Action req */}
                        <div
                          onClick={() => openCandidateReview("Alex Mercer", "Data Platform Architect", "Req-301")}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-[#e4e8f5] text-[#171c25]">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#171c25] truncate">
                                Data Platform Architect
                              </p>
                              <p className="text-[11px] text-[#45474c]">
                                2 interviews to schedule
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#171c25] text-[10px] font-medium">
                            Action req.
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

              </div>

              {/* RIGHT 4 COLS: Persistent 'Waiting For You' Cockpit Panel */}
              <div className="xl:col-span-4 flex flex-col rounded-2xl bg-white p-6 shadow-md border border-[#dee2ef]/60 min-h-[580px]">
                
                {/* Panel Header & Filter Tabs */}
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-base font-bold text-[#171c25]">Waiting for you</h2>
                  <div className="flex items-center p-0.5 rounded-full bg-[#eaeefb]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("mine")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === "mine"
                          ? "bg-[#131c29] text-white shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                    >
                      Mine (4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        activeTab === "team"
                          ? "bg-[#131c29] text-white shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                    >
                      Team (9)
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#45474c] pb-4">
                  4 of 9 reviews require your decision. Oldest is 2 days.
                </p>

                {/* ACTION ITEM 1: Expanded Priority Candidate Card (Marcus Vance) */}
                <div className="flex flex-col rounded-xl bg-[#f0f3ff] p-4 border border-[#dee2ef]/60 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold tracking-wide">
                        DUE TODAY
                      </span>
                      <span className="font-mono text-[11px] text-[#75777c]">APP-3121</span>
                    </div>
                    <span className="text-[11px] text-[#75777c]">2h ago</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#171c25]">
                      Review application for Marcus Vance
                    </h3>
                    <p className="text-xs text-[#45474c]">
                      Senior Backend Engineer · <span className="font-mono text-[#75777c]">Req-204</span>
                    </p>
                  </div>

                  {/* Sourcing Evidence Progression Stepper */}
                  <div className="grid grid-cols-3 gap-2 py-0.5">
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-white shadow-2xs border border-[#dee2ef]/40">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#75777c]">Source</span>
                      <span className="text-xs font-semibold text-[#171c25] truncate">GitHub & Referral</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-white shadow-2xs border border-[#dee2ef]/40">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#75777c]">Evidence</span>
                      <span className="text-xs font-semibold text-[#171c25] truncate">11y Go & K8s</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-white shadow-2xs border border-[#dee2ef]/40">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#75777c]">Next Step</span>
                      <span className="text-xs font-semibold text-[#6137e0] truncate">Recruiter Tech Screen</span>
                    </div>
                  </div>

                  {/* AI Agent Reasoning Highlight Well */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#e7deff]/50 border border-[#cbbeff] text-[#1e0060]">
                    <Sparkles className="w-4 h-4 text-[#6137e0] mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#4b12cb]">Job Match: 94/100</span>
                        <span className="text-[10px] opacity-75">(Req-204 Rubric)</span>
                      </div>
                      <p className="text-xs leading-snug text-[#1e0060]">
                        Human-in-the-loop sign-off required before advancing stage.
                      </p>
                    </div>
                  </div>

                  {/* Decision Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openCandidateReview("Marcus Vance", "Senior Backend Engineer", "Req-204")}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#131c29] text-white text-xs font-semibold hover:bg-[#2c313a] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Review application</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCandidateReview("Marcus Vance", "Senior Backend Engineer", "Req-204")}
                      className="py-2 px-3 rounded-lg bg-white text-[#171c25] text-xs font-semibold hover:bg-[#eaeefb] transition-colors shadow-2xs border border-[#dee2ef] cursor-pointer"
                    >
                      View Rubric Evidence
                    </button>
                  </div>
                </div>

                {/* ACTION ITEM 2: Compact Row */}
                <div
                  onClick={() => openCandidateReview("Priya Sharma", "Lead Product Designer", "Req-108")}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f0f3ff] transition-colors mt-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#e7deff] text-[#1e0060] flex items-center justify-center font-bold text-xs shrink-0">
                      PS
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171c25] truncate group-hover:text-[#6137e0] transition-colors">
                        Calibrate scorecard: Priya Sharma
                      </p>
                      <p className="text-[11px] text-[#45474c] truncate">
                        Lead Product Designer
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#45474c] text-[10px] font-bold">
                      88% Match
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#75777c] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* ACTION ITEM 3: Compact Row */}
                <div
                  onClick={() => openCandidateReview("DevOps Architect", "Cloud Systems Team", "Req-302")}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f0f3ff] transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#e4e8f5] text-[#171c25] flex items-center justify-center font-bold text-xs shrink-0">
                      HF
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171c25] truncate group-hover:text-[#6137e0] transition-colors">
                        Submit client shortlist: DevOps Architect
                      </p>
                      <p className="text-[11px] text-[#45474c] truncate">
                        Halden Financial Corp
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#45474c] text-[10px] font-bold">
                      3 candidates
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#75777c] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Bottom Recruiter Efficiency Summary Card */}
                <div className="mt-auto pt-4">
                  <div className="p-3.5 rounded-xl bg-[#f0f3ff] border border-[#dee2ef]/60 grid grid-cols-2 gap-3 items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">
                        Median time to decide
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-bold text-[#171c25]">3h 40m</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#6137e0] font-semibold mt-0.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>1h faster</span>
                      </div>
                    </div>
                    <div className="flex flex-col border-l border-[#dee2ef]/60 pl-3">
                      <h4 className="text-xs font-bold text-[#171c25] truncate">
                        Marcus Vance
                      </h4>
                      <p className="text-[10px] text-[#45474c] truncate">
                        Senior Backend · <span className="font-mono text-[#75777c]">Req-204</span>
                      </p>
                      <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        Ready for decision
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <CoreFooter />

      {/* Modals */}
      <CreateJobModal
        open={isCreateJobOpen}
        onOpenChange={setIsCreateJobOpen}
      />

      <CandidateReviewModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        candidateName={selectedCandidate.name}
        roleTitle={selectedCandidate.role}
        reqCode={selectedCandidate.req}
      />
    </div>
  );
}
