"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  ChevronRight,
  ChevronLeft,
  Lock,
  LockOpen,
  MapPin,
  Link as LinkIcon,
  Terminal,
  Verified,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Edit3,
  FileText,
  Download,
  Maximize2,
  UserX,
  Bookmark,
  Send,
  X,
  Check,
  Shield,
  UnfoldVertical,
} from "lucide-react";

export default function CandidateReviewPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = (params?.id as string) || "cand-mv";

  // State
  const [activeTab, setActiveTab] = useState<"Assessment" | "Evidence" | "Notes">("Assessment");
  const [contactRevealed, setContactRevealed] = useState(false);
  const [highlightCitation, setHighlightCitation] = useState<string | null>(null);
  const [aiHighlightsOn, setAiHighlightsOn] = useState(true);
  const [scratchpadNote, setScratchpadNote] = useState(
    "Marcus is an exceptional fit for the Senior Backend / Distributed role. Outstanding track record at Stripe and Revolut. Verify multi-region failover drill protocols during the Architecture Round."
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [candidateStage, setCandidateStage] = useState<string>("Applied 2d ago");
  const [decisionTaken, setDecisionTaken] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleFocusCitation = (citeId: string) => {
    setHighlightCitation(citeId);
    const element = document.getElementById(citeId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightCitation(null);
    }, 2800);
  };

  const handleAdvance = () => {
    setDecisionTaken("Advanced to Technical Screen");
    setCandidateStage("Technical Screen (Round 1)");
    showToast(
      "Marcus Vance advanced to Technical Screen. Interview invitation drafted for Chris Miller."
    );
  };

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f9f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            {/* Top Toast Modal when advancing */}
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

            {/* Top Evaluation Meta & Sub-header Bar */}
            <div className="w-full flex flex-col gap-4 mb-6">
              {/* Breadcrumbs & Quick Session Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#45474c] font-medium">
                <div className="flex items-center gap-1.5">
                  <Link href="/candidates" className="hover:text-[#171c25] transition-colors">
                    Candidates
                  </Link>
                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">chevron_right</span>
                  <span className="text-[#171c25] font-semibold">Marcus Vance</span>
                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">chevron_right</span>
                  <span className="text-[#45474c]">Senior Platform Engineer</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#eaeefb] font-mono text-[11px] text-[#45474c] ml-1 font-semibold">
                    APP-3121
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaeefb] text-xs font-medium text-[#45474c]">
                    <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                    2 Screening Agents Synced
                  </span>
                  <span className="text-[#75777c] text-xs">Evaluated 14 min ago</span>
                </div>
              </div>

              {/* Candidate Identification & Action Strip */}
              <div className="w-full bg-white rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.02)] border border-[#dee2ef]/70 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#dee2ef]"
                      alt="Marcus Vance portrait"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5Qd-KmrMZ3ASt1r1VQ6FCU6te8mcIOR4feHoHm-tKIMK4qhyzH_SlaO-BTd6ZLCNGYnDSwkMH7e5hBNOaPZwybE8_FBqfTBPH1BZjHUPY63C2Qq0Qk5bYiJh2Ls8UKFpSk7wwEN6IWZfOjwzqsBDqRtDu51WK0yOLFp_UArS09lL8FywvJKi1EtdZDtFDEkOyuNxLpOQXmDEe7TnzqIVQt0Wbojw8UOJQ1s7Z2AMtFI3NDr6Vk8EWuQ"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#6137e0] text-white text-[10px] leading-tight font-bold">
                      Tier 1
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-[#171c25] tracking-tight">
                        Marcus Vance
                      </h1>
                      <span className="text-[#dee2ef]">·</span>
                      <span className="text-sm sm:text-base text-[#45474c] font-medium">
                        Senior Backend Engineer
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#eaeefb] text-[#45474c] font-mono text-xs font-semibold">
                        Req-204
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]"></span>
                        {candidateStage}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold">
                        Needs Recruiter Review
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#45474c] flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#75777c]">location_on</span>
                        San Francisco, CA / London / Remote
                      </span>
                      <span className="text-[#dee2ef]">·</span>
                      {!contactRevealed ? (
                        <button
                          onClick={() => setContactRevealed(true)}
                          className="text-[#6137e0] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">lock_open</span>
                          Reveal Contact Info
                        </button>
                      ) : (
                        <span className="text-[#171c25] font-mono font-semibold">
                          m.vance@infranet.io · +1 (415) 892-0149
                        </span>
                      )}
                      <span className="text-[#dee2ef]">·</span>
                      <div className="flex items-center gap-1">
                        <a href="https://github.com/mvance-infra" target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-[#eaeefb] text-[#45474c] hover:text-[#6137e0]">
                          <span className="material-symbols-outlined text-[16px]">link</span>
                        </a>
                        <a href="#" className="p-1 rounded hover:bg-[#eaeefb] text-[#45474c] hover:text-[#6137e0]">
                          <span className="material-symbols-outlined text-[16px]">terminal</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Application Switcher */}
                <div className="flex items-center gap-3 bg-[#f0f3ff] px-4 py-2 rounded-xl shrink-0 border border-[#dee2ef]/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                      Application Switcher
                    </span>
                    <div className="relative mt-0.5">
                      <select className="appearance-none bg-white text-xs font-bold text-[#171c25] py-1 px-2.5 pr-7 rounded-lg border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40 cursor-pointer">
                        <option>Req-204: Senior Backend Engineer [Active]</option>
                        <option>Req-198: Staff Distributed Systems [Archived]</option>
                      </select>
                      <span className="material-symbols-outlined text-[16px] text-[#75777c] absolute right-1.5 top-1.5 pointer-events-none">
                        unfold_more
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Workspace: Assessment + Document Viewer */}
            <div className="relative w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* LEFT WORKSPACE PANE: Assessment & Agent Reasoning (7 of 12 cols = ~58%) */}
              <section className="xl:col-span-7 flex flex-col gap-4">
                <div className="w-full bg-white rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  {/* Tabs Header */}
                  <div className="flex items-center justify-between border-b border-[#dee2ef]/60 pb-3 mb-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab("Assessment")}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "Assessment"
                            ? "bg-[#131c29] text-white shadow-xs"
                            : "text-[#45474c] hover:bg-[#eaeefb]"
                        }`}
                      >
                        Assessment (Active)
                      </button>
                      <button
                        onClick={() => setActiveTab("Evidence")}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          activeTab === "Evidence"
                            ? "bg-[#131c29] text-white shadow-xs"
                            : "text-[#45474c] hover:bg-[#eaeefb]"
                        }`}
                      >
                        Evidence
                      </button>
                      <button
                        onClick={() => setActiveTab("Notes")}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                          activeTab === "Notes"
                            ? "bg-[#131c29] text-white shadow-xs"
                            : "text-[#45474c] hover:bg-[#eaeefb]"
                        }`}
                      >
                        <span>Notes</span>
                        <span className="px-1.5 py-0.2 bg-[#dee2ef] text-[#171c25] rounded-full text-[10px] font-bold">
                          2
                        </span>
                      </button>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#f0f3ff] text-[#45474c] font-mono text-[11px] font-semibold border border-[#dee2ef]/50">
                      Req-204 Rubric v2.4
                    </span>
                  </div>

                  {/* Job Match Hero Box */}
                  <div className="w-full bg-[#f0f3ff] border border-[#dee2ef]/60 rounded-xl p-4 mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#6137e0] flex items-center justify-center text-white shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[22px]">verified</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-[#171c25]">
                            Job Match: 94/100
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-bold">
                            Exceeds Threshold
                          </span>
                        </div>
                        <p className="text-xs text-[#45474c] mt-0.5">
                          Evaluated against Req-204 Senior Backend Engineer Core Competency Framework.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => showToast("Rubric breakdown: 4 weighted dimensions configured for L6 Senior Platform")}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold shrink-0 flex items-center gap-1 border border-[#dee2ef] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      <span>Rubric Breakdown</span>
                    </button>
                  </div>

                  {/* Evaluation Rubric & Fit Metrics */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm sm:text-base font-bold text-[#171c25]">
                        Evaluation Rubric &amp; Fit Metrics
                      </h2>
                      <span className="text-xs text-[#45474c] font-medium">4 Criteria Weighted</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Metric 1 */}
                      <div className="bg-[#f9f9ff] rounded-xl p-3.5 flex flex-col justify-between border border-[#dee2ef]/60">
                        <span className="text-xs text-[#45474c] font-medium">Technical Stack Match</span>
                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-2xl font-bold text-[#171c25]">95</span>
                          <span className="text-xs text-[#75777c]">/100</span>
                        </div>
                        <div className="w-full bg-[#dee2ef] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#6137e0] h-full rounded-full w-[95%]"></div>
                        </div>
                        <span className="font-mono text-[10px] text-[#45474c] mt-2 truncate">
                          Go, K8s, eBPF, Consensus
                        </span>
                      </div>

                      {/* Metric 2 */}
                      <div className="bg-[#f9f9ff] rounded-xl p-3.5 flex flex-col justify-between border border-[#dee2ef]/60">
                        <span className="text-xs text-[#45474c] font-medium">Experience Depth</span>
                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-2xl font-bold text-[#171c25]">92</span>
                          <span className="text-xs text-[#75777c]">/100</span>
                        </div>
                        <div className="w-full bg-[#dee2ef] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#6137e0] h-full rounded-full w-[92%]"></div>
                        </div>
                        <span className="font-mono text-[10px] text-[#45474c] mt-2 truncate">
                          11 yrs tier-1 distributed infra
                        </span>
                      </div>

                      {/* Metric 3 */}
                      <div className="bg-[#f9f9ff] rounded-xl p-3.5 flex flex-col justify-between border border-[#dee2ef]/60">
                        <span className="text-xs text-[#45474c] font-medium">Leadership &amp; Mentorship</span>
                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-2xl font-bold text-[#171c25]">88</span>
                          <span className="text-xs text-[#75777c]">/100</span>
                        </div>
                        <div className="w-full bg-[#dee2ef] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#6137e0] h-full rounded-full w-[88%]"></div>
                        </div>
                        <span className="font-mono text-[10px] text-[#45474c] mt-2 truncate">
                          Led multi-squad infra team
                        </span>
                      </div>

                      {/* Metric 4 */}
                      <div className="bg-[#f9f9ff] rounded-xl p-3.5 flex flex-col justify-between border border-[#dee2ef]/60">
                        <span className="text-xs text-[#45474c] font-medium">Availability &amp; Notice</span>
                        <div className="flex items-baseline gap-1 my-1">
                          <span className="text-2xl font-bold text-[#171c25]">100</span>
                          <span className="text-xs text-[#75777c]">/100</span>
                        </div>
                        <div className="w-full bg-[#dee2ef] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#6137e0] h-full rounded-full w-[100%]"></div>
                        </div>
                        <span className="font-mono text-[10px] text-[#45474c] mt-2 truncate">
                          Immediate / 30d confirmed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Structured Evidence Trail */}
                  <div className="mb-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-bold text-[#171c25]">
                        Structured Evidence Trail
                      </h3>
                      <span className="font-mono text-xs text-[#75777c]">
                        2 Verified Citations · 1 Review Flag
                      </span>
                    </div>

                    {/* Citation 1: Go & gRPC */}
                    <div
                      onClick={() => handleFocusCitation("cite-golang")}
                      className="p-3.5 rounded-xl bg-[#f9f9ff] flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f0f3ff] transition-colors cursor-pointer group border border-[#dee2ef]/60"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-[#6137e0] mt-0.5">
                          check_circle
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-[#171c25]">
                            Expertise in Go &amp; gRPC
                          </span>
                          <span className="text-xs text-[#45474c]">
                            Designed next-gen edge traffic router handling 4.2M RPCs/sec, -38ms latency at Stripe.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span className="px-2 py-0.5 rounded bg-[#eaeefb] font-mono text-[11px] text-[#6137e0] group-hover:bg-[#6137e0] group-hover:text-white transition-colors font-semibold">
                          [Resume §3.4]
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-[#75777c]">arrow_forward</span>
                      </div>
                    </div>

                    {/* Citation 2: Terraform AWS */}
                    <div
                      onClick={() => handleFocusCitation("cite-k8s")}
                      className="p-3.5 rounded-xl bg-[#ffdad6]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#ffdad6]/70 transition-colors cursor-pointer group border border-[#ba1a1a]/20"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] mt-0.5">
                          help
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-[#171c25]">
                            Terraform AWS multi-region failover protocols
                          </span>
                          <span className="text-xs text-[#45474c]">
                            Multi-region topology verified; specific automated recovery metrics require verification in technical loop.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span className="px-2 py-0.5 rounded bg-white font-mono text-[11px] text-[#ba1a1a] font-semibold border border-[#ba1a1a]/30">
                          [Needs Verification §4.1]
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-[#75777c]">arrow_forward</span>
                      </div>
                    </div>
                  </div>

                  {/* Recruiter Scratchpad */}
                  <div className="w-full bg-[#f9f9ff] rounded-xl p-4 border border-[#dee2ef]/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#171c25] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">edit_note</span>
                        Recruiter Scratchpad
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] font-bold">
                          Visible to Hiring Committee
                        </span>
                        <input defaultChecked className="accent-[#6137e0] rounded cursor-pointer" type="checkbox" />
                      </div>
                    </div>
                    <textarea
                      value={scratchpadNote}
                      onChange={(e) => setScratchpadNote(e.target.value)}
                      className="w-full bg-white rounded-lg p-3 text-xs text-[#171c25] placeholder-[#75777c] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40 resize-none border border-[#dee2ef]/70 leading-relaxed"
                      rows={3}
                    />
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="font-mono text-[10px] text-[#75777c]">Auto-saved to APP-3121</span>
                      <button
                        onClick={() => showToast("✓ Note committed to candidate review record")}
                        className="px-3 py-1 rounded bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] font-semibold transition-colors cursor-pointer text-xs"
                      >
                        Commit Note
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* RIGHT WORKSPACE PANE: RESUME EVIDENCE & DOCUMENT VIEWER (5 of 12 cols = ~42%) */}
              <section className="xl:col-span-5 flex flex-col gap-4">
                <div className="w-full bg-[#e4e8f5] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] min-h-[720px] flex flex-col border border-[#dee2ef]">
                  {/* PDF Toolbar */}
                  <div className="w-full bg-white rounded-xl p-2.5 mb-3 flex items-center justify-between shadow-xs border border-[#dee2ef]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[20px] text-[#ba1a1a]">picture_as_pdf</span>
                      <span className="font-mono text-xs font-bold text-[#171c25] truncate max-w-[200px]">
                        Marcus_Vance_Staff_Platform_2025.pdf
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#f0f3ff] text-[#171c25] text-xs font-semibold">
                        <button className="hover:text-[#6137e0] cursor-pointer">
                          <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                        </button>
                        <span>1 / 3</span>
                        <button className="hover:text-[#6137e0] cursor-pointer">
                          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setAiHighlightsOn(!aiHighlightsOn)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          aiHighlightsOn
                            ? "bg-[#e7deff] text-[#1e0060]"
                            : "bg-[#dee2ef] text-[#45474c]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0] animate-pulse"></span>
                        AI Highlights {aiHighlightsOn ? "(ON)" : "(OFF)"}
                      </button>

                      <button className="p-1 rounded hover:bg-[#f0f3ff] text-[#75777c] hover:text-[#171c25]" title="Fullscreen">
                        <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                      </button>
                      <button className="p-1 rounded hover:bg-[#f0f3ff] text-[#75777c] hover:text-[#171c25]" title="Download PDF">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Page Canvas */}
                  <div className="w-full flex-1 bg-white rounded-xl p-6 shadow-sm overflow-y-auto text-xs text-[#171c25] flex flex-col gap-4 border border-[#dee2ef]">
                    {/* Resume Header */}
                    <div className="border-b border-[#dee2ef] pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#171c25] tracking-tight">
                            MARCUS VANCE
                          </h3>
                          <p className="text-xs text-[#45474c] font-semibold mt-0.5">
                            Staff Platform &amp; Distributed Infrastructure Engineer
                          </p>
                          <p className="font-mono text-[10px] text-[#75777c] mt-0.5">
                            San Francisco, CA / London / Remote · m.vance@infranet.io · github.com/mvance-infra
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-[#75777c]">PAGE 1 OF 3</span>
                      </div>

                      <div className="mt-3 p-2.5 rounded-lg bg-[#f0f3ff]">
                        <span className="text-[10px] uppercase font-bold text-[#75777c] tracking-wider block mb-1">
                          Executive Summary
                        </span>
                        <p className="text-[#171c25] text-xs leading-relaxed">
                          11+ years designing fault-tolerant petabyte-scale distributed ingestion engines, high-concurrency Go runtimes, and Kubernetes operators across tier-1 financial infrastructure.
                        </p>
                      </div>
                    </div>

                    {/* Experience History */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-[#dee2ef] pb-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#171c25]">
                          Experience History
                        </span>
                        <span className="font-mono text-[10px] text-[#75777c]">PARSED SECTION 2</span>
                      </div>

                      {/* Stripe Entry */}
                      <div
                        id="cite-golang"
                        className={`p-2.5 rounded-lg transition-all duration-300 ${
                          highlightCitation === "cite-golang"
                            ? "bg-[#e7deff] ring-2 ring-[#6137e0]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#171c25]">Staff Platform Engineer</span>
                          <span className="font-mono text-[11px] text-[#45474c]">2021 — PRESENT</span>
                        </div>
                        <span className="text-xs text-[#6137e0] font-semibold block">
                          Stripe · Core Infrastructure
                        </span>
                        <ul className="list-disc list-inside mt-2 space-y-1.5 text-xs text-[#171c25]">
                          <li className={`p-1.5 rounded transition-colors font-medium ${aiHighlightsOn ? "bg-[#e7deff]/60 text-[#1e0060]" : ""}`}>
                            <span className="font-bold text-[#6137e0]">[§3.4: Matched]</span> Designed next-gen edge traffic router in Go &amp; gRPC handling{" "}
                            <strong className="underline decoration-[#6137e0]">4.2M RPCs/sec, reducing p99 latency by 38ms</strong>.
                          </li>
                          <li className="text-[#45474c]">
                            Authored custom eBPF observability probes reducing cluster CPU throttling incidents by 34%.
                          </li>
                          <li className="text-[#45474c]">
                            Mentored 14 platform engineers across London and Dublin engineering hubs.
                          </li>
                        </ul>
                      </div>

                      {/* Revolut Entry */}
                      <div
                        id="cite-k8s"
                        className={`p-2.5 rounded-lg transition-all duration-300 ${
                          highlightCitation === "cite-k8s"
                            ? "bg-[#ffdad6] ring-2 ring-[#ba1a1a]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#171c25]">Lead Infrastructure Architect</span>
                          <span className="font-mono text-[11px] text-[#45474c]">2018 — 2021</span>
                        </div>
                        <span className="text-xs text-[#6137e0] font-semibold block">
                          Revolut · Global Scalability Group
                        </span>
                        <ul className="list-disc list-inside mt-2 space-y-1.5 text-xs text-[#171c25]">
                          <li className={`p-1.5 rounded transition-colors font-medium ${aiHighlightsOn ? "bg-[#ffdad6]/60 text-[#ba1a1a]" : ""}`}>
                            <span className="font-bold text-[#ba1a1a]">[§4.1: Needs Verification]</span> Multi-region failover topology spanning AWS &amp; EU-West, sustained zero-loss ledger ingestion during regional outages.
                          </li>
                          <li className="text-[#45474c]">
                            Scaled Kubernetes cluster infrastructure from 40 to 350 bare-metal &amp; cloud nodes with zero downtime.
                          </li>
                        </ul>
                      </div>

                      {/* Bloomberg Entry */}
                      <div className="p-2.5 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#171c25]">Senior Distributed Systems Engineer</span>
                          <span className="font-mono text-[11px] text-[#45474c]">2014 — 2018</span>
                        </div>
                        <span className="text-xs text-[#45474c] block">Bloomberg LP · Market Data Systems</span>
                        <p className="text-xs text-[#45474c] mt-1">
                          Low-latency market data caches, C++ to Go bridging with microsecond SLA guarantees.
                        </p>
                      </div>
                    </div>

                    {/* Education & Certifications */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#dee2ef]">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#171c25]">
                        Education &amp; Certifications
                      </span>
                      <div className="p-2.5 rounded-lg bg-[#f9f9ff] flex flex-col gap-1 border border-[#dee2ef]/60">
                        <span className="text-xs font-bold text-[#171c25]">
                          B.S. in Computer Science &amp; Applied Mathematics
                        </span>
                        <span className="text-xs text-[#45474c]">Imperial College London · First Class Honours</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded bg-[#eaeefb] font-mono text-[10px] text-[#45474c] font-semibold">
                            HashiCorp Certified Terraform Associate
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#eaeefb] font-mono text-[10px] text-[#45474c] font-semibold">
                            CKA (Certified Kubernetes Admin)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Footer Verification Hash */}
                  <div className="w-full mt-2 px-2 flex items-center justify-between text-[#75777c] font-mono text-[10px]">
                    <span>Sha256: 4b29f0...9e21 verified by Ingestion Agent</span>
                    <span>Parsed in 0.84s</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky Bottom Decision Dock */}
            <div className="sticky bottom-4 z-40 w-full mt-6 bg-white rounded-2xl p-4 sm:p-5 shadow-xl border border-[#dee2ef] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#e7deff] flex items-center justify-center text-[#6137e0] shrink-0">
                  <span className="material-symbols-outlined text-[22px]">recommend</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                      Recommended Decision
                    </span>
                    <span className="px-2 py-0.2 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] font-bold">
                      High Fit
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#171c25] font-bold">
                    {decisionTaken || "Advance to Technical Screen (Architecture Round)"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => showToast("Recruiter notes pinned to candidate profile")}
                  className="px-3.5 py-2 rounded-xl bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  Recruiter Notes
                </button>
                <button
                  onClick={() => showToast("Candidate moved to Archive: Not moving forward")}
                  className="px-3.5 py-2 rounded-xl border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">person_remove</span>
                  Reject Candidate
                </button>
                <button
                  onClick={() => showToast("Marcus Vance preserved in Talent Pool for future engineering roles")}
                  className="px-3.5 py-2 rounded-xl bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-[#171c25] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">bookmark</span>
                  Hold in Talent Pool
                </button>
                <button
                  onClick={handleAdvance}
                  className="px-5 py-2 rounded-xl bg-[#131c29] text-white hover:bg-black transition-all shadow-md text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  type="button"
                >
                  <span>Advance to Technical Screen</span>
                  <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CoreFooter />
    </>
  );
}
