"use client";

import { SymbolIcon } from "@/components/ui/symbol-icon";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { CandidateReviewModal } from "@/components/dashboard/candidate-review-modal";
import {
  fetchJobs,
  fetchJobCandidates,
  updateJobCandidateStage,
  getErrorMessage,
} from "@/lib/api";
import { JobRequisition, RankedCandidate } from "@/types/ats";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Terminal,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  MoreHorizontal,
  ArrowRight,
  RefreshCw,
  Star,
  Mail,
  Check,
  X,
  ExternalLink,
  Plus,
  LayoutGrid,
  Kanban,
  Table as TableIcon,
  ShieldCheck,
  UserCheck,
  Brain,
  SlidersHorizontal,
} from "lucide-react";

interface PipelineCardData {
  id: string;
  name: string;
  avatar?: string;
  stage: "Applied" | "Screening" | "Tech Interview" | "Offer" | "Hired";
  jobMatch?: number;
  timeInStage: string;
  source: string;
  tags?: string[];
  owner?: string;
  ownerAvatar?: string;
  statusNote?: string;
  salaryNote?: string;
  interviewer?: string;
  rating?: number;
  isProcessing?: boolean;
  actionRequired?: boolean;
  email?: string;
}

const DEFAULT_PIPELINE_CARDS: PipelineCardData[] = [
  // Applied
  {
    id: "cand-mv",
    name: "Marcus Vance",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBmpiO91aOaMavCHv-NiljXk26oUdApqC95PU7xA0b5lD1svYIFXaI0v7z9_MgQ2BR8dZC5nFwJnRTS87uWk26xolSVy46HlUcfuT5bdgzOCOIpRDt-Hak-mpR7wUHcHSAViPBhPJgbX_BP49Za7i1kokTErgaP0EITSLOnRmvdSS7v7zw6VZ1SOBMPadGUtjq7fjvVOynXL4b04utAKw7Sac3I8ifmkFmbH-8i3nz7WeTeyu8ohoQ0dA",
    stage: "Applied",
    jobMatch: 94,
    timeInStage: "4d in stage",
    source: "Referral",
    tags: ["11y exp", "Ex-Stripe", "Distributed Sys"],
    owner: "Elena V.",
    ownerAvatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDM5t6ISeAvgD2fFYxXR6cEqSm42Jac-Q_-xNGIwHtVtdDvbEnEeb2UUBMCATmi6D-iNvGmYrWYK-qYCnQxaCjXkWsZvQsKv8yTVB7NuKZHRhIiNSErApveE9ws7hqanVl1WjyDPm9bLYQlhtMYUDs1rrGVz3vEZCNsxDy4-KadIeDhwNAySx5dXxHoDM3RrxEbHYtSaQUkC6HBMyvwRW5Z-fAyiLtmXiyZR9YGpNNr1X5cKarUg8Cjdg",
    email: "marcus.vance@tech.co",
  },
  {
    id: "cand-sl",
    name: "Sarah Lin",
    stage: "Applied",
    timeInStage: "Just now",
    source: "LinkedIn",
    tags: ["AWS", "Terraform"],
    isProcessing: true,
    statusNote: "Resume Parsing in Progress",
    email: "sarah.lin@cloudeng.io",
  },
  // Screening
  {
    id: "cand-dk",
    name: "David K.",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCI0gTDoCrme-ZgbyTojBo9-yTiRwLcW2V_jJjIq_oN9Jh0bw-mmsmAXCxgXkpG9xKyqHAXi8KLf__nhtP8tDLxGnbXE-VqA7P-lf8gPM9gG13LzV1vG1egSy69FYu-XQDe86ah_lwTdhl7tBDiLAsyABDFirJaY7_nYAcBenVvgzUWbRlf3NzuNxz3YzS1-31wOKJDIi_ahj1kE4pL2_hy1ABbdbe_94628b5fH8-FXtqNGkrFJmHwOQ",
    stage: "Screening",
    jobMatch: 86,
    timeInStage: "2d in stage",
    source: "Careers Direct",
    actionRequired: true,
    statusNote:
      "Screening interview completed. Recruiter stage transition review required.",
    email: "david.k@platform-eng.net",
  },
  {
    id: "cand-ao",
    name: "Amara Okafor",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD_Ga71SMV47CI_ywP5uVCoPmPWmFH1YMeRmTKoUwjjr2iNvPCAVx19w9fytXl50OwGLNS64CONkmwD_ZXPBHl3X2I0iv5by65CkL4ttq9JEr2tI-qWhEovPFuW17AtY5KA2N650ByzH_rhjSpwraYtZpdBAKAphtizuQ9qJDOSxeOjn1W_4T7k3Ehg6AKgvfwUTaiSKa95xvYINGWeAZfCwck4c3FqTP4Ch73u3RxjSnWMEOr0j-2qkw",
    stage: "Screening",
    jobMatch: 91,
    timeInStage: "1d in stage",
    source: "Direct Sourced",
    statusNote:
      "Portfolio verified, needs compensation band alignment check.",
    salaryNote: "Salary: £110k",
    email: "amara.okafor@infrasystems.co.uk",
  },
  // Tech Interview
  {
    id: "cand-js",
    name: "Jordan Smith",
    stage: "Tech Interview",
    timeInStage: "3d in stage",
    source: "Referral",
    rating: 4.5,
    statusNote:
      "Architecture round completed by Lead Infra Eng. Highly recommended for offer review.",
    interviewer: "C. Miller",
    email: "jordan.smith@devops.net",
  },
  // Offer
  {
    id: "cand-er",
    name: "Elena Rostova",
    stage: "Offer",
    jobMatch: 98,
    timeInStage: "5d in stage",
    source: "Agency Submission",
    statusNote: "Offer letter drafted · $185k base + equity. Pending candidate review.",
    timeNote: "Sent 2 days ago",
    email: "elena.rostova@engineer.org",
  } as PipelineCardData & { timeNote?: string },
  // Hired
  {
    id: "cand-lc",
    name: "Liam Chen",
    stage: "Hired",
    timeInStage: "Signed Oct 02",
    source: "Campus Sourced",
    statusNote: "Accepted · Start date: Nov 1. Equipment provisioning in progress.",
    email: "liam.chen@alum.mit.edu",
  },
];

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState<JobRequisition[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("REQ-RE-204");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Draft" | "Archived">("Active");
  const [deptFilter, setDeptFilter] = useState<string>("Platform Core");
  const [ownerFilter, setOwnerFilter] = useState<string>("Elena Varga");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [activeSubTab, setActiveSubTab] = useState<
    "Pipeline (Board)" | "Overview" | "Applications" | "Interviews" | "Scorecards" | "Job Details"
  >("Pipeline (Board)");

  // Kanban candidates state
  const [pipelineCards, setPipelineCards] = useState<PipelineCardData[]>(DEFAULT_PIPELINE_CARDS);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("cand-dk");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<{
    name: string;
    role: string;
    req: string;
  }>({
    name: "David K.",
    role: "Senior Platform Engineer",
    req: "REQ-RE-204",
  });

  // Action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [batchAdvanceCount, setBatchAdvanceCount] = useState<number>(3);

  // Interviewer assign state
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    "Chris Miller (Lead Infra Engineer)"
  );
  const [interviewDate, setInterviewDate] = useState("Thu, Oct 12");
  const [interviewTime, setInterviewTime] = useState("14:00 - 15:00 BST");
  const [calendarInviteChecked, setCalendarInviteChecked] = useState(true);
  const [scorecardChecked, setScorecardChecked] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);

  // Load backend jobs
  useEffect(() => {
    let cancelled = false;
    fetchJobs()
      .then((jobs) => {
        if (!cancelled && jobs && jobs.length > 0) {
          setAllJobs(jobs);
        }
      })
      .catch((err) => {
        console.warn("Using default rich requisition dataset:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const selectedCandidate = useMemo(() => {
    return (
      pipelineCards.find((c) => c.id === selectedCandidateId) ||
      pipelineCards.find((c) => c.id === "cand-dk") ||
      pipelineCards[0]
    );
  }, [pipelineCards, selectedCandidateId]);

  // Stage transition dispatch action
  const handleConfirmMoveAndDispatch = () => {
    if (!selectedCandidate) return;
    setIsDispatching(true);

    setTimeout(() => {
      setIsDispatching(false);
      setPipelineCards((prev) =>
        prev.map((c) => {
          if (c.id === selectedCandidate.id) {
            return {
              ...c,
              stage: "Tech Interview",
              actionRequired: false,
              statusNote: `Interview scheduled with ${selectedInterviewer} on ${interviewDate} (${interviewTime}).`,
              rating: 4.8,
            };
          }
          return c;
        })
      );
      showToast(
        `✓ Candidate ${selectedCandidate.name} moved to Technical Interview & calendar invite dispatched!`
      );
    }, 800);
  };

  // Move card action
  const handleMoveCandidate = (cand: PipelineCardData) => {
    const stageFlow: Array<PipelineCardData["stage"]> = [
      "Applied",
      "Screening",
      "Tech Interview",
      "Offer",
      "Hired",
    ];
    const currentIndex = stageFlow.indexOf(cand.stage);
    if (currentIndex < stageFlow.length - 1) {
      const nextStage = stageFlow[currentIndex + 1];
      setPipelineCards((prev) =>
        prev.map((c) => (c.id === cand.id ? { ...c, stage: nextStage } : c))
      );
      showToast(`Moved ${cand.name} to ${nextStage}`);
    }
  };

  // Batch advance action
  const handleBatchAdvance = () => {
    setPipelineCards((prev) =>
      prev.map((c) => {
        if (c.stage === "Applied" && !c.isProcessing) {
          return { ...c, stage: "Screening", actionRequired: true };
        }
        return c;
      })
    );
    setBatchAdvanceCount(0);
    showToast("✓ Batch advanced 3 candidates from Applied to Screening with AI confidence scores!");
  };

  // Open review modal
  const handleOpenReview = (cand: PipelineCardData) => {
    setReviewCandidate({
      name: cand.name,
      role: "Senior Platform Engineer",
      req: "REQ-RE-204",
    });
    setIsReviewOpen(true);
  };

  // Stage grouped cards
  const columns: Array<{
    id: PipelineCardData["stage"];
    title: string;
    count: number;
    badgeBg: string;
  }> = [
    { id: "Applied", title: "Applied", count: 18, badgeBg: "bg-[#dee2ef] text-[#171c25]" },
    { id: "Screening", title: "Screening", count: 8, badgeBg: "bg-[#e7deff] text-[#1e0060]" },
    { id: "Tech Interview", title: "Tech Interview", count: 5, badgeBg: "bg-[#dee2ef] text-[#171c25]" },
    { id: "Offer", title: "Offer", count: 2, badgeBg: "bg-[#dee2ef] text-[#171c25]" },
    { id: "Hired", title: "Hired", count: 1, badgeBg: "bg-[#dee2ef] text-[#171c25]" },
  ];

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f9f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full">
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <Sparkles className="w-4 h-4 text-[#7a55fa] shrink-0" />
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

            {/* Top Command Context Bar */}
            <div className="flex flex-col gap-2 mb-6">
              {/* Breadcrumb & Agent Pulse */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#45474c] font-medium">
                  <span className="hover:text-[#171c25] cursor-pointer">Halden Talent</span>
                  <SymbolIcon name="chevron_right" className="text-[14px] text-[#75777c]" style={{ fontSize: "14px" }} />
                  <span className="text-[#171c25] font-semibold">Requisitions</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#e4e8f5] text-[#171c25]">
                    <span className="w-2 h-2 rounded-full bg-[#6137e0] animate-pulse"></span>
                    <span className="text-xs font-medium">AI-assisted pipeline checks active</span>
                    <span className="text-[#75777c]">·</span>
                    <span className="text-xs text-[#45474c]">42 rubric matches evaluated today</span>
                  </div>

                  <Link
                    href="/jobs/new"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#131c29] text-white hover:bg-[#2c313a] shadow-xs transition-all text-xs font-semibold cursor-pointer"
                  >
                    <SymbolIcon name="add" className="text-[16px]" style={{ fontSize: "16px" }} />
                    <span>Create job requisition</span>
                  </Link>
                </div>
              </div>

              {/* Title & Primary Filter Row */}
              <div className="flex flex-col min-[1440px]:flex-row min-[1440px]:items-end justify-between gap-4 pt-1">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#171c25] tracking-tight">
                    Requisitions &amp; Pipelines
                  </h1>
                  <p className="text-xs sm:text-sm text-[#45474c] mt-0.5">
                    Continuous automated talent flow and candidate progression for Halden engineering teams.
                  </p>
                </div>

                {/* Controls & Toggle */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Requisition Search */}
                  <div className="relative min-w-[220px]">
                    <SymbolIcon name="search" className="absolute left-2.5 top-2.5 text-[18px] text-[#75777c]" style={{ fontSize: "18px" }} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 bg-white rounded-lg text-xs text-[#171c25] placeholder:text-[#75777c] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40 shadow-xs border border-[#dee2ef] transition-all"
                      placeholder="Filter requisitions..."
                      type="text"
                    />
                  </div>

                  {/* Department Dropdown */}
                  <div className="relative">
                    <button
                      className="h-9 px-3 bg-white rounded-lg flex items-center gap-1.5 text-xs text-[#171c25] border border-[#dee2ef] shadow-xs hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                      type="button"
                    >
                      <span className="text-[#45474c]">Dept:</span>
                      <span className="font-medium">{deptFilter}</span>
                      <SymbolIcon name="expand_more" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                    </button>
                  </div>

                  {/* Owner Dropdown */}
                  <div className="relative">
                    <button
                      className="h-9 px-3 bg-white rounded-lg flex items-center gap-1.5 text-xs text-[#171c25] border border-[#dee2ef] shadow-xs hover:bg-[#f0f3ff] transition-colors cursor-pointer"
                      type="button"
                    >
                      <span className="text-[#45474c]">Owner:</span>
                      <span className="font-medium">{ownerFilter}</span>
                      <SymbolIcon name="expand_more" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                    </button>
                  </div>

                  {/* Board/Table Toggle */}
                  <div className="flex items-center p-1 bg-[#e4e8f5] rounded-lg">
                    <button
                      onClick={() => setViewMode("board")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === "board"
                          ? "bg-white text-[#171c25] shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                      type="button"
                    >
                      <SymbolIcon name="view_kanban" className="text-[16px]" style={{ fontSize: "16px" }} />
                      <span>Board</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-white text-[#171c25] shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                      type="button"
                    >
                      <SymbolIcon name="view_list" className="text-[16px]" style={{ fontSize: "16px" }} />
                      <span>Table</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-1">
                <button
                  onClick={() => setStatusFilter("All")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "All"
                      ? "bg-[#131c29] text-white shadow-xs"
                      : "bg-[#dee2ef] text-[#171c25] hover:bg-[#e4e8f5]"
                  }`}
                  type="button"
                >
                  All <span className="ml-1 opacity-75">14</span>
                </button>
                <button
                  onClick={() => setStatusFilter("Active")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "Active"
                      ? "bg-[#131c29] text-white shadow-xs"
                      : "bg-[#eaeefb] text-[#45474c] hover:bg-[#dee2ef] hover:text-[#171c25]"
                  }`}
                  type="button"
                >
                  Active{" "}
                  <span className="ml-1 font-mono text-[11px] bg-[#6137e0] px-1.5 py-0.2 rounded-full text-white">
                    11
                  </span>
                </button>
                <button
                  onClick={() => setStatusFilter("Draft")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "Draft"
                      ? "bg-[#131c29] text-white shadow-xs"
                      : "bg-[#eaeefb] text-[#45474c] hover:bg-[#dee2ef] hover:text-[#171c25]"
                  }`}
                  type="button"
                >
                  Draft <span className="ml-1 opacity-75">2</span>
                </button>
                <button
                  onClick={() => setStatusFilter("Archived")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "Archived"
                      ? "bg-[#131c29] text-white shadow-xs"
                      : "bg-[#eaeefb] text-[#45474c] hover:bg-[#dee2ef] hover:text-[#171c25]"
                  }`}
                  type="button"
                >
                  Archived <span className="ml-1 opacity-75">1</span>
                </button>
              </div>
            </div>

            {/* Primary Featured Requisition Command Container */}
            <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.02)] border border-[#dee2ef]/70 mb-6 flex flex-col gap-4">
              {/* Requisition Summary Header */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#131c29] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <SymbolIcon name="terminal" className="text-[26px]" style={{ fontSize: "26px" }} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#171c25] tracking-tight">
                        Senior Platform Engineer
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-bold">
                        High Priority
                      </span>
                      <span className="font-mono text-xs text-[#75777c] px-2 py-0.5 bg-[#f0f3ff] rounded font-medium">
                        REQ-RE-204
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#45474c]">
                      <span className="flex items-center gap-1">
                        <SymbolIcon name="schedule" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                        Full-time
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <SymbolIcon name="location_on" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                        London / Hybrid
                      </span>
                      <span>·</span>
                      <span>Halden Core Infrastructure</span>
                      <span>·</span>
                      <span className="flex items-center gap-1.5">
                        <img
                          className="w-4 h-4 rounded-full object-cover"
                          alt="Elena Varga"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDM5t6ISeAvgD2fFYxXR6cEqSm42Jac-Q_-xNGIwHtVtdDvbEnEeb2UUBMCATmi6D-iNvGmYrWYK-qYCnQxaCjXkWsZvQsKv8yTVB7NuKZHRhIiNSErApveE9ws7hqanVl1WjyDPm9bLYQlhtMYUDs1rrGVz3vEZCNsxDy4-KadIeDhwNAySx5dXxHoDM3RrxEbHYtSaQUkC6HBMyvwRW5Z-fAyiLtmXiyZR9YGpNNr1X5cKarUg8Cjdg"
                        />
                        Owner: Elena Varga
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Metrics Pill Strip */}
                <div className="flex flex-wrap items-center gap-2 xl:gap-3 bg-[#f0f3ff] p-2 rounded-xl">
                  <div className="px-2.5 py-1 text-center">
                    <div className="text-base sm:text-lg font-bold text-[#171c25]">48</div>
                    <div className="text-[11px] font-semibold text-[#45474c]">Applied</div>
                  </div>
                  <div className="w-px h-6 bg-[#dee2ef]"></div>
                  <div className="px-2.5 py-1 text-center">
                    <div className="text-base sm:text-lg font-bold text-[#6137e0]">12</div>
                    <div className="text-[11px] font-semibold text-[#45474c]">Screening</div>
                  </div>
                  <div className="w-px h-6 bg-[#dee2ef]"></div>
                  <div className="px-2.5 py-1 text-center">
                    <div className="text-base sm:text-lg font-bold text-[#171c25]">6</div>
                    <div className="text-[11px] font-semibold text-[#45474c]">Interview</div>
                  </div>
                  <div className="w-px h-6 bg-[#dee2ef]"></div>
                  <div className="px-2.5 py-1 text-center">
                    <div className="text-base sm:text-lg font-bold text-[#171c25]">2</div>
                    <div className="text-[11px] font-semibold text-[#45474c]">Offer</div>
                  </div>
                  <div className="w-px h-6 bg-[#dee2ef]"></div>
                  <div className="px-2.5 py-1 text-center">
                    <div className="text-base sm:text-lg font-bold text-[#171c25]">1</div>
                    <div className="text-[11px] font-semibold text-[#45474c]">Hired</div>
                  </div>
                  <div className="w-px h-6 bg-[#dee2ef]"></div>
                  <div className="px-3 py-1 bg-white rounded-lg text-left shadow-2xs border border-[#dee2ef]/50">
                    <div className="text-[10px] font-semibold text-[#75777c] uppercase tracking-wider">
                      Target Close
                    </div>
                    <div className="text-xs text-[#171c25] font-bold">15 Nov 2025</div>
                  </div>
                </div>
              </div>

              {/* Sub-navigation Tabs */}
              <div className="flex items-center gap-1 pt-1 overflow-x-auto border-t border-[#dee2ef]/60">
                <button
                  onClick={() => setActiveSubTab("Pipeline (Board)")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeSubTab === "Pipeline (Board)"
                      ? "bg-[#eaeefb] text-[#171c25]"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  <SymbolIcon name="developer_board" className="text-[16px] text-[#6137e0]" style={{ fontSize: "16px" }} />
                  <span>Pipeline (Board)</span>
                </button>
                <button
                  onClick={() => setActiveSubTab("Overview")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeSubTab === "Overview"
                      ? "bg-[#eaeefb] text-[#171c25] font-semibold"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveSubTab("Applications")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    activeSubTab === "Applications"
                      ? "bg-[#eaeefb] text-[#171c25] font-semibold"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  <span>Applications</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#eaeefb] text-[#171c25] font-mono text-[10px]">
                    48
                  </span>
                </button>
                <button
                  onClick={() => setActiveSubTab("Interviews")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    activeSubTab === "Interviews"
                      ? "bg-[#eaeefb] text-[#171c25] font-semibold"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  <span>Interviews</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#eaeefb] text-[#171c25] font-mono text-[10px]">
                    6
                  </span>
                </button>
                <button
                  onClick={() => setActiveSubTab("Scorecards")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeSubTab === "Scorecards"
                      ? "bg-[#eaeefb] text-[#171c25] font-semibold"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  Scorecards
                </button>
                <button
                  onClick={() => setActiveSubTab("Job Details")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeSubTab === "Job Details"
                      ? "bg-[#eaeefb] text-[#171c25] font-semibold"
                      : "text-[#45474c] hover:text-[#171c25] hover:bg-[#f0f3ff]"
                  }`}
                  type="button"
                >
                  Job Details
                </button>
              </div>
            </div>

            {/* View Mode: Kanban Board vs Table */}
            {viewMode === "board" ? (
              /* Main Pipeline Canvas with Side Action Dialog */
              <div className="grid min-w-0 grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* 5-Column Kanban Board (8 Columns Desktop when drawer open, 12 when closed) */}
                <div className={`${isDrawerOpen ? "xl:col-span-8" : "xl:col-span-12"} min-w-0 flex flex-col gap-4`}>
                  {/* Agent Copilot Banner for this Stage */}
                  <div className="bg-white rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#e7deff] flex items-center justify-center text-[#1e0060] shrink-0">
                        <SymbolIcon name="auto_awesome" className="text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#171c25] flex items-center gap-2">
                          Screening Agent 04 · Recommendation ready
                          <span className="px-2 py-0.2 rounded-full bg-[#cbbeff] text-[#1e0060] text-[10px] uppercase font-bold tracking-wider">
                            Autonomous
                          </span>
                        </div>
                        <p className="text-xs text-[#45474c] mt-0.5">
                          David K. passed conversational architecture check with 86% baseline confidence. Ready for Lead Infra Eng review.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleBatchAdvance}
                      disabled={batchAdvanceCount === 0}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                        batchAdvanceCount > 0
                          ? "bg-[#eaeefb] hover:bg-[#e4e8f5] text-[#171c25]"
                          : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      }`}
                      type="button"
                    >
                      {batchAdvanceCount > 0 ? `Batch Advance (${batchAdvanceCount})` : "All Advanced"}
                    </button>
                  </div>

                  {/* Horizontal 5-Column Kanban Board */}
                  <div className="grid grid-cols-1 md:grid-cols-[repeat(5,minmax(240px,1fr))] gap-3 items-start overflow-x-auto pb-4">
                    {columns.map((col) => {
                      const colCards = pipelineCards.filter((c) => c.stage === col.id);
                      return (
                        <div key={col.id} className="flex min-w-0 flex-col gap-2.5">
                          {/* Column Header */}
                          <div className="flex items-center justify-between px-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#171c25]">{col.title}</span>
                              <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold ${col.badgeBg}`}>
                                {colCards.length}
                              </span>
                            </div>
                            <button className="text-[#75777c] hover:text-[#171c25]" type="button">
                              <SymbolIcon name="more_horiz" className="text-[16px]" style={{ fontSize: "16px" }} />
                            </button>
                          </div>

                          {/* Cards */}
                          {colCards.map((card) => {
                            const isSelected = selectedCandidateId === card.id;

                            // CARD: David K. (Screening)
                            if (card.id === "cand-dk") {
                              return (
                                <div
                                  key={card.id}
                                  onClick={() => {
                                    setSelectedCandidateId(card.id);
                                    setIsDrawerOpen(true);
                                  }}
                                  className={`bg-white rounded-xl p-3 shadow-md ring-2 ring-[#6137e0] flex flex-col gap-2.5 cursor-pointer relative transition-all ${
                                    isSelected ? "shadow-lg" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <img
                                        className="w-7 h-7 rounded-full object-cover"
                                        alt={card.name}
                                        src={card.avatar}
                                      />
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25] flex items-center gap-1">
                                          {card.name}
                                          <SymbolIcon name="check_circle" className="text-[#6137e0] text-[14px]" style={{ fontSize: "14px" }} />
                                        </div>
                                        <div className="font-mono text-[10px] text-[#75777c]">{card.timeInStage}</div>
                                      </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-[#e4e8f5] text-[#171c25] font-mono text-[10px] font-bold">
                                      Job Match: {card.jobMatch}/100
                                    </span>
                                  </div>

                                  <div className="p-2 rounded bg-[#f0f3ff] text-[#45474c] text-[11px] leading-relaxed">
                                    {card.statusNote}
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] text-[#6137e0] font-bold">Action Required</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCandidateId(card.id);
                                        setIsDrawerOpen(true);
                                      }}
                                      className="px-2 py-0.5 rounded bg-[#131c29] text-white text-[11px] font-semibold shadow-xs flex items-center gap-1 hover:bg-[#2c313a] transition-colors cursor-pointer"
                                      type="button"
                                    >
                                      <span>Move</span>
                                      <SymbolIcon name="chevron_right" className="text-[12px]" style={{ fontSize: "12px" }} />
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Marcus Vance
                            if (card.id === "cand-mv") {
                              return (
                                <div
                                  key={card.id}
                                  onClick={() => {
                                    setSelectedCandidateId(card.id);
                                    setIsDrawerOpen(true);
                                  }}
                                  className="bg-white rounded-xl p-3 shadow-xs hover:shadow-md border border-[#dee2ef]/70 transition-shadow flex flex-col gap-2.5 group cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <img
                                        className="w-7 h-7 rounded-full object-cover"
                                        alt={card.name}
                                        src={card.avatar}
                                      />
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25] group-hover:text-[#6137e0] transition-colors">
                                          {card.name}
                                        </div>
                                        <div className="font-mono text-[10px] text-[#75777c]">
                                          {card.timeInStage} · {card.source}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-[#e4e8f5] text-[#171c25] font-mono text-[10px] font-bold">
                                      Job Match: {card.jobMatch}/100
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    {card.tags?.map((t) => (
                                      <span
                                        key={t}
                                        className="px-1.5 py-0.5 rounded bg-[#f0f3ff] text-[#45474c] font-mono text-[10px]"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[#45474c] text-[11px]">
                                    <span className="flex items-center gap-1 text-[#75777c]">
                                      <SymbolIcon name="person" className="text-[14px]" style={{ fontSize: "14px" }} />
                                      {card.owner}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveCandidate(card);
                                      }}
                                      className="px-2 py-0.5 rounded bg-[#eaeefb] hover:bg-[#6137e0] hover:text-white text-[#171c25] text-[11px] font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                                      type="button"
                                    >
                                      <span>Move</span>
                                      <SymbolIcon name="arrow_forward" className="text-[12px]" style={{ fontSize: "12px" }} />
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Sarah Lin (Resume Ingestion in progress)
                            if (card.id === "cand-sl") {
                              return (
                                <div
                                  key={card.id}
                                  className="bg-white rounded-xl p-3 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-2.5 opacity-90 cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-[#dee2ef] text-[#171c25] text-[11px] flex items-center justify-center font-bold">
                                        SL
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25]">{card.name}</div>
                                        <div className="font-mono text-[10px] text-[#75777c]">
                                          {card.timeInStage} · {card.source}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="w-2 h-2 rounded-full bg-[#7a55fa] animate-ping"></span>
                                  </div>

                                  {/* Ingestion Status */}
                                  <div className="px-2 py-1 rounded bg-[#e7deff]/60 flex items-center gap-1.5 text-[#1e0060] text-[11px] font-semibold">
                                    <SymbolIcon name="sync" className="text-[14px] animate-spin" style={{ fontSize: "14px" }} />
                                    <span>{card.statusNote}</span>
                                  </div>

                                  <div className="flex flex-wrap gap-1">
                                    {card.tags?.map((t) => (
                                      <span
                                        key={t}
                                        className="px-1.5 py-0.5 rounded bg-[#f0f3ff] text-[#45474c] font-mono text-[10px]"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Amara Okafor
                            if (card.id === "cand-ao") {
                              return (
                                <div
                                  key={card.id}
                                  onClick={() => {
                                    setSelectedCandidateId(card.id);
                                    setIsDrawerOpen(true);
                                  }}
                                  className="bg-white rounded-xl p-3 shadow-xs hover:shadow-md border border-[#dee2ef]/70 transition-shadow flex flex-col gap-2.5 cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <img
                                        className="w-7 h-7 rounded-full object-cover"
                                        alt={card.name}
                                        src={card.avatar}
                                      />
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25]">{card.name}</div>
                                        <div className="font-mono text-[10px] text-[#75777c]">{card.timeInStage}</div>
                                      </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-[#e4e8f5] text-[#171c25] font-mono text-[10px] font-bold">
                                      Job Match: {card.jobMatch}/100
                                    </span>
                                  </div>

                                  <div className="p-2 rounded bg-[#f0f3ff] text-[#45474c] text-[11px]">
                                    {card.statusNote}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[#45474c] text-[11px]">
                                    <span className="font-mono text-[10px] text-[#75777c] font-medium">
                                      {card.salaryNote}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenReview(card);
                                      }}
                                      className="px-2 py-0.5 rounded bg-[#eaeefb] hover:bg-[#e4e8f5] text-[#171c25] text-[11px] font-semibold transition-colors cursor-pointer"
                                      type="button"
                                    >
                                      Review
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Jordan Smith (Tech Interview)
                            if (card.id === "cand-js") {
                              return (
                                <div
                                  key={card.id}
                                  onClick={() => {
                                    setSelectedCandidateId(card.id);
                                    setIsDrawerOpen(true);
                                  }}
                                  className="bg-white rounded-xl p-3 shadow-xs hover:shadow-md border border-[#dee2ef]/70 transition-shadow flex flex-col gap-2.5 cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-[#131c29] text-white text-[11px] flex items-center justify-center font-bold">
                                        JS
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25]">{card.name}</div>
                                        <div className="font-mono text-[10px] text-[#75777c]">{card.timeInStage}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 text-[#6137e0] font-mono text-xs font-bold">
                                      <SymbolIcon name="star" className="text-[14px]" style={{ fontSize: "14px" }} />
                                      <span>{card.rating}</span>
                                    </div>
                                  </div>

                                  <div className="p-2 rounded bg-[#f0f3ff] text-[#45474c] text-[11px]">
                                    {card.statusNote}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[#45474c] text-[11px]">
                                    <span className="text-[10px] text-[#75777c] font-medium">
                                      Interviewer: {card.interviewer}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-[#dee2ef] text-[#171c25] text-[10px] font-bold">
                                      Passed
                                    </span>
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Elena Rostova (Offer)
                            if (card.id === "cand-er") {
                              return (
                                <div
                                  key={card.id}
                                  onClick={() => {
                                    setSelectedCandidateId(card.id);
                                    setIsDrawerOpen(true);
                                  }}
                                  className="bg-white rounded-xl p-3 shadow-xs hover:shadow-md border border-[#dee2ef]/70 transition-shadow flex flex-col gap-2.5 cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-[#6137e0] text-white text-[11px] flex items-center justify-center font-bold">
                                        ER
                                      </div>
                                      <div>
                                        <div className="text-xs font-bold text-[#171c25]">{card.name}</div>
                                        <div className="font-mono text-[10px] text-[#75777c]">{card.timeInStage}</div>
                                      </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-[#e4e8f5] text-[#171c25] font-mono text-[10px] font-bold">
                                      98%
                                    </span>
                                  </div>

                                  <div className="p-2 rounded bg-[#f0f3ff] text-[#45474c] text-[11px]">
                                    {card.statusNote}
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-[11px]">
                                    <span className="text-[#75777c]">Sent 2 days ago</span>
                                    <SymbolIcon name="mail" className="text-[16px] text-[#6137e0]" style={{ fontSize: "16px" }} />
                                  </div>
                                </div>
                              );
                            }

                            // CARD: Liam Chen (Hired)
                            return (
                              <div
                                key={card.id}
                                onClick={() => {
                                  setSelectedCandidateId(card.id);
                                  setIsDrawerOpen(true);
                                }}
                                className="bg-white rounded-xl p-3 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-2.5 cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-[#dee2ef] text-[#171c25] text-[11px] flex items-center justify-center font-bold">
                                      LC
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-[#171c25]">{card.name}</div>
                                      <div className="font-mono text-[10px] text-[#75777c]">{card.timeInStage}</div>
                                    </div>
                                  </div>
                                  <SymbolIcon name="verified" className="text-[#6137e0] text-[18px]" style={{ fontSize: "18px" }} />
                                </div>

                                <div className="p-2 rounded bg-[#f0f3ff] text-[#45474c] text-[11px]">
                                  {card.statusNote}
                                </div>

                                <div className="flex items-center justify-between pt-1 text-[11px] text-[#45474c]">
                                  <span className="font-semibold text-emerald-700">Onboarding active</span>
                                  <SymbolIcon name="arrow_outward" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Stage Action Drawer / Dialog (4 Columns Desktop) */}
                {isDrawerOpen && (
                  <div className="xl:col-span-4 bg-white rounded-xl p-5 sm:p-6 shadow-md border border-[#dee2ef]/70 flex flex-col gap-4 sticky top-20">
                    {/* Action Drawer Header */}
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#dee2ef]/60">
                      <div>
                        <div className="font-mono text-[11px] text-[#6137e0] font-bold uppercase tracking-wider mb-0.5">
                          Stage Transition
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-[#171c25]">
                          Move to Technical Interview
                        </h3>
                        <p className="text-xs text-[#45474c] mt-0.5">
                          Candidate:{" "}
                          <strong className="text-[#171c25] font-bold">
                            {selectedCandidate?.name || "David K."}
                          </strong>{" "}
                          · Current: Screening ({selectedCandidate?.jobMatch || 86}% Match)
                        </p>
                      </div>
                      <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="w-8 h-8 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                      >
                        <SymbolIcon name="close" className="text-[18px]" style={{ fontSize: "18px" }} />
                      </button>
                    </div>

                    {/* AI Screening Assessment Summary Box */}
                    <div className="p-3.5 rounded-lg bg-[#f0f3ff] flex flex-col gap-2 border border-[#dee2ef]/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[#6137e0] text-xs font-bold">
                          <SymbolIcon name="psychology" className="text-[16px]" style={{ fontSize: "16px" }} />
                          <span>AI-Assisted Screening Summary</span>
                        </div>
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded text-[#171c25] font-semibold border border-[#dee2ef]/60">
                          Rubric Verified
                        </span>
                      </div>
                      <p className="text-xs text-[#45474c] leading-relaxed">
                        David demonstrated deep grasp of Kafka event sourcing and distributed consistency models. No red flags identified during 18-minute conversational screening.
                      </p>
                    </div>

                    {/* Stage Advance Form Fields */}
                    <div className="flex flex-col gap-4">
                      {/* Assigned Interviewer */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#171c25] font-bold flex items-center justify-between">
                          <span>Assign Technical Interviewer</span>
                          <span className="text-[#6137e0] text-[10px] font-bold uppercase">Recommended</span>
                        </label>
                        <div className="relative">
                          <div className="w-full h-10 px-3 bg-[#f0f3ff] rounded-lg flex items-center justify-between text-[#171c25] text-xs font-medium cursor-pointer hover:bg-[#eaeefb] transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-[#131c29] text-white text-[10px] flex items-center justify-center font-bold">
                                CM
                              </div>
                              <span>{selectedInterviewer}</span>
                            </div>
                            <SymbolIcon name="unfold_more" className="text-[18px] text-[#75777c]" style={{ fontSize: "18px" }} />
                          </div>
                        </div>
                      </div>

                      {/* Scheduled Date / Availability */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#171c25] font-bold">Interview Scheduling Window</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-10 px-3 bg-[#f0f3ff] rounded-lg flex items-center gap-2 text-[#171c25] text-xs font-medium">
                            <SymbolIcon name="calendar_today" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                            <span>{interviewDate}</span>
                          </div>
                          <div className="h-10 px-3 bg-[#f0f3ff] rounded-lg flex items-center gap-2 text-[#171c25] text-xs font-medium">
                            <SymbolIcon name="schedule" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                            <span>{interviewTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Candidate Notification Template Preview */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#171c25] font-bold">
                            Automated Candidate Invitation
                          </label>
                          <button
                            type="button"
                            className="text-[#6137e0] text-[11px] font-semibold hover:underline cursor-pointer"
                          >
                            Edit Template
                          </button>
                        </div>
                        <div className="p-3 bg-[#f0f3ff] rounded-lg text-[#45474c] font-mono text-[11px] leading-relaxed border border-[#dee2ef]/40">
                          <span className="text-[#75777c]">To:</span> {selectedCandidate?.email || "david.k@platform-eng.net"}
                          <br />
                          <span className="text-[#75777c]">Subject:</span> Halden Platform Engineering · Technical Architecture Stage
                          <br />
                          <br />
                          &quot;Hi {selectedCandidate?.name || "David"}, thanks for completing the technical screening. The team is excited to invite you to our 60-minute system design round with Chris Miller...&quot;
                        </div>
                      </div>

                      {/* Checkbox Options */}
                      <div className="flex flex-col gap-2 pt-1 text-xs text-[#45474c]">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            checked={calendarInviteChecked}
                            onChange={(e) => setCalendarInviteChecked(e.target.checked)}
                            className="w-4 h-4 rounded text-[#6137e0] accent-[#6137e0] cursor-pointer"
                            type="checkbox"
                          />
                          <span>Send automated calendar invite &amp; preparation briefing</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            checked={scorecardChecked}
                            onChange={(e) => setScorecardChecked(e.target.checked)}
                            className="w-4 h-4 rounded text-[#6137e0] accent-[#6137e0] cursor-pointer"
                            type="checkbox"
                          />
                          <span>Provision Technical Evaluation Scorecard for Chris Miller</span>
                        </label>
                      </div>
                    </div>

                    {/* Action Confirmation Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dee2ef]/60">
                      <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="px-4 py-2 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] text-xs font-semibold transition-colors cursor-pointer"
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmMoveAndDispatch}
                        disabled={isDispatching}
                        className="px-4 py-2 rounded-lg bg-[#6137e0] text-white hover:bg-[#7a55fa] shadow-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        type="button"
                      >
                        {isDispatching ? (
                          <>
                            <SymbolIcon name="sync" className="text-[16px] animate-spin" style={{ fontSize: "16px" }} />
                            <span>Dispatching...</span>
                          </>
                        ) : (
                          <>
                            <SymbolIcon name="check" className="text-[16px]" style={{ fontSize: "16px" }} />
                            <span>Confirm Move &amp; Dispatch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Table View Mode */
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 overflow-hidden">
                <div className="p-4 border-b border-[#dee2ef] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#171c25]">All Requisitions Overview</h3>
                    <p className="text-xs text-[#45474c]">Detailed stage breakdown per requisition</p>
                  </div>
                  <span className="text-xs font-mono text-[#75777c]">14 Active Requisitions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#f0f3ff] text-[#45474c] text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Requisition Title</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Applied</th>
                        <th className="py-3 px-4">Screening</th>
                        <th className="py-3 px-4">Interview</th>
                        <th className="py-3 px-4">Offer</th>
                        <th className="py-3 px-4">Hired</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaeefb] text-xs">
                      <tr className="bg-[#e7deff]/20 hover:bg-[#e7deff]/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#171c25]">Senior Platform Engineer</div>
                          <div className="text-[10px] text-[#75777c] font-mono">REQ-RE-204 · London / Hybrid</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#45474c]">Platform Core</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">48</td>
                        <td className="py-3.5 px-4 font-bold text-[#6137e0]">12</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">6</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">2</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">1</td>
                        <td className="py-3.5 px-4 text-[#171c25]">Elena Varga</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewMode("board")}
                            className="px-2.5 py-1 rounded bg-[#6137e0] text-white font-semibold text-xs cursor-pointer"
                          >
                            Open Board
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#f0f3ff] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#171c25]">Lead Product Designer</div>
                          <div className="text-[10px] text-[#75777c] font-mono">REQ-DS-108 · Berlin</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#45474c]">Product Experience</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">32</td>
                        <td className="py-3.5 px-4 font-bold text-[#6137e0]">8</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">4</td>
                        <td className="py-3.5 px-4 font-bold text-[#171c25]">1</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">0</td>
                        <td className="py-3.5 px-4 text-[#171c25]">Tomas Novak</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewMode("board")}
                            className="px-2.5 py-1 rounded bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] font-semibold text-xs cursor-pointer"
                          >
                            Open Board
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <CoreFooter />

      {/* Create Job Modal */}
      <CreateJobModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onJobCreated={(newJob) => {
          setAllJobs((prev) => [newJob, ...prev]);
          showToast(`✓ Requisition created: ${newJob.title}`);
        }}
      />

      {/* Candidate Review Modal */}
      <CandidateReviewModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        candidateName={reviewCandidate.name}
        roleTitle={reviewCandidate.role}
        reqCode={reviewCandidate.req}
      />
    </>
  );
}
