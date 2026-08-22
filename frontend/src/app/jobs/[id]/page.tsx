"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import {
  ArrowLeft,
  Search,
  Bell,
  RotateCw,
  Edit2,
  Building2,
  Calendar,
  Users,
  Target,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  MoreVertical,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function JobDetailPage() {
  const [activeTab, setActiveTab] = useState("AI Ranked List");
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advancedSuccess, setAdvancedSuccess] = useState(false);
  const [expandedCand, setExpandedCand] = useState<string | null>("cand-1");

  const handleAdvance = () => {
    setIsAdvancing(true);
    setTimeout(() => {
      setIsAdvancing(false);
      setAdvancedSuccess(true);
    }, 600);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Breadcrumb & Icons */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
            <Link
              href="/jobs"
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/jobs" className="hover:text-zinc-900">
              Jobs
            </Link>
            <span>›</span>
            <span className="text-zinc-900 font-semibold">
              Senior Interface Designer
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-[1280px] w-full mx-auto space-y-6">
          {/* Job Title & Action Header */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                  Senior Backend Engineer
                </h1>
                <span className="bg-[#ede8dc] text-zinc-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  OPEN
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 text-xs font-semibold h-9 border-zinc-200 hover:bg-zinc-50 gap-1.5 shadow-none"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Re-run Match</span>
                </Button>

                <Button
                  size="sm"
                  className="bg-black hover:bg-zinc-800 text-white rounded-full px-4 text-xs font-semibold h-9 gap-1.5 shadow-none"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
              </div>
            </div>

            {/* Job Metadata Bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Engineering</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Created Jan 15</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>34 Candidates</span>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="border-b border-zinc-200/80 flex items-center gap-6">
            {[
              { id: "AI Ranked List", label: "AI Ranked List", hasDot: true },
              { id: "Pipeline Board", label: "Pipeline Board" },
              { id: "Job Details", label: "Job Details" },
              { id: "Activity", label: "Activity" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "pb-3 text-xs font-semibold flex items-center gap-1.5 relative transition-colors cursor-pointer",
                    isActive
                      ? "text-zinc-950 font-bold border-b-2 border-black -mb-[1px]"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.hasDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Candidates Ranking Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">CANDIDATE</div>
              <div className="col-span-3">AI MATCH SCORE</div>
              <div className="col-span-2">KEY SKILLS EXTRACTION</div>
              <div className="col-span-2 text-right pr-4">STAGE</div>
            </div>

            {/* Candidate 1: Priya Sharma (Expanded breakdown) */}
            <div className="border-b border-zinc-100">
              {/* Row Summary */}
              <div
                onClick={() =>
                  setExpandedCand(expandedCand === "cand-1" ? null : "cand-1")
                }
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer"
              >
                <div className="col-span-1 text-base font-bold text-zinc-950 text-center">
                  1
                </div>

                <div className="col-span-4 flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
                    alt="Priya Sharma"
                    className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-zinc-950">
                      Priya Sharma
                    </h4>
                    <p className="text-xs text-zinc-500 font-medium">
                      Staff Eng @ Stripe
                    </p>
                  </div>
                </div>

                <div className="col-span-3 space-y-1.5 pr-6">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold text-base text-zinc-950">95</span>
                    <span className="text-[10px] font-bold text-zinc-500">
                      Top Match
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-black h-full w-[95%] rounded-full" />
                  </div>
                </div>

                <div className="col-span-2 flex flex-wrap gap-1">
                  {["Python", "Kubernetes", "FastAPI"].map((s) => (
                    <span
                      key={s}
                      className="bg-zinc-100 text-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pr-2">
                  <span className="inline-flex items-center gap-1 bg-[#ede8dc] text-zinc-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                    <span>Interview</span>
                  </span>
                  <button className="text-zinc-400 hover:text-zinc-700 p-1">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded AI Reasoning Panel */}
              {expandedCand === "cand-1" && (
                <div className="px-6 pb-6 pt-2 bg-[#fcfbfa] border-t border-zinc-100 space-y-5 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                    {/* Left: AI Reasoning & Score Breakdown */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                        <Target className="w-4 h-4 stroke-[2]" />
                        <span>AI REASONING</span>
                      </div>

                      {/* Technical Depth */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-zinc-700">
                          <span>Technical Depth</span>
                          <span className="font-mono">9.2/10</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-black h-full w-[92%] rounded-full" />
                        </div>
                      </div>

                      {/* Quote Box */}
                      <div className="p-3.5 bg-white rounded-xl border border-zinc-200 text-xs italic text-zinc-700 leading-relaxed shadow-2xs">
                        <p>
                          &ldquo;Led migration of monolith to FastAPI microservices,
                          reducing p99 latency by 40%&rdquo;
                        </p>
                        <Link
                          href="/candidates/cand-001"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] not-italic font-bold text-zinc-950 hover:underline"
                        >
                          <span>↗ Source Resume</span>
                        </Link>
                      </div>

                      {/* System Design */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-zinc-700">
                          <span>System Design</span>
                          <span className="font-mono">8.5/10</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-black h-full w-[85%] rounded-full" />
                        </div>
                      </div>

                      {/* Potential Gap Alert */}
                      <div className="p-4 bg-red-50/50 border border-red-200/80 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
                          <span>Potential Gap Identified</span>
                        </div>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          No explicit evidence of managing Kubernetes clusters at
                          enterprise scale. Heavy reliance on managed PaaS
                          historically.
                        </p>
                      </div>
                    </div>

                    {/* Right: Suggested Interview Questions & Advance CTA */}
                    <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                          <MessageSquare className="w-4 h-4 stroke-[2]" />
                          <span>SUGGESTED QUESTIONS</span>
                        </div>

                        <div className="p-3.5 bg-white rounded-xl border border-zinc-200 text-xs text-zinc-700 shadow-2xs leading-relaxed">
                          &ldquo;Can you describe the specific microservices
                          architecture used in the FastAPI migration?&rdquo;
                        </div>

                        <div className="p-3.5 bg-white rounded-xl border border-zinc-200 text-xs text-zinc-700 shadow-2xs leading-relaxed">
                          &ldquo;How did you handle the migration cutover with zero
                          downtime?&rdquo;
                        </div>
                      </div>

                      {/* Advance Button */}
                      <Button
                        onClick={handleAdvance}
                        disabled={isAdvancing || advancedSuccess}
                        className="w-full bg-black hover:bg-zinc-800 text-white rounded-full h-10 text-xs font-semibold gap-2 shadow-sm cursor-pointer mt-4"
                      >
                        {advancedSuccess ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Advanced to Technical Screen ✓</span>
                          </>
                        ) : (
                          <span>
                            {isAdvancing
                              ? "Advancing..."
                              : "Advance to Technical Screen"}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate 2: Jane Doe */}
            <div className="border-b border-zinc-100">
              <div
                onClick={() =>
                  setExpandedCand(expandedCand === "cand-2" ? null : "cand-2")
                }
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer"
              >
                <div className="col-span-1 text-base font-bold text-zinc-950 text-center">
                  2
                </div>

                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                    JD
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-950">Jane Doe</h4>
                    <p className="text-xs text-zinc-500 font-medium">
                      Senior Backend @ Square
                    </p>
                  </div>
                </div>

                <div className="col-span-3 space-y-1.5 pr-6">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold text-base text-zinc-950">92</span>
                    <span className="text-[10px] font-bold text-zinc-400">
                      Strong Match
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-black h-full w-[92%] rounded-full" />
                  </div>
                </div>

                <div className="col-span-2 flex flex-wrap gap-1">
                  {["Python", "SQL", "AWS"].map((s) => (
                    <span
                      key={s}
                      className="bg-zinc-100 text-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pr-2">
                  <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <span>Qualified</span>
                  </span>
                  <button className="text-zinc-400 hover:text-zinc-700 p-1">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate 3: Mark Tan */}
            <div>
              <div
                onClick={() =>
                  setExpandedCand(expandedCand === "cand-3" ? null : "cand-3")
                }
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer"
              >
                <div className="col-span-1 text-base font-bold text-zinc-950 text-center">
                  3
                </div>

                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                    MT
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-950">Mark Tan</h4>
                    <p className="text-xs text-zinc-500 font-medium">
                      Infrastructure Engineer @ Robinhood
                    </p>
                  </div>
                </div>

                <div className="col-span-3 space-y-1.5 pr-6">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold text-base text-zinc-950">87</span>
                    <span className="text-[10px] font-bold text-zinc-400">
                      Match
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-black h-full w-[87%] rounded-full" />
                  </div>
                </div>

                <div className="col-span-2 flex flex-wrap gap-1">
                  {["Go", "Kubernetes", "Docker"].map((s) => (
                    <span
                      key={s}
                      className="bg-zinc-100 text-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pr-2">
                  <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <span>Screening</span>
                  </span>
                  <button className="text-zinc-400 hover:text-zinc-700 p-1">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
