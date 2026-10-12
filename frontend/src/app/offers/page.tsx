"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  FileText,
  Shield,
  Send,
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  Search,
  ExternalLink,
  Check,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertCircle,
  FileCheck2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface OfferPackage {
  id: string;
  candidateName: string;
  initials: string;
  tag?: string;
  tagColor?: string;
  req: string;
  role: string;
  team: string;
  baseComp: string;
  equityOrSignOn: string;
  status: string;
  statusColor?: string;
  approvers?: string;
  owner: string;
  startDate?: string;
  views?: string;
  baseSalaryFormatted: string;
  signOnBonus: string;
  shares: string;
  percentile: number;
  salaryMin: string;
  salaryMax: string;
  approvalChain: {
    name: string;
    role: string;
    status: "Signed" | "Awaiting";
    date?: string;
    isYou?: boolean;
  }[];
}

const OFFERS: OfferPackage[] = [
  {
    id: "er",
    candidateName: "Elena Rostova",
    initials: "ER",
    tag: "Focus Item",
    tagColor: "bg-[#e7deff] text-[#1e0060]",
    req: "REQ-208",
    role: "Staff Backend Engineer",
    team: "Core Data Infrastructure",
    baseComp: "$185,000 Base",
    equityOrSignOn: "+ Equity & $15k Sign-on",
    status: "Draft / Pending Comp Committee",
    approvers: "VP Eng (Approved), Head of People (Pending)",
    owner: "Elena Varga",
    baseSalaryFormatted: "£142,000 / annum",
    signOnBonus: "£15,000",
    shares: "12,000 Shares",
    percentile: 82,
    salaryMin: "£125k",
    salaryMax: "£155k",
    approvalChain: [
      { name: "Chris Miller", role: "Hiring Manager · VP Engineering", status: "Signed", date: "Signed Oct 4" },
      { name: "Finance Controller", role: "Halden Corporate Finance", status: "Signed", date: "Signed Oct 5" },
      { name: "Elena Varga (You)", role: "Lead Recruiter · Sign-off Guard", status: "Awaiting", isYou: true },
    ],
  },
  {
    id: "lc",
    candidateName: "Liam Chen",
    initials: "LC",
    tag: "Signed Oct 02",
    tagColor: "bg-emerald-50 text-emerald-700",
    req: "REQ-204",
    role: "Senior Platform Engineer",
    team: "Distributed Edge Team",
    baseComp: "£145,000 Base",
    equityOrSignOn: "+ £25k Equity Pool",
    status: "Accepted & Countersigned",
    startDate: "Dec 01, 2025",
    owner: "Elena Varga",
    baseSalaryFormatted: "£145,000 / annum",
    signOnBonus: "£10,000",
    shares: "15,000 Shares",
    percentile: 88,
    salaryMin: "£130k",
    salaryMax: "£160k",
    approvalChain: [
      { name: "Chris Miller", role: "Hiring Manager", status: "Signed", date: "Signed Sep 29" },
      { name: "Finance Controller", role: "Halden Corporate Finance", status: "Signed", date: "Signed Sep 30" },
      { name: "Elena Varga (You)", role: "Lead Recruiter", status: "Signed", date: "Signed Oct 2", isYou: true },
    ],
  },
  {
    id: "js",
    candidateName: "Jordan Smith",
    initials: "JS",
    tag: "Offer Extended",
    tagColor: "bg-[#e7deff] text-[#4b12cb]",
    req: "REQ-204",
    role: "Senior Platform Engineer",
    team: "Reliability Engineering",
    baseComp: "£138,000 Base",
    equityOrSignOn: "Standard Halden Tech Options",
    status: "Expires in 3 days (DocuSign Sent)",
    views: "1 of 2 views recorded",
    owner: "Marcus Vance",
    baseSalaryFormatted: "£138,000 / annum",
    signOnBonus: "£8,000",
    shares: "10,000 Shares",
    percentile: 74,
    salaryMin: "£125k",
    salaryMax: "£155k",
    approvalChain: [
      { name: "Chris Miller", role: "Hiring Manager", status: "Signed", date: "Signed Oct 3" },
      { name: "Finance Controller", role: "Finance", status: "Signed", date: "Signed Oct 4" },
      { name: "Marcus Vance", role: "Staff Sourcer", status: "Signed", date: "Signed Oct 5" },
    ],
  },
  {
    id: "mv",
    candidateName: "Marcus Vance",
    initials: "MV",
    tag: "Pre-Offer Calibration",
    tagColor: "bg-[#eff4ff] text-[#141c27]",
    req: "REQ-204",
    role: "Senior Platform Engineer",
    team: "Architecture Candidate",
    baseComp: "£135k – £160k",
    equityOrSignOn: "Target Compensation Band",
    status: "Scorecard Passed (4.8/5) • Comp Committee Agenda 14:00",
    owner: "Elena Varga",
    baseSalaryFormatted: "£152,000 / annum",
    signOnBonus: "£20,000",
    shares: "18,000 Shares",
    percentile: 91,
    salaryMin: "£130k",
    salaryMax: "£165k",
    approvalChain: [
      { name: "Chris Miller", role: "Hiring Manager", status: "Signed", date: "Signed Oct 5" },
      { name: "Finance Controller", role: "Finance", status: "Awaiting" },
      { name: "Elena Varga (You)", role: "Lead Recruiter", status: "Awaiting", isYou: true },
    ],
  },
];

export default function OffersPage() {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("er");
  const [activeFilterPill, setActiveFilterPill] = useState<"all" | "in_review" | "out_for_sign">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDraftModalOpen, setIsDraftModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedPkg = OFFERS.find((p) => p.id === selectedPackageId) || OFFERS[0];

  const filteredOffers = OFFERS.filter((o) => {
    const matchSearch =
      !searchQuery ||
      o.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.req.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchPill =
      activeFilterPill === "all" ||
      (activeFilterPill === "in_review" && o.status.includes("Pending")) ||
      (activeFilterPill === "out_for_sign" && (o.status.includes("Sent") || o.status.includes("Accepted")));

    return matchSearch && matchPill;
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-6">
          
          {/* Header & Meta */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-bold text-[10px] uppercase tracking-wider">
                  Governance Active
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                <span className="text-xs text-[#75777c]">
                  Live Cycle Q4 · Halden Institutional Compensation Framework v2.4
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                Offers &amp; Compensation Studio
              </h1>
              <p className="text-sm text-[#45474c] mt-0.5">
                Prepare compensation packages, manage internal approvals, and track candidate offer letter dispatch with human sign-offs.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => showToast("Compensation bands schema config opened.")}
                className="h-10 px-4 rounded-xl bg-white text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef] transition-colors text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#75777c]" />
                <span>Bands Configuration</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDraftModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] transition-all text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Draft New Offer</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Offers in Draft</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">3</span>
                <span className="text-xs text-[#75777c]">Active revisions</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                <span>2 requiring initial equity pool check</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Leadership Sign-Off</span>
                <div className="w-7 h-7 rounded-lg bg-[#e7deff] flex items-center justify-center text-[#6137e0]">
                  <Shield className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#6137e0]">2</span>
                <span className="text-xs text-[#75777c]">In authorization chain</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
                <span>1 flagged for L6 comp band exception</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Extended to Candidate</span>
                <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">4</span>
                <span className="text-xs text-[#75777c]">Awaiting acceptance</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" />
                <span>1 offer expiring in 72 hours</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Accepted This Month</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Check className="w-4 h-4 text-emerald-700" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">15</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                  88.2% Rate
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#069669]">
                <span>+4.6% vs Halden Historical Q3</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#75777c] absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate, role, or ID..."
                className="w-full h-9 pl-8 pr-3 bg-[#f8f9ff] text-xs rounded-xl border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All Packages (24)" },
                  { id: "in_review", label: "In Review (5)" },
                  { id: "out_for_sign", label: "Out for Sign (4)" },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilterPill(pill.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                    activeFilterPill === pill.id
                      ? "bg-[#131c29] text-white shadow-xs"
                      : "bg-[#eff4ff] text-[#45474c] hover:text-[#141c27]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split View: Left Roster (7 cols) & Right Focused File (5 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left 7 Cols: Package Roster */}
            <div className="xl:col-span-7 flex flex-col gap-4">
              
              <div className="flex flex-col gap-3">
                {filteredOffers.map((item) => {
                  const isSelected = item.id === selectedPkg.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPackageId(item.id)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 ${
                        isSelected
                          ? "bg-[#e7deff]/25 border-[#6137e0] shadow-xs"
                          : "bg-white border-[#dee2ef]/70 hover:bg-[#f8f9ff]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#141c27] flex items-center justify-center font-bold text-xs shrink-0">
                            {item.initials}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-sm text-[#141c27]">{item.candidateName}</h3>
                              {item.tag && (
                                <span className={`px-2 py-0.2 rounded-full font-bold text-[10px] ${item.tagColor}`}>
                                  {item.tag}
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-[#75777c]">{item.req}</span>
                            </div>
                            <div className="text-xs text-[#45474c] mt-0.5">
                              {item.role} • {item.team}
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <div className="font-bold text-sm text-[#141c27]">{item.baseComp}</div>
                          <div className="text-[11px] text-[#75777c]">{item.equityOrSignOn}</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#eff4ff] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#75777c]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#141c27]">Status: {item.status}</span>
                          {item.approvers && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-[#6137e0]">{item.approvers}</span>
                            </>
                          )}
                        </div>
                        <span className="font-medium">Owner: {item.owner}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="p-3 bg-white rounded-xl border border-[#dee2ef]/60 flex items-center justify-between text-xs text-[#75777c]">
                <span>Displaying 4 active candidate records</span>
                <div className="flex items-center gap-1 font-semibold">
                  <span className="px-2 py-0.5 rounded bg-[#131c29] text-white">1</span>
                  <span className="px-2 py-0.5 rounded hover:bg-[#dee2ef]">2</span>
                  <span className="px-2 py-0.5 rounded hover:bg-[#dee2ef]">3</span>
                </div>
              </div>

              {/* Designer Annotation Box */}
              <div className="p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef]/60 flex items-start gap-2.5 text-xs text-[#45474c]">
                <Sparkles className="w-4 h-4 text-[#6137e0] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#141c27] block font-semibold">DESIGNER ANNOTATION</strong>
                  <span className="text-[11px] leading-relaxed block mt-0.5">
                    Proposed prototype scope: Compensation benchmarking integrates with Radford/Levels data. Sending an offer requires multi-party cryptographic authorization.
                  </span>
                </div>
              </div>

            </div>

            {/* Right 5 Cols: Focused Candidate File */}
            <div className="xl:col-span-5 flex flex-col gap-5 sticky top-24">
              
              <div className="bg-white rounded-2xl p-6 shadow-md border border-[#dee2ef]/80 flex flex-col gap-5">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-1 border-b border-[#eff4ff]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6137e0]">
                      Focused Candidate File
                    </span>
                    <h2 className="text-xl font-black text-[#141c27] tracking-tight">
                      Offer Package Review
                    </h2>
                    <span className="text-xs text-[#75777c]">
                      {selectedPkg.candidateName} ({selectedPkg.req})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast(`Opened dossier for ${selectedPkg.candidateName}`)}
                    className="p-2 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Package Breakdown */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#141c27] uppercase tracking-wide">Package Breakdown</span>
                    <span className="text-[11px] text-[#75777c]">L6 Engineering Band</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex flex-col gap-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-[#75777c]">Base Salary</div>
                        <div className="text-base font-bold text-[#141c27]">{selectedPkg.baseSalaryFormatted}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#75777c] font-semibold text-[10px]">
                        Standard Monthly
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#dee2ef]/40">
                      <div>
                        <div className="text-[11px] text-[#75777c]">Sign-on Bonus</div>
                        <div className="text-sm font-bold text-[#141c27]">{selectedPkg.signOnBonus}</div>
                      </div>
                      <span className="text-[11px] text-[#75777c]">12-mo clawback clause</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#dee2ef]/40">
                      <div>
                        <div className="text-[11px] text-[#75777c]">Long-Term Incentives</div>
                        <div className="text-sm font-bold text-[#6137e0]">{selectedPkg.shares}</div>
                      </div>
                      <span className="text-[11px] text-[#75777c]">ISO • 4-yr vest • 1-yr cliff</span>
                    </div>
                  </div>
                </div>

                {/* Benchmark & Equity Audit */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-[#141c27] uppercase tracking-wide">
                    Benchmark &amp; Equity Audit
                  </span>

                  <div className="p-4 rounded-xl bg-[#e7deff]/25 border border-[#6137e0]/20 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#6137e0]">
                      <Shield className="w-4 h-4" />
                      <span>Non-discrimination &amp; Internal Equity Benchmark</span>
                    </div>
                    <p className="text-xs text-[#45474c] leading-relaxed">
                      Compliant with Halden L6 engineering band ({selectedPkg.percentile}th percentile).
                    </p>

                    {/* Visual Slider */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[11px] text-[#75777c] mb-1 font-mono">
                        <span>{selectedPkg.salaryMin} (25th)</span>
                        <span className="text-[#6137e0] font-bold">
                          {selectedPkg.baseSalaryFormatted.split(" ")[0]} ({selectedPkg.candidateName.split(" ")[0]} • {selectedPkg.percentile}nd)
                        </span>
                        <span>{selectedPkg.salaryMax} (95th)</span>
                      </div>
                      <div className="w-full bg-[#dee2ef] rounded-full h-2 relative">
                        <div
                          className="bg-[#6137e0] h-2 rounded-full"
                          style={{ width: `${selectedPkg.percentile}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-[#75777c] text-center mt-1">
                      Radford Tech Tech-London Index • Verified 24h ago
                    </span>
                  </div>
                </div>

                {/* Multi-Party Authorization Chain */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-[#141c27] uppercase tracking-wide">
                    Multi-Party Authorization Chain
                  </span>

                  <div className="flex flex-col gap-2 text-xs">
                    {selectedPkg.approvalChain.map((approver, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          {approver.status === "Signed" ? (
                            <CheckCircle2 className="w-4 h-4 text-[#069669]" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#6137e0]" />
                          )}
                          <div>
                            <div className="font-bold text-[#141c27]">{approver.name}</div>
                            <div className="text-[11px] text-[#75777c]">{approver.role}</div>
                          </div>
                        </div>

                        {approver.status === "Signed" ? (
                          <span className="text-[11px] font-semibold text-[#069669]">
                            {approver.date}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-bold text-[10px]">
                            Awaiting Sign-off
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Explicit Recruiter Confirmation */}
                <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/50 flex items-start gap-2.5 text-xs text-[#45474c]">
                  <Lock className="w-4 h-4 text-[#6137e0] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#141c27] block font-semibold">
                      Explicit Recruiter Confirmation
                    </strong>
                    <span className="text-[11px] leading-snug block mt-0.5">
                      Candidate will not receive formal documents until human sign-off is completed.
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => showToast(`Offer package approved for ${selectedPkg.candidateName}. Cryptographic signature sealed.`)}
                    className="w-full h-11 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
                    <span>Approve Offer Package</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => showToast("Revision request returned to Hiring Manager.")}
                      className="h-10 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Request Revision</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast("DocuSign envelope created with tamper-evident seal.")}
                      className="h-10 rounded-xl bg-[#e7deff] hover:bg-[#cbbeff] text-[#1e0060] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Generate DocuSign</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Draft New Offer Modal */}
      <Dialog open={isDraftModalOpen} onOpenChange={setIsDraftModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              Draft New Offer Package
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Select candidate, requisition level, and target compensation band.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsDraftModalOpen(false);
              showToast("New offer package initialized in draft state.");
            }}
            className="flex flex-col gap-3 mt-3 text-xs"
          >
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Candidate Name</label>
              <input
                required
                placeholder="e.g. David Kim"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Base Salary (£)</label>
              <input
                required
                defaultValue="145,000"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] font-mono"
              />
            </div>
            <button
              type="submit"
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl"
            >
              Initialize Offer
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
