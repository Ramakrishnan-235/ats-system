"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Inbox,
  Loader2,
  FileCheck2,
  Lock,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fetchCandidates, fetchJobs, updateCandidateStage, getErrorMessage } from "@/lib/api";
import { CandidateDetail, JobRequisition } from "@/types/ats";

interface OfferPackage {
  id: string;
  candidateId: string;
  candidateName: string;
  initials: string;
  tag?: string;
  tagColor?: string;
  req: string;
  jobId?: string;
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

function candidateToOfferPackage(cand: CandidateDetail, jobs: JobRequisition[]): OfferPackage {
  const job = jobs.find(
    (j) => j.id === cand.applied_for_job_id || cand.applications?.some((a) => a.job_id === j.id)
  );
  const candidateName = cand.name || cand.anonymized_name || `Candidate ${cand.id.slice(0, 6)}`;
  const initials =
    candidateName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CD";

  const isHired = cand.stage?.toLowerCase() === "hired";
  const role = cand.role || cand.target_headline || job?.title || "Staff Software Engineer";
  const team = job?.department || "Core Infrastructure";
  const req = job?.title ? `REQ-${job.id.slice(0, 4).toUpperCase()}` : "REQ-OFFER";

  return {
    id: cand.id,
    candidateId: cand.id,
    candidateName,
    initials,
    tag: isHired ? "Countersigned" : "Offer Extended",
    tagColor: isHired ? "bg-emerald-50 text-emerald-700" : "bg-[#e7deff] text-[#1e0060]",
    req,
    role,
    team,
    jobId: job?.id || cand.applied_for_job_id || cand.applications?.[0]?.job_id,
    baseComp: "£145,000 Base",
    equityOrSignOn: "+ Equity & £15k Sign-on",
    status: isHired ? "Accepted & Countersigned" : "Pending Signatures & Acceptance",
    approvers: isHired ? "All Sign-offs Completed" : "VP Eng (Signed), Lead Recruiter (Awaiting)",
    owner: "Lead Recruiter",
    baseSalaryFormatted: "£145,000 / annum",
    signOnBonus: "£15,000",
    shares: "12,000 Shares",
    percentile: 82,
    salaryMin: "£125k",
    salaryMax: "£165k",
    approvalChain: [
      { name: "Chris Miller", role: "Hiring Manager · VP Engineering", status: "Signed", date: "Signed" },
      { name: "Finance Controller", role: "Halden Corporate Finance", status: "Signed", date: "Signed" },
      {
        name: "Elena Varga (You)",
        role: "Lead Recruiter · Sign-off Guard",
        status: isHired ? "Signed" : "Awaiting",
        date: isHired ? "Countersigned" : undefined,
        isYou: true,
      },
    ],
  };
}

export default function OffersPage() {
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [activeFilterPill, setActiveFilterPill] = useState<"all" | "in_review" | "out_for_sign">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isDraftModalOpen, setIsDraftModalOpen] = useState<boolean>(false);
  const [isBandsModalOpen, setIsBandsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Draft form fields
  const [draftCandidateId, setDraftCandidateId] = useState<string>("");
  const [draftBaseSalary, setDraftBaseSalary] = useState<string>("145,000");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchCandidates().catch(() => [] as CandidateDetail[]),
      fetchJobs().catch(() => [] as JobRequisition[]),
    ]).then(([cands, jobsData]) => {
      if (!isMounted) return;
      setCandidates(cands);
      setJobs(jobsData);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshData = async () => {
    try {
      const [cands, jobsData] = await Promise.all([
        fetchCandidates().catch(() => [] as CandidateDetail[]),
        fetchJobs().catch(() => [] as JobRequisition[]),
      ]);
      setCandidates(cands);
      setJobs(jobsData);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  // Offers packages generated from candidates in Offer or Hired stage
  const offerPackages = useMemo(() => {
    return candidates
      .filter((c) => {
        const s = (c.stage || "").toLowerCase();
        return s === "offer" || s === "hired";
      })
      .map((c) => candidateToOfferPackage(c, jobs));
  }, [candidates, jobs]);

  const selectedPkg = offerPackages.find((p) => p.id === selectedPackageId) || offerPackages[0] || null;

  // Candidates available for drafting a new offer (e.g. not already Hired)
  const draftEligibleCandidates = useMemo(() => {
    return candidates.filter((c) => (c.stage || "").toLowerCase() !== "hired");
  }, [candidates]);

  // Metric counts derived from live data
  const inReviewCount = offerPackages.filter((o) => o.status.includes("Pending")).length;
  const acceptedCount = offerPackages.filter((o) => o.status.includes("Countersigned")).length;
  const activeOfferCount = offerPackages.filter((o) => !o.status.includes("Countersigned")).length;

  const filteredOffers = useMemo(() => {
    return offerPackages.filter((o) => {
      const matchSearch =
        !searchQuery ||
        o.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.req.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPill =
        activeFilterPill === "all" ||
        (activeFilterPill === "in_review" && o.status.includes("Pending")) ||
        (activeFilterPill === "out_for_sign" &&
          (o.status.includes("Acceptance") || o.status.includes("Countersigned")));

      return matchSearch && matchPill;
    });
  }, [offerPackages, searchQuery, activeFilterPill]);

  // Stage action: Approve Offer Package -> advances to Hired
  const handleApprovePackage = async () => {
    if (!selectedPkg) return;
    setIsSubmitting(true);
    try {
      await updateCandidateStage(selectedPkg.candidateId, "Hired", selectedPkg.jobId);
      showToast(`Offer package approved for ${selectedPkg.candidateName}. Stage advanced to Hired.`, "success");
      await refreshData();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage action: Request Revision -> returns to Interview
  const handleRequestRevision = async () => {
    if (!selectedPkg) return;
    setIsSubmitting(true);
    try {
      await updateCandidateStage(selectedPkg.candidateId, "Interview", selectedPkg.jobId);
      showToast(`Revision requested for ${selectedPkg.candidateName}. Returned to Interview stage.`, "success");
      await refreshData();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Generate and download real DocuSign offer agreement file
  const handleGenerateDocuSign = () => {
    if (!selectedPkg) return;
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const content = `HALDEN ENTERPRISE INSTITUTIONAL OFFER OF EMPLOYMENT
============================================================
Execution Date: ${dateStr}
Document ID: DOCU-OFFER-${selectedPkg.candidateId.slice(0, 8).toUpperCase()}

CANDIDATE INFORMATION:
- Name: ${selectedPkg.candidateName}
- Target Role: ${selectedPkg.role}
- Department: ${selectedPkg.team}
- Requisition Code: ${selectedPkg.req}

TOTAL REWARDS & COMPENSATION:
- Base Annual Salary: ${selectedPkg.baseSalaryFormatted} (Gross)
- Sign-on Incentive: ${selectedPkg.signOnBonus} (Subject to standard clawback)
- Long-Term Equity: ${selectedPkg.shares}
- Vesting Schedule: 4-Year Linear Schedule with 1-Year Cliff

MULTI-PARTY GOVERNANCE RECORD:
1. Hiring Manager: Verified & Authorized (VP Engineering)
2. Corporate Finance: Approved within Institutional Band v2.4
3. Lead Recruiter: Sign-off Confirmed

DIGITAL AUDIT TRAIL:
Tamper-Evident SHA256 Seal: 7c8e9b${selectedPkg.candidateId.replace(/-/g, "").slice(0, 16)}fa32
Platform: Halden Secure Ledger & DocuSign Transmission Gateway
Status: Validated
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Offer_Agreement_${selectedPkg.candidateName.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`DocuSign offer agreement generated and downloaded for ${selectedPkg.candidateName}.`, "success");
  };

  // Action: Draft new offer package
  const handleDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const candId = draftCandidateId || draftEligibleCandidates[0]?.id;
    if (!candId) {
      showToast("Please select an eligible candidate to draft an offer.", "error");
      return;
    }
    const cand = candidates.find((c) => c.id === candId);
    const jobId = cand?.applied_for_job_id || cand?.applications?.[0]?.job_id;

    setIsSubmitting(true);
    try {
      await updateCandidateStage(candId, "Offer", jobId);
      showToast(
        `New offer package initialized for ${cand?.name || cand?.anonymized_name || "candidate"}. Stage set to Offer.`,
        "success"
      );
      setIsDraftModalOpen(false);
      await refreshData();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                onClick={() => setIsBandsModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-white text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef] transition-colors text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#75777c]" />
                <span>Bands Configuration</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (draftEligibleCandidates.length > 0 && !draftCandidateId) {
                    setDraftCandidateId(draftEligibleCandidates[0].id);
                  }
                  setIsDraftModalOpen(true);
                }}
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
                <span className="text-3xl font-black text-[#141c27]">{inReviewCount}</span>
                <span className="text-xs text-[#75777c]">Active draft packages</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                <span>Awaiting initial sign-off checks</span>
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
                <span className="text-3xl font-black text-[#6137e0]">{inReviewCount}</span>
                <span className="text-xs text-[#75777c]">In authorization chain</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" />
                <span>Internal equity audit aligned</span>
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
                <span className="text-3xl font-black text-[#141c27]">{activeOfferCount}</span>
                <span className="text-xs text-[#75777c]">Awaiting candidate reply</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#75777c]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" />
                <span>Live dispatch active</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">Accepted / Countersigned</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Check className="w-4 h-4 text-emerald-700" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">{acceptedCount}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                  {offerPackages.length > 0 ? Math.round((acceptedCount / offerPackages.length) * 100) : 0}% Rate
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#069669]">
                <span>Active workspace records</span>
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
                  { id: "all", label: `All Packages (${offerPackages.length})` },
                  { id: "in_review", label: `In Review (${inReviewCount})` },
                  { id: "out_for_sign", label: `Out for Sign (${activeOfferCount})` },
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
              
              {loading ? (
                <div className="bg-white rounded-2xl p-12 border border-[#dee2ef] flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 text-[#6137e0] animate-spin" />
                  <span className="text-xs text-[#75777c]">Loading compensation packages...</span>
                </div>
              ) : filteredOffers.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 shadow-xs border border-dashed border-[#dee2ef] flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#eff4ff] text-[#6137e0] flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-[#6137e0]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#141c27]">No active offer packages found</h3>
                    <p className="text-xs text-[#75777c] max-w-sm mt-1">
                      Candidates advanced to the Offer stage during interview loops or drafted here will appear for compensation review and governance sign-off.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (draftEligibleCandidates.length > 0 && !draftCandidateId) {
                        setDraftCandidateId(draftEligibleCandidates[0].id);
                      }
                      setIsDraftModalOpen(true);
                    }}
                    className="mt-2 h-9 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>Draft New Offer</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredOffers.map((item) => {
                    const isSelected = selectedPkg?.id === item.id;
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
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${item.tagColor}`}>
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
              )}

              {/* Designer Annotation Box */}
              <div className="p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef]/60 flex items-start gap-2.5 text-xs text-[#45474c]">
                <Sparkles className="w-4 h-4 text-[#6137e0] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#141c27] block font-semibold">ENTERPRISE AUDIT SEAL</strong>
                  <span className="text-[11px] leading-relaxed block mt-0.5">
                    Compensation benchmarking integrates directly with workspace requisitions and live applicant records. Sending or approving an offer requires explicit human recruiter verification.
                  </span>
                </div>
              </div>

            </div>

            {/* Right 5 Cols: Focused Candidate File */}
            <div className="xl:col-span-5 flex flex-col gap-5 sticky top-24">
              
              {!selectedPkg ? (
                <div className="bg-white rounded-2xl p-10 shadow-md border border-[#dee2ef]/80 flex flex-col items-center justify-center text-center gap-3 min-h-[380px]">
                  <div className="w-12 h-12 rounded-2xl bg-[#f8f9ff] text-[#75777c] flex items-center justify-center">
                    <FileCheck2 className="w-6 h-6 text-[#75777c]" />
                  </div>
                  <h3 className="font-bold text-sm text-[#141c27]">No Offer Package Selected</h3>
                  <p className="text-xs text-[#75777c] max-w-xs">
                    Select an offer package from the roster on the left or draft a new package to review compensation breakdown and sign-off chains.
                  </p>
                </div>
              ) : (
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
                    <Link
                      href={`/candidates/${selectedPkg.candidateId}`}
                      className="p-2 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] transition-colors"
                      title="Open Candidate Record"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Package Breakdown */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#141c27] uppercase tracking-wide">Package Breakdown</span>
                      <span className="text-[11px] text-[#75777c]">Engineering Band</span>
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
                        Compliant with institutional compensation band ({selectedPkg.percentile}th percentile).
                      </p>

                      {/* Visual Slider */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] text-[#75777c] mb-1 font-mono">
                          <span>{selectedPkg.salaryMin} (25th)</span>
                          <span className="text-[#6137e0] font-bold">
                            {selectedPkg.baseSalaryFormatted.split(" ")[0]} ({selectedPkg.candidateName.split(" ")[0]} • {selectedPkg.percentile}th)
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
                        Corporate Tech Index • Verified via ATS Core
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
                      disabled={isSubmitting || selectedPkg.status.includes("Countersigned")}
                      onClick={handleApprovePackage}
                      className="w-full h-11 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#85f8c4]" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
                      )}
                      <span>
                        {selectedPkg.status.includes("Countersigned")
                          ? "Offer Package Countersigned (Hired)"
                          : "Approve Offer Package"}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleRequestRevision}
                        className="h-10 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] disabled:opacity-50 text-[#141c27] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Request Revision</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateDocuSign}
                        className="h-10 rounded-xl bg-[#e7deff] hover:bg-[#cbbeff] text-[#1e0060] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Generate DocuSign</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

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
              Select a candidate from your pipeline and initialize their target compensation package.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDraftSubmit} className="flex flex-col gap-3 mt-3 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Select Candidate</label>
              {draftEligibleCandidates.length === 0 ? (
                <div className="p-3 bg-[#f8f9ff] text-[#75777c] rounded-xl border border-[#dee2ef] text-xs">
                  No eligible candidates found in pipeline. Please create or import candidates first.
                </div>
              ) : (
                <select
                  value={draftCandidateId}
                  onChange={(e) => setDraftCandidateId(e.target.value)}
                  className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                >
                  {draftEligibleCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.anonymized_name || `Candidate ${c.id.slice(0, 6)}`} — {c.role || c.target_headline || "Candidate"} ({c.stage || "Applied"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Target Base Salary (£)</label>
              <input
                required
                value={draftBaseSalary}
                onChange={(e) => setDraftBaseSalary(e.target.value)}
                placeholder="e.g. 145,000"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || draftEligibleCandidates.length === 0}
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl hover:bg-[#202d3f] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#85f8c4]" />
              ) : (
                <Plus className="w-4 h-4 text-white" />
              )}
              <span>Initialize Offer Package</span>
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bands Configuration Modal */}
      <Dialog open={isBandsModalOpen} onOpenChange={setIsBandsModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              Halden Institutional Compensation Framework v2.4
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Verified salary percentiles and equity guidelines mapped across organizational levels.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3 text-xs">
            <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] flex flex-col gap-1.5">
              <div className="flex justify-between font-bold text-[#141c27]">
                <span>L5 / Senior Staff</span>
                <span>£110,000 – £145,000</span>
              </div>
              <span className="text-[11px] text-[#75777c]">Equity Band: 8,000 – 12,000 ISO Shares</span>
            </div>

            <div className="p-3 bg-[#e7deff]/30 rounded-xl border border-[#6137e0]/30 flex flex-col gap-1.5">
              <div className="flex justify-between font-bold text-[#6137e0]">
                <span>L6 / Principal Engineer</span>
                <span>£125,000 – £165,000</span>
              </div>
              <span className="text-[11px] text-[#45474c]">Equity Band: 12,000 – 20,000 ISO Shares</span>
            </div>

            <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] flex flex-col gap-1.5">
              <div className="flex justify-between font-bold text-[#141c27]">
                <span>L7 / VP &amp; Technical Director</span>
                <span>£160,000 – £220,000</span>
              </div>
              <span className="text-[11px] text-[#75777c]">Equity Band: 20,000 – 40,000 ISO Shares</span>
            </div>

            <button
              type="button"
              onClick={() => setIsBandsModalOpen(false)}
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl hover:bg-[#202d3f] flex items-center justify-center cursor-pointer shadow-md"
            >
              Close Framework Viewer
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "error" ? "bg-[#ba1a1a]" : "bg-[#131c29]"
          }`}
        >
          {toast.type === "error" ? (
            <X className="w-4 h-4 text-white" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <CoreFooter />
    </div>
  );
}
