"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ExternalLink,
  Search,
  Maximize2,
  Download,
  Mail,
  Archive,
  UserX,
  FileText,
  Lock,
  LockOpen,
  Info,
  Check,
  X,
  Share2,
  Paperclip,
  Tag,
  AtSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function CandidateAssessmentPage() {
  const params = useParams();
  const router = useRouter();

  // State
  const [contactRevealed, setContactRevealed] = useState(false);
  const [aiHighlightsOn, setAiHighlightsOn] = useState(true);
  const [activeCitationHighlight, setActiveCitationHighlight] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [candidateStage, setCandidateStage] = useState("Applied 2d ago");
  const [scratchpadNote, setScratchpadNote] = useState(
    "Candidate profile matches our L6 requirements closely. Verified compensation expectation is $260k base + equity, within our band. Elena to check if candidate is also interviewing at Datadog."
  );
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("Update on your Staff Platform Engineer application");
  const [messageBody, setMessageBody] = useState(
    "Hi Marcus,\n\nThank you for taking the time to apply for the Staff Platform Engineer role at Halden Financial. Our team has reviewed your background and we are excited to invite you to our Technical Architecture Screen."
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const scrollToCitation = (citeId: string) => {
    setActiveCitationHighlight(citeId);
    const el = document.getElementById(citeId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setActiveCitationHighlight(null);
    }, 3000);
  };

  const handleAdvance = () => {
    setCandidateStage("Technical Screen (Architecture Round)");
    showToast("Marcus Vance advanced to Technical Screen (Architecture Round). Invitation drafted.");
  };

  const handleHold = () => {
    showToast("Candidate held in Talent Pool for future requisitions.");
  };

  const handleReject = () => {
    showToast("Candidate marked as Rejected. Automated courteous notification scheduled.");
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      {/* Top Header */}
      <CoreHeader />

      {/* Main Workspace Body */}
      <main className="w-full pt-16 bg-[#f8f9ff] flex-1 pb-24">
        {/* Top Adaptive Split Viewport Banner */}
        <div className="w-full bg-[#f0f3ff] border-b border-[#dee2ef] py-2 px-4 sm:px-8">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#45474c]">
              <Info className="w-4 h-4 text-[#6137e0] shrink-0" />
              <span>
                Proposed prototype scope: Tablet supports touch drag-to-resize between assessment and document panes. (768px Adaptive Splitting)
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[#6137e0] uppercase shrink-0">
              VIEWPORT: 768PX OPTIMIZED
            </span>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-5">

          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-24 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
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

          {/* Subheader: Back Button & Stage Status */}
          <div className="flex items-center justify-between text-xs text-[#555a64]">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-1.5 font-bold text-[#111827] hover:text-[#6137e0] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Applications</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-[#b54708]">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Needs Recruiter Review
              </span>
              <span>•</span>
              <span className="font-medium text-[#555a64]">
                Owner: Elena Varga
              </span>
            </div>
          </div>

          {/* Candidate Profile Strip */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-[#dee2ef]/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <img
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#dee2ef]"
                  alt="Marcus Vance"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] tracking-tight">
                    Marcus Vance
                  </h1>
                  <span className="px-2 py-0.5 rounded-md bg-[#f0f3ff] text-[#45474c] text-xs font-mono font-bold">
                    Req-204
                  </span>
                  <span className="text-xs text-[#75777c]">
                    {candidateStage}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#555a64] mt-1 font-medium">
                  Staff Platform Engineer candidate • Distributed Systems & Observability
                </p>
              </div>
            </div>

            {/* Match Gauge & Action Buttons */}
            <div className="flex items-center gap-4 sm:gap-6 self-start md:self-center shrink-0">
              {/* Job Match Circular Badge */}
              <div className="flex items-center gap-2 bg-[#f8f9ff] px-3.5 py-2 rounded-2xl border border-[#dee2ef]/60">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[#dee2ef]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#6137e0]"
                      strokeDasharray="94, 100"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <Check className="w-3.5 h-3.5 text-[#6137e0] absolute" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#75777c] uppercase tracking-wider">
                    JOB MATCH
                  </span>
                  <span className="text-sm font-extrabold text-[#111827]">
                    94<span className="text-xs text-[#75777c]">/100</span>
                  </span>
                </div>
              </div>

              {/* Reveal Contact Info & Active pill */}
              <div className="flex items-center gap-2">
                {!contactRevealed ? (
                  <button
                    type="button"
                    onClick={() => setContactRevealed(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] text-xs font-bold text-[#141c27] hover:bg-[#f0f3ff] transition-all shadow-2xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#6137e0]" />
                    <span>Reveal Contact Info</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ecfdf3] border border-[#a6f4c5] text-xs font-mono font-bold text-[#027a48]">
                    <LockOpen className="w-3.5 h-3.5" />
                    <span>m.vance@infranet.io • +1 (415) 892-0149</span>
                  </div>
                )}

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f0f3ff] text-xs font-bold text-[#45474c] border border-[#dee2ef]/60"
                >
                  <span>Active (1)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2-Pane Adaptive Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT PANE (5 cols on lg/xl): Job-Match Assessment, Structured Evidence Trail, Scratchpad */}
            <div className="lg:col-span-5 flex flex-col gap-5">

              {/* Card 1: Job-Match Assessment */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/80 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6137e0]" />
                    <h2 className="text-sm font-bold text-[#111827]">
                      Job-Match Assessment
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#75777c]">
                    ROLE SPEC REQ-204
                  </span>
                </div>

                <div className="flex flex-col gap-3.5 pt-1">
                  {/* Technical Stack */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827]">Technical Stack</span>
                      <span className="font-bold text-[#6137e0]">95%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#dee2ef]/60 overflow-hidden">
                      <div className="bg-[#6137e0] h-full rounded-full" style={{ width: "95%" }}></div>
                    </div>
                    <span className="text-[11px] text-[#75777c]">
                      Go, gRPC, K8s, eBPF
                    </span>
                  </div>

                  {/* Experience Depth */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827]">Experience Depth</span>
                      <span className="font-bold text-[#6137e0]">92%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#dee2ef]/60 overflow-hidden">
                      <div className="bg-[#6137e0] h-full rounded-full" style={{ width: "92%" }}></div>
                    </div>
                    <span className="text-[11px] text-[#75777c]">
                      11 yrs tier-1 fintech
                    </span>
                  </div>

                  {/* Leadership */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827]">Leadership</span>
                      <span className="font-bold text-[#6137e0]">88%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#dee2ef]/60 overflow-hidden">
                      <div className="bg-[#6137e0] h-full rounded-full" style={{ width: "88%" }}></div>
                    </div>
                    <span className="text-[11px] text-[#75777c]">
                      Led 14-eng multi-squad
                    </span>
                  </div>

                  {/* Availability */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827]">Availability</span>
                      <span className="font-bold text-emerald-600">100%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#dee2ef]/60 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "100%" }}></div>
                    </div>
                    <span className="text-[11px] text-[#75777c]">
                      Immediate / 2-wk notice
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Structured Evidence Trail */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/80 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6137e0]" />
                    <h2 className="text-sm font-bold text-[#111827]">
                      Structured Evidence Trail
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#6137e0] text-xs font-bold border border-[#dee2ef]">
                    2 Extracts Linked
                  </span>
                </div>

                <div className="flex flex-col gap-3 pt-1">
                  {/* Extract 1: Go & gRPC */}
                  <div
                    onClick={() => scrollToCitation("resume-stripe-section")}
                    className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/80 hover:border-[#6137e0] transition-all cursor-pointer flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#111827] group-hover:text-[#6137e0]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Expertise in Go & gRPC
                      </span>
                      <span className="text-[11px] font-semibold text-[#6137e0] flex items-center gap-0.5">
                        Resume §3.4 <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-xs text-[#555a64] leading-relaxed">
                      Authored low-latency proxy serving 4.2M RPCs/sec with zero-copy buffer serialization in Go 1.22 at Stripe Core Fabric.
                    </p>
                    <span className="text-[10px] font-semibold text-[#75777c]">
                      Matched to Requirement: Core Ingestion Service Architecture
                    </span>
                  </div>

                  {/* Extract 2: Terraform AWS multi-region failover */}
                  <div
                    onClick={() => scrollToCitation("resume-revolut-section")}
                    className="p-3.5 rounded-xl bg-[#fffbf0] border border-[#fef08a] hover:border-amber-500 transition-all cursor-pointer flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#111827] group-hover:text-amber-700">
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        Terraform AWS multi-region failover
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-0.5">
                        Needs Verification §4.1 <Search className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-xs text-[#555a64] leading-relaxed">
                      Spearheaded active-active database partition failover. Cross-check during Tech Screen for actual RTO/RPO ownership versus pure Ops support.
                    </p>
                    <span className="text-[10px] font-semibold text-amber-700">
                      Flagged for Interview Stage: System Architecture Round
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Recruiter Scratchpad */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dee2ef]/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#75777c]" />
                    <h2 className="text-sm font-bold text-[#111827]">
                      Recruiter Scratchpad
                    </h2>
                  </div>
                  <span className="text-xs text-[#75777c]">
                    Auto-saved 1m ago
                  </span>
                </div>

                <textarea
                  value={scratchpadNote}
                  onChange={(e) => setScratchpadNote(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef] text-xs text-[#141c27] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40 resize-none leading-relaxed"
                  placeholder="Record observations, calibration notes, or follow-ups..."
                />

                <div className="flex items-center justify-between pt-1 text-xs text-[#75777c]">
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-1 hover:text-[#111827] transition-colors" title="Attach link">
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="p-1 hover:text-[#111827] transition-colors" title="Mention colleague">
                      <AtSign className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="p-1 hover:text-[#111827] transition-colors" title="Add tag">
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-medium text-[#555a64]">
                    Visible to Recruiting Panel
                  </span>
                </div>
              </div>

            </div>

            {/* RIGHT PANE (7 cols on lg/xl): Document Viewer with AI Highlighted Resume */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-[#dee2ef]/80 overflow-hidden flex flex-col min-h-[780px]">

                {/* PDF Toolbar */}
                <div className="bg-[#f8f9ff] px-4 py-3 border-b border-[#dee2ef] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-mono text-xs font-bold text-[#111827] truncate">
                      Marcus_Vance_Staff_Platform_2025.pdf
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAiHighlightsOn(!aiHighlightsOn)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        aiHighlightsOn
                          ? "bg-[#6137e0] text-white shadow-2xs"
                          : "bg-white text-[#555a64] border border-[#dee2ef]"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{aiHighlightsOn ? "AI Highlights (ON)" : "AI Highlights (OFF)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => showToast("Fullscreen Document Mode")}
                      className="p-1.5 rounded-lg bg-white border border-[#dee2ef] text-[#555a64] hover:text-[#111827]"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => showToast("Downloading Marcus_Vance_Staff_Platform_2025.pdf")}
                      className="p-1.5 rounded-lg bg-white border border-[#dee2ef] text-[#555a64] hover:text-[#111827]"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Document Paper Body */}
                <div className="p-8 sm:p-10 text-[#141c27] flex flex-col gap-6 overflow-y-auto max-h-[820px] font-sans">

                  {/* Document Header */}
                  <div className="border-b border-[#dee2ef] pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
                          MARCUS VANCE
                        </h2>
                        <p className="text-sm font-bold text-[#6137e0] mt-1">
                          Staff Platform & Distributed Infrastructure Engineer
                        </p>
                      </div>
                      <span className="text-xs text-[#75777c] font-medium">
                        San Francisco, CA • Remote Eligible
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#555a64] flex-wrap">
                      <span>github.com/mvance-infra</span>
                      <span>•</span>
                      <span>linkedin.com/in/marcus-vance</span>
                      <span>•</span>
                      <span>marcus.vance.eng@gmail.com</span>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-[#75777c] uppercase tracking-wider">
                      EXECUTIVE SUMMARY
                    </h3>
                    <p className="text-xs sm:text-sm text-[#141c27] leading-relaxed">
                      Platform engineering leader with 11+ years designing fault-tolerant, petabyte-scale distributed ingestion engines and kernel-level network proxies. Proven architect across tier-1 financial infrastructures with deep domain rigor in high-concurrency Go runtimes, Kubernetes operators, and zero-trust service meshes.
                    </p>
                  </div>

                  {/* Experience History */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-xs font-bold text-[#75777c] uppercase tracking-wider border-b border-[#dee2ef] pb-1.5">
                      EXPERIENCE HISTORY
                    </h3>

                    {/* Role 1: Stripe */}
                    <div
                      id="resume-stripe-section"
                      className={`flex flex-col gap-2 p-3 rounded-xl transition-all ${
                        activeCitationHighlight === "resume-stripe-section"
                          ? "ring-2 ring-[#6137e0] bg-[#f4f3ff]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111827] text-sm">
                          Staff Platform Engineer • Stripe
                        </span>
                        <span className="font-mono text-[#75777c]">
                          2021 — PRESENT
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#6137e0]">
                        Core Fabric & Gateway Infrastructure Group
                      </span>

                      <ul className="list-disc list-outside pl-4 space-y-2 text-xs text-[#141c27] leading-relaxed mt-1">
                        <li
                          className={`p-2 rounded-lg transition-colors ${
                            aiHighlightsOn
                              ? "bg-[#f4f3ff] border-l-4 border-[#6137e0] text-[#111827]"
                              : ""
                          }`}
                        >
                          <strong className="text-[#6137e0]">§3.4:</strong> Designed and led rollout of next-gen edge traffic router in Go & gRPC handling over <strong className="underline decoration-[#6137e0]">4.2M RPCs/sec, reducing tail latency (p99.9) by 38ms</strong> through zero-copy buffer pools and custom memory allocators.
                        </li>
                        <li>
                          Mentored 14 platform engineers across Americas and EMEA squads, standardizing canary rollout procedures and automated regression pipelines.
                        </li>
                        <li>
                          Architected eBPF tracing probes for granular TLS session decryption inside internal service mesh, cutting diagnostic MTTR during incidents by 64%.
                        </li>
                      </ul>
                    </div>

                    {/* Role 2: Revolut */}
                    <div
                      id="resume-revolut-section"
                      className={`flex flex-col gap-2 p-3 rounded-xl transition-all ${
                        activeCitationHighlight === "resume-revolut-section"
                          ? "ring-2 ring-amber-500 bg-[#fffbeb]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111827] text-sm">
                          Lead Infrastructure Architect • Revolut
                        </span>
                        <span className="font-mono text-[#75777c]">
                          2018 — 2021
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#6137e0]">
                        Global Cloud Operations & Resiliency
                      </span>

                      <ul className="list-disc list-outside pl-4 space-y-2 text-xs text-[#141c27] leading-relaxed mt-1">
                        <li
                          className={`p-2 rounded-lg transition-colors ${
                            aiHighlightsOn
                              ? "bg-[#fffbeb] border-l-4 border-amber-500 text-[#111827]"
                              : ""
                          }`}
                        >
                          <strong className="text-amber-700">§4.1:</strong> Orchestrated Terraform-driven AWS multi-region failover topology spanning us-east-1 and eu-west-1, sustaining uninterrupted ledger ingestion during isolated availability zone blackouts.
                        </li>
                        <li>
                          Migrated monolithic settlements pipeline to 120-node Kubernetes clusters managed via ArgoCD and declarative GitOps workflows.
                        </li>
                        <li>
                          Enforced SOC2 Type II compliance through immutable audit logs exported to distributed S3 cold-tier storage.
                        </li>
                      </ul>
                    </div>

                    {/* Role 3: Bloomberg LP */}
                    <div className="flex flex-col gap-2 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111827] text-sm">
                          Senior Distributed Systems Engineer • Bloomberg LP
                        </span>
                        <span className="font-mono text-[#75777c]">
                          2014 — 2018
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#555a64]">
                        Market Data Ticker Plant
                      </span>

                      <ul className="list-disc list-outside pl-4 space-y-2 text-xs text-[#141c27] leading-relaxed mt-1">
                        <li>
                          Maintained ultra-low-latency multicast ticker feeds processing raw quote spikes for global tier-1 investment bank subscribers.
                        </li>
                        <li>
                          Co-authored internal C++ to Go bridging libraries for high-throughput memory mapped circular ring buffers.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Education & Certifications */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#dee2ef]">
                    <h3 className="text-xs font-bold text-[#75777c] uppercase tracking-wider">
                      EDUCATION & CERTIFICATIONS
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <span className="font-bold text-[#111827]">
                        B.S. in Computer Science & Applied Mathematics
                      </span>
                      <span className="text-[#75777c]">
                        University of Washington, 2014
                      </span>
                    </div>
                    <p className="text-xs text-[#555a64]">
                      Certified Kubernetes Administrator (CKA) • HashiCorp Certified: Terraform Associate
                    </p>
                  </div>

                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Sticky Bottom Decision Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#dee2ef] py-3.5 px-4 sm:px-8 shadow-2xl">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6137e0] animate-pulse"></span>
            <div>
              <span className="text-[10px] font-bold text-[#75777c] uppercase tracking-wider block">
                RECOMMENDED DECISION
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827]">
                Advance to Technical Screen (Architecture Round)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setIsSendMessageOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] text-xs font-bold text-[#141c27] hover:bg-[#f0f3ff] transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-[#555a64]" />
              <span>Send Message</span>
            </button>

            <button
              type="button"
              onClick={handleHold}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] text-xs font-bold text-[#141c27] hover:bg-[#f0f3ff] transition-all cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-[#555a64]" />
              <span>Hold in Talent Pool</span>
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Reject Candidate</span>
            </button>

            <button
              type="button"
              onClick={handleAdvance}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-md cursor-pointer"
            >
              <span>Advance to Technical Screen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Double Footer Ribbons */}
      <footer className="w-full bg-white border-t border-[#dee2ef] pb-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#75777c] border-b border-[#f0f3ff]">
          <span>© 2025 CORE ATS Inc. AI-assisted recruitment workspace.</span>
          <span className="font-mono text-[11px]">
            Build 412.0 • Halden Global Production Node
          </span>
        </div>

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

      {/* Send Message Dialog */}
      <Dialog open={isSendMessageOpen} onOpenChange={setIsSendMessageOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#111827]">
              Send Candidate Message
            </DialogTitle>
            <DialogDescription className="text-xs text-[#555a64]">
              Send direct communication to Marcus Vance (m.vance@infranet.io).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3 text-xs">
            <div>
              <label className="font-semibold text-[#111827] block mb-1">Subject</label>
              <input
                type="text"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#dee2ef] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#111827] block mb-1">Message</label>
              <textarea
                rows={5}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#dee2ef] text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#6137e0] resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSendMessageOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#dee2ef] text-xs font-semibold text-[#555a64] hover:bg-[#f0f3ff]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSendMessageOpen(false);
                showToast("Candidate message sent to Marcus Vance");
              }}
              className="px-4 py-2 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black"
            >
              Send Dispatch
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
