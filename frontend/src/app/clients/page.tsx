"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Shield,
  CheckCircle2,
  Lock,
  LockOpen,
  Send,
  Eye,
  EyeOff,
  Clock,
  Building2,
  Share2,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  History,
  Check,
  X,
  FileText,
  DollarSign,
  UserCheck,
  Sparkles,
} from "lucide-react";

interface ClientSubmission {
  id: string;
  candidateCode: string;
  name: string;
  maskedName: string;
  initials: string;
  role: string;
  department: string;
  subDate: string;
  isMasked: boolean;
  stage: string;
  stageColor: string;
  feedback: string;
  fee: string;
  feeStatus: string;
  score: number;
}

export default function AgencyClientsPage() {
  // Active Workspace
  const [activeClientWorkspace, setActiveClientWorkspace] = useState("Halden Financial Corp");

  // Filter tabs
  const [activeFilterTab, setActiveFilterTab] = useState<"All" | "Awaiting" | "Masked">("All");

  // Selected row for Submission Builder
  const [selectedSubId, setSelectedSubId] = useState<string>("sub-dk");

  // Live Masking Toggle in right panel
  const [isMaskingEnabled, setIsMaskingEnabled] = useState(true);

  // New Submission Modal State
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);
  const [newSubCandidate, setNewSubCandidate] = useState("Alex Chen");
  const [newSubRole, setNewSubRole] = useState("Lead Product Designer");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const submissions: ClientSubmission[] = [
    {
      id: "sub-mv",
      candidateCode: "#C-9014 · UK Citizen",
      name: "Alex Rivera",
      maskedName: "Candidate #9014 (Masked)",
      initials: "AR",
      role: "Staff Platform Engineer",
      department: "Core Banking Cloud",
      subDate: "Oct 4, 2026",
      isMasked: false,
      stage: "Interview Scheduled",
      stageColor: "bg-[#e7deff] text-[#1e0060]",
      feedback: '"Strong match on distributed systems and high-throughput messaging."',
      fee: "£28,500",
      feeStatus: "Pending Offer",
      score: 94,
    },
    {
      id: "sub-dk",
      candidateCode: "#8812",
      name: "David Kim",
      maskedName: "Candidate #8812 (Masked)",
      initials: "DK",
      role: "Senior Systems SWE",
      department: "Latency Engineering",
      subDate: "Oct 6, 2026",
      isMasked: true,
      stage: "Pending Review",
      stageColor: "bg-[#dbe3f2] text-[#141c27]",
      feedback: '"Awaiting hiring manager feedback (Assigned to Marcus Sterling, VP SWE)"',
      fee: "£24,000",
      feeStatus: "Fee Protected",
      score: 86,
    },
    {
      id: "sub-ps",
      candidateCode: "#C-7740 · Right to Work Confirmed",
      name: "Priya Sharma",
      maskedName: "Candidate #7740 (Masked)",
      initials: "PS",
      role: "Lead Product Designer",
      department: "Trader Workstation UX",
      subDate: "Oct 5, 2026",
      isMasked: false,
      stage: "Review Completed",
      stageColor: "bg-emerald-100 text-emerald-900",
      feedback: '"Approved for final partner chat. Portfolio presentation met high technical threshold."',
      fee: "£26,000",
      feeStatus: "Stage 4 Validated",
      score: 88,
    },
  ];

  const filteredSubmissions = submissions.filter((s) => {
    if (activeFilterTab === "Awaiting") return s.stage.toLowerCase().includes("pending");
    if (activeFilterTab === "Masked") return s.isMasked;
    return true;
  });

  const selectedSubmission = submissions.find((s) => s.id === selectedSubId) || submissions[1];

  const handleDispatchSubmission = () => {
    showToast(`✓ Dossier dispatched directly to Halden Financial Hiring Manager portal!`);
  };

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            {/* Toast Feedback */}
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

            {/* Prototype Banner / Disclaimer Notice */}
            <div className="w-full bg-[#e7deff]/50 border border-[#cbbeff]/60 rounded-xl p-3.5 sm:p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#6137e0] text-white flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <p className="text-xs text-[#141c27]">
                  <span className="font-bold uppercase tracking-wider text-[#141c27]">Agency Compliance: </span>
                  Client portal permissions &amp; automatic PII masking protect candidate exclusivity and fee attribution prior to direct engagement.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[#45474c] font-mono text-[11px] shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Active Agency SLA v4.2</span>
              </div>
            </div>

            {/* Primary Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-[#45474c]">
                  <span className="text-[11px] uppercase tracking-wider text-[#6137e0] font-bold">
                    Client Portals &amp; Headcount Dispatch
                  </span>
                  <span>/</span>
                  <span className="font-medium text-[#141c27]">Halden Financial</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#141c27] tracking-tight">
                  Agency Clients &amp; Submissions Roster
                </h1>
                <p className="text-xs sm:text-sm text-[#45474c]">
                  Monitor pipeline handoffs, masked syndication security, and commission tracking across client hiring accounts.
                </p>
              </div>

              {/* Controls & Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Client Switcher Dropdown */}
                <div className="relative inline-block text-left">
                  <button
                    onClick={() => {
                      const next =
                        activeClientWorkspace === "Halden Financial Corp"
                          ? "Apex Cloud Systems"
                          : activeClientWorkspace === "Apex Cloud Systems"
                          ? "Monzo Logistics"
                          : "Halden Financial Corp";
                      setActiveClientWorkspace(next);
                      showToast(`Switched client workspace to ${next}`);
                    }}
                    className="h-10 px-3.5 bg-white text-[#141c27] rounded-lg shadow-2xs border border-[#dee2ef] flex items-center gap-2 hover:bg-[#eff4ff] transition-colors cursor-pointer"
                    type="button"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6137e0]"></span>
                    <span className="text-xs font-bold">Client Workspace: {activeClientWorkspace}</span>
                    <ChevronDown className="w-4 h-4 text-[#75777c]" />
                  </button>
                </div>

                <button
                  onClick={() => showToast("Generated secure encrypted client portal share link")}
                  className="h-10 px-3.5 bg-white text-[#141c27] hover:bg-[#eff4ff] rounded-lg shadow-2xs border border-[#dee2ef] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  type="button"
                >
                  <Share2 className="w-4 h-4 text-[#75777c]" />
                  <span>Client Portal Access</span>
                </button>

                <button
                  onClick={() => setIsNewSubModalOpen(true)}
                  className="h-10 px-4 bg-[#000000] text-white hover:bg-[#131c29] rounded-lg shadow-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ New Candidate Submission</span>
                </button>
              </div>
            </div>

            {/* Top Client Health Cards (Metrics Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Health Card 1: Active Workspace (Halden Financial) */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#6137e0]/5 rounded-full pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        Active Retainer
                      </span>
                    </div>
                    <span className="h-5 px-2 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]"></span> Primary
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">Halden Financial</h3>
                  <p className="text-xs text-[#45474c] mb-3">Tier 1 Investment Banking &amp; Prime Brokerage</p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">4</span>
                      <span className="text-[11px] text-[#45474c]">Active Placements</span>
                    </div>
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">6</span>
                      <span className="text-[11px] text-[#45474c]">Open Requisitions</span>
                    </div>
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">12</span>
                      <span className="text-[11px] text-[#45474c]">Candidates Submitted</span>
                    </div>
                    <div className="bg-[#e7deff]/40 p-2.5 rounded-lg border border-[#cbbeff]/40">
                      <span className="text-lg font-bold text-[#6137e0] block">3</span>
                      <span className="text-[11px] text-[#141c27] font-semibold">Awaiting Review</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 bg-[#eff4ff]/60 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between border-t border-[#dee2ef]/50">
                  <span className="text-xs text-[#45474c] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Next Client Review:
                  </span>
                  <span className="text-xs font-bold text-[#141c27]">Today 15:00 BST</span>
                </div>
              </div>

              {/* Health Card 2: Apex Cloud Systems */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#75777c]"></span>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        Standard Retainer
                      </span>
                    </div>
                    <span className="text-xs text-[#45474c]">Contingency</span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">Apex Cloud Systems</h3>
                  <p className="text-xs text-[#45474c] mb-3">Enterprise Infrastructure &amp; Kubernetes Platform</p>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg text-center border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">2</span>
                      <span className="text-[11px] text-[#45474c]">Placements</span>
                    </div>
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg text-center border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">3</span>
                      <span className="text-[11px] text-[#45474c]">Open Req</span>
                    </div>
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg text-center border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">5</span>
                      <span className="text-[11px] text-[#45474c]">Submitted</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 bg-[#eff4ff]/60 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between border-t border-[#dee2ef]/50">
                  <span className="text-xs text-[#45474c] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> SLA Sync:
                  </span>
                  <span className="text-xs font-semibold text-[#141c27]">Tomorrow 10:00</span>
                </div>
              </div>

              {/* Health Card 3: Monzo Logistics */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#75777c]"></span>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        Growth Account
                      </span>
                    </div>
                    <span className="text-xs text-[#45474c]">Exclusive</span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">Monzo Logistics</h3>
                  <p className="text-xs text-[#45474c] mb-3">Autonomous Freight Routing &amp; Telematics</p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg text-center border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">1</span>
                      <span className="text-[11px] text-[#45474c]">Active Placement</span>
                    </div>
                    <div className="bg-[#eff4ff] p-2.5 rounded-lg text-center border border-[#dee2ef]/40">
                      <span className="text-lg font-bold text-[#141c27] block">2</span>
                      <span className="text-[11px] text-[#45474c]">Open Requisitions</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 bg-[#eff4ff]/60 -mx-5 -mb-5 px-5 py-2.5 flex items-center justify-between border-t border-[#dee2ef]/50">
                  <span className="text-xs text-[#45474c] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Feedback Latency:
                  </span>
                  <span className="text-xs font-semibold text-[#141c27]">18 hrs avg</span>
                </div>
              </div>
            </div>

            {/* Main Canvas split layout: Left side submissions table, Right side contextual builder drawer */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* LEFT PANEL: Candidate Submissions Table (Col 8) */}
              <div className="xl:col-span-8 flex flex-col gap-4">
                {/* Table Header & Controls Bar */}
                <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                      <FileText className="w-4 h-4 text-[#6137e0]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#141c27]">
                        Candidate Submissions for Halden Financial
                      </h2>
                      <p className="text-xs text-[#45474c]">3 candidates under active client evaluation</p>
                    </div>
                  </div>

                  {/* Filter pills */}
                  <div className="flex items-center gap-1.5">
                    {(["All", "Awaiting", "Masked"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveFilterTab(tab)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          activeFilterTab === tab
                            ? "bg-[#000000] text-white shadow-xs"
                            : "bg-[#eff4ff] text-[#45474c] hover:text-[#141c27]"
                        }`}
                        type="button"
                      >
                        {tab === "All" ? "All (3)" : tab === "Awaiting" ? "Awaiting Review (1)" : "Masked (1)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submissions Table Card */}
                <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#eff4ff] text-[#45474c] text-[11px] font-bold uppercase tracking-wider border-b border-[#dee2ef]">
                        <tr>
                          <th className="py-3 px-4">Candidate</th>
                          <th className="py-3 px-4">Target Role</th>
                          <th className="py-3 px-4">Submission Date</th>
                          <th className="py-3 px-4">Masked Status</th>
                          <th className="py-3 px-4">Client Stage</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dee2ef]/40 text-xs text-[#141c27]">
                        {filteredSubmissions.map((sub) => {
                          const isSelected = selectedSubId === sub.id;

                          return (
                            <tr
                              key={sub.id}
                              onClick={() => setSelectedSubId(sub.id)}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#e7deff]/20 hover:bg-[#e7deff]/30 ring-1 ring-inset ring-[#6137e0]/30"
                                  : "hover:bg-[#eff4ff]/50"
                              }`}
                            >
                              {/* Candidate */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                      sub.isMasked
                                        ? "bg-[#6137e0] text-white"
                                        : "bg-[#eff4ff] text-[#141c27] border border-[#dee2ef]"
                                    }`}
                                  >
                                    {sub.initials}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-sm text-[#141c27] flex items-center gap-1.5">
                                      <span>{sub.isMasked ? sub.maskedName.split(" ")[0] + " " + sub.maskedName.split(" ")[1] : sub.name}</span>
                                      {sub.isMasked && (
                                        <Shield className="w-3.5 h-3.5 text-[#6137e0]" />
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#75777c] truncate">
                                      {sub.candidateCode}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Target Role */}
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-xs text-[#141c27]">{sub.role}</div>
                                <div className="text-[11px] text-[#45474c]">{sub.department}</div>
                              </td>

                              {/* Submission Date */}
                              <td className="py-3.5 px-4 text-xs whitespace-nowrap text-[#45474c]">
                                {sub.subDate}
                              </td>

                              {/* Masked Status */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {sub.isMasked ? (
                                  <span className="h-6 px-2.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] inline-flex items-center gap-1 font-bold">
                                    <Lock className="w-3 h-3 text-[#6137e0]" />
                                    <span>Masked (PII Hidden)</span>
                                  </span>
                                ) : (
                                  <span className="h-6 px-2.5 rounded-full bg-[#eff4ff] text-[#141c27] text-[10px] inline-flex items-center gap-1 font-semibold border border-[#dee2ef]/50">
                                    <LockOpen className="w-3 h-3 text-[#75777c]" />
                                    <span>Full Profile Revealed</span>
                                  </span>
                                )}
                              </td>

                              {/* Client Stage */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`h-6 px-2.5 rounded-full text-[10px] inline-flex items-center gap-1.5 font-bold ${sub.stageColor}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                  <span>{sub.stage}</span>
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {sub.id === "sub-mv" ? (
                                    <Link
                                      href="/candidates"
                                      className="px-2.5 py-1 rounded bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold transition-colors"
                                    >
                                      View Dossier
                                    </Link>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showToast(`Viewing details for ${sub.name}`);
                                      }}
                                      className="px-2.5 py-1 rounded bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold transition-colors cursor-pointer"
                                      type="button"
                                    >
                                      {sub.isMasked ? "Reveal Details" : "View Notes"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Pagination & Bulk Status Footer */}
                  <div className="bg-[#eff4ff]/60 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[#45474c] text-xs border-t border-[#dee2ef]/50">
                    <div className="flex items-center gap-2">
                      <span>
                        Showing <strong>3</strong> of <strong>12</strong> active client submissions
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c5c6cc]"></span>
                      <span>
                        Total Halden Contingent Commission:{" "}
                        <strong className="text-[#141c27]">£78,500.00</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="px-3 py-1 rounded bg-white text-[#141c27] text-xs font-semibold shadow-2xs border border-[#dee2ef] opacity-50 cursor-not-allowed"
                        disabled
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-white text-[#141c27] text-xs font-semibold shadow-2xs border border-[#dee2ef] hover:bg-[#eff4ff] cursor-pointer"
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Agency Audit Activity Trail */}
                <div className="bg-white rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <h4 className="text-xs font-bold text-[#141c27] mb-3 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#6137e0]" />
                    <span>Recent Portal Activity &amp; Attribution Timestamps</span>
                  </h4>
                  <div className="space-y-2 text-xs text-[#45474c]">
                    <div className="flex items-start justify-between py-1 bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                        <span>
                          <strong>Halden Financial (Portal #HF-4)</strong> viewed Masked Dossier for{" "}
                          <strong>Candidate #8812</strong>
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#75777c]">42 mins ago</span>
                    </div>
                    <div className="flex items-start justify-between py-1 bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <span>
                          <strong>Elena Varga (Lead Recruiter)</strong> released Full PII for{" "}
                          <strong>Alex Rivera</strong> upon Stage 2 sign-off
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#75777c]">Yesterday 16:15</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT CONTEXTUAL DRAWER / PANEL: Candidate Submission Builder & Explicit Client Preview (Col 4) */}
              <div className="xl:col-span-4 bg-white rounded-xl shadow-md p-5 flex flex-col gap-4 border border-[#dee2ef]/70 sticky top-20">
                {/* Drawer Header */}
                <div className="flex items-start justify-between pb-2 border-b border-[#dee2ef]/40">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6137e0]">
                      Submission Builder
                    </span>
                    <h3 className="text-base font-bold text-[#141c27]">Candidate Submission &amp; Preview</h3>
                    <p className="text-xs text-[#45474c]">Configuring dispatch for Halden Financial</p>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#45474c]">
                    <SlidersHorizontal className="w-4 h-4 text-[#6137e0]" />
                  </div>
                </div>

                {/* Active Selected Candidate Profile Badge */}
                <div className="bg-[#eff4ff] p-3 rounded-xl flex items-center justify-between border border-[#dee2ef]/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#000000] text-white flex items-center justify-center font-bold text-xs">
                      {selectedSubmission.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#141c27]">
                        {isMaskingEnabled ? selectedSubmission.maskedName : selectedSubmission.name}
                      </div>
                      <div className="text-xs text-[#45474c]">Target: {selectedSubmission.role}</div>
                    </div>
                  </div>
                  <span className="h-6 px-2.5 rounded-full bg-[#e7deff] text-[#1e0060] font-mono text-xs font-bold flex items-center">
                    {selectedSubmission.candidateCode.split(" ")[0]}
                  </span>
                </div>

                {/* Masking & Privacy Guard Settings */}
                <div className="bg-[#eff4ff]/80 p-3.5 rounded-xl flex flex-col gap-2.5 border border-[#dee2ef]/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#6137e0]" />
                      <div>
                        <span className="text-xs font-bold text-[#141c27] block">
                          Anonymize &amp; Mask Contact Info
                        </span>
                        <span className="text-[11px] text-[#45474c]">
                          Hides email, phone &amp; employer to protect exclusivity
                        </span>
                      </div>
                    </div>

                    {/* Toggle active switch */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMaskingEnabled(!isMaskingEnabled);
                        showToast(
                          !isMaskingEnabled
                            ? "Masking enabled: PII anonymized for client portal"
                            : "Masking disabled: Full recruiter dossier revealed"
                        );
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isMaskingEnabled ? "bg-[#6137e0]" : "bg-[#dbe3f2]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                          isMaskingEnabled ? "transform translate-x-5" : ""
                        }`}
                      ></span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#45474c] bg-white p-2 rounded-lg border border-[#dee2ef]/50">
                    Protected Fields:{" "}
                    <span className="text-[#141c27] font-semibold">
                      Current Company • Candidate Surname • Direct Phone • Personal Email
                    </span>
                  </div>
                </div>

                {/* Live Client Portal Preview Pane */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-[#45474c] font-bold">
                      Live Hiring Manager Preview Pane
                    </span>
                    <span className="text-xs text-[#6137e0] flex items-center gap-1 font-bold">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Portal View</span>
                    </span>
                  </div>

                  {/* The Masked Preview Card */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-[#dee2ef]/70 space-y-3">
                    {/* Masked Candidate Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[#141c27]">
                            {isMaskingEnabled ? "Candidate #8812" : "David Kim"}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-[#e7deff] text-[#1e0060] font-mono text-[10px] font-bold">
                            VERIFIED
                          </span>
                        </div>
                        <div className="text-xs text-[#45474c]">{selectedSubmission.role}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#6137e0]">
                          {selectedSubmission.score} / 100
                        </span>
                        <span className="block font-mono text-[10px] text-[#75777c]">Rubric Alignment</span>
                      </div>
                    </div>

                    {/* Verified Skills Tags */}
                    <div className="flex flex-wrap gap-1">
                      <span className="h-6 px-2 rounded-md bg-[#eff4ff] text-[#141c27] text-[11px] flex items-center gap-1 font-medium border border-[#dee2ef]/50">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Golang (6 yrs)
                      </span>
                      <span className="h-6 px-2 rounded-md bg-[#eff4ff] text-[#141c27] text-[11px] flex items-center gap-1 font-medium border border-[#dee2ef]/50">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Apache Kafka
                      </span>
                      <span className="h-6 px-2 rounded-md bg-[#eff4ff] text-[#141c27] text-[11px] flex items-center gap-1 font-medium border border-[#dee2ef]/50">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Low-latency Trading
                      </span>
                    </div>

                    {/* Compensation & Notice Period */}
                    <div className="grid grid-cols-2 gap-2 bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/50">
                      <div>
                        <span className="text-[10px] text-[#75777c] block">Target Base:</span>
                        <span className="text-xs font-bold text-[#141c27]">£130,000 – £140,000</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#75777c] block">Notice Period:</span>
                        <span className="text-xs font-bold text-[#141c27]">1 Month (Immediate)</span>
                      </div>
                    </div>

                    {/* Agency Recommendation Note */}
                    <div className="bg-[#e7deff]/40 p-2.5 rounded-lg border border-[#cbbeff]/50">
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#6137e0]" />
                        <span className="text-[11px] font-bold text-[#6137e0]">Agency Recommendation</span>
                      </div>
                      <p className="text-xs text-[#141c27] leading-relaxed">
                        Architected matching engine pipelines handling 450k msgs/sec in a tier-1 fintech environment. Strong communication, seeking technical leadership without heavy managerial overhead.
                      </p>
                    </div>

                    {/* Encrypted PII Placeholder Box */}
                    <div className="bg-[#dbe3f2]/50 p-2.5 rounded-lg flex items-center gap-2 border border-[#dee2ef]/50">
                      <Lock className="w-4 h-4 text-[#75777c] shrink-0" />
                      <span className="text-[11px] text-[#45474c] leading-tight">
                        Direct Contact &amp; Full Resume unlocks once Halden Financial accepts Stage 1 Intro.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={handleDispatchSubmission}
                    className="w-full h-11 px-4 bg-[#000000] text-white hover:bg-[#131c29] rounded-lg shadow-md text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    type="button"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send to Client Hiring Manager (Explicit Dispatch)</span>
                  </button>
                  <button
                    onClick={() => showToast("Draft submission saved to recruiter workspace")}
                    className="w-full h-10 px-4 bg-white hover:bg-[#eff4ff] text-[#141c27] rounded-lg shadow-2xs border border-[#dee2ef] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    type="button"
                  >
                    <FileText className="w-4 h-4 text-[#75777c]" />
                    <span>Save Draft Submission</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: + New Candidate Submission */}
        {isNewSubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#dee2ef]">
              <div className="flex items-center justify-between pb-3 border-b border-[#dee2ef]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#e7deff] text-[#6137e0] flex items-center justify-center font-bold">
                    +
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#141c27]">New Client Submission</h3>
                    <p className="text-xs text-[#45474c]">Dispatch to Halden Financial Corp</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewSubModalOpen(false)}
                  className="text-[#75777c] hover:text-[#141c27] p-1 rounded-lg hover:bg-[#eff4ff]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#141c27] block mb-1">
                    Select Sourced Candidate
                  </label>
                  <select
                    value={newSubCandidate}
                    onChange={(e) => setNewSubCandidate(e.target.value)}
                    className="w-full h-10 px-3 bg-[#eff4ff] rounded-lg text-xs font-medium text-[#141c27] border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40"
                  >
                    <option>Alex Chen · Lead Product Designer</option>
                    <option>Alex Rivera · Staff Platform Engineer</option>
                    <option>David Kim · Senior Systems SWE</option>
                    <option>Sarah Lin · Cloud Infrastructure Architect</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#141c27] block mb-1">Target Role</label>
                  <input
                    type="text"
                    value={newSubRole}
                    onChange={(e) => setNewSubRole(e.target.value)}
                    className="w-full h-10 px-3 bg-[#eff4ff] rounded-lg text-xs text-[#141c27] border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#eff4ff] border border-[#dee2ef] flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-[#6137e0] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[#45474c] leading-relaxed">
                    By default, the candidate dossier will be syndicated with anonymized contact details until the client accepts Stage 1 Intro.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#dee2ef]">
                <button
                  type="button"
                  onClick={() => setIsNewSubModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#45474c] hover:bg-[#eff4ff]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewSubModalOpen(false);
                    showToast(`✓ Submission for ${newSubCandidate} generated and queued for dispatch!`);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#000000] text-white hover:bg-[#131c29] shadow-xs"
                >
                  Confirm &amp; Stage Submission
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <CoreFooter />
    </>
  );
}
