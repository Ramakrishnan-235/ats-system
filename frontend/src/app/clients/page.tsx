"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { useSession } from "@/components/layout/api-session";
import {
  fetchClients,
  createClient,
  fetchSubmissions,
  createSubmission,
  fetchCandidates,
  switchWorkspace,
  getErrorMessage,
  AgencyClient,
  AgencySubmission,
} from "@/lib/api";
import { CandidateDetail } from "@/types/ats";
import {
  Shield,
  CheckCircle2,
  Building2,
  Plus,
  ChevronDown,
  X,
  FileText,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

export default function AgencyClientsPage() {
  const { session, refreshSession } = useSession();

  // Data state
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [submissions, setSubmissions] = useState<AgencySubmission[]>([]);
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  // Active Client filter
  const [activeClientFilter, setActiveClientFilter] = useState<string>("ALL");

  // Filter tabs
  const [activeFilterTab, setActiveFilterTab] = useState<"All" | "Submitted">("All");

  // Selected row for Submission preview
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // New Client Modal State
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);

  // New Submission Modal State
  const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);
  const [subClientId, setSubClientId] = useState<string>("");
  const [subApplicationId, setSubApplicationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Workspace switching
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const isAgencyWorkspace = useMemo(() => {
    if (!session) return true; // optimistic default until session loads
    const currentWs = session.workspaces?.find((w) => w.id === session.user.tenant_id);
    return currentWs?.kind === "agency";
  }, [session]);

  const agencyWorkspace = useMemo(() => {
    return session?.workspaces?.find((w) => w.kind === "agency");
  }, [session]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setServerError(null);
    try {
      const [cls, subs, cands] = await Promise.all([
        fetchClients().catch((err) => {
          if (err?.message?.includes("Agency workspace required")) throw err;
          return [] as AgencyClient[];
        }),
        fetchSubmissions().catch((err) => {
          if (err?.message?.includes("Agency workspace required")) throw err;
          return [] as AgencySubmission[];
        }),
        fetchCandidates().catch(() => [] as CandidateDetail[]),
      ]);
      setClients(cls);
      setSubmissions(subs);
      setCandidates(cands);
      if (cls.length > 0) {
        setSubClientId((prev) => prev || cls[0].id);
      }
      if (subs.length > 0) {
        setSelectedSubId((prev) => prev || subs[0].id);
      }
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (session?.user.tenant_id) {
      Promise.all([
        fetchClients().catch((err) => {
          if (err?.message?.includes("Agency workspace required")) throw err;
          return [] as AgencyClient[];
        }),
        fetchSubmissions().catch((err) => {
          if (err?.message?.includes("Agency workspace required")) throw err;
          return [] as AgencySubmission[];
        }),
        fetchCandidates().catch(() => [] as CandidateDetail[]),
      ]).then(([cls, subs, cands]) => {
        if (!active) return;
        setClients(cls);
        setSubmissions(subs);
        setCandidates(cands);
        if (cls.length > 0) setSubClientId((prev) => prev || cls[0].id);
        if (subs.length > 0) setSelectedSubId((prev) => prev || subs[0].id);
        setLoading(false);
      }).catch((err) => {
        if (!active) return;
        setServerError(getErrorMessage(err));
        setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, [session?.user.tenant_id]);

  const candidateApplications = useMemo(() => {
    const list: { applicationId: string; candidateId: string; candidateName: string; label: string }[] = [];
    candidates.forEach((c) => {
      const cName = c.name || c.anonymized_name || `Candidate #${c.id.slice(0, 8)}`;
      if (c.applications && c.applications.length > 0) {
        c.applications.forEach((app) => {
          if (!["Withdrawn", "Rejected"].includes(app.stage)) {
            list.push({
              applicationId: app.id,
              candidateId: c.id,
              candidateName: cName,
              label: `${cName} — ${app.job_title} (${app.stage})`,
            });
          }
        });
      }
    });
    return list;
  }, [candidates]);

  const effectiveApplicationId = subApplicationId || candidateApplications[0]?.applicationId || "";

  const handleSwitchToAgency = async () => {
    if (!agencyWorkspace) return;
    setIsSwitchingWorkspace(true);
    try {
      await switchWorkspace(agencyWorkspace.id);
      await refreshSession();
      window.location.reload();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setIsSwitchingWorkspace(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setIsSavingClient(true);
    try {
      const created = await createClient(newClientName.trim());
      showToast(`Client account "${created.name}" created.`);
      setNewClientName("");
      setIsNewClientModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAppId = effectiveApplicationId;
    if (!subClientId || !finalAppId) {
      showToast("Please select both a client account and a candidate application.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await createSubmission(subClientId, finalAppId);
      showToast("Candidate dossier successfully submitted to client portal!");
      setIsNewSubModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (activeClientFilter !== "ALL" && s.client_name !== activeClientFilter) {
        return false;
      }
      if (activeFilterTab === "Submitted") {
        return s.status.toLowerCase().includes("submit");
      }
      return true;
    });
  }, [submissions, activeClientFilter, activeFilterTab]);

  const selectedSubmission = useMemo(() => {
    return submissions.find((s) => s.id === selectedSubId) || submissions[0] || null;
  }, [submissions, selectedSubId]);

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            
            {/* Toast Feedback */}
            {toastMessage && (
              <div
                className={`fixed bottom-6 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-bottom-3 duration-300 ${
                  toastType === "error"
                    ? "bg-[#ba1a1a] border-red-400"
                    : "bg-[#131c29] border-[#6137e0]/40"
                }`}
              >
                {toastType === "error" ? (
                  <AlertCircle className="w-5 h-5 text-white shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#7a55fa] shrink-0" />
                )}
                <span className="text-xs font-semibold">{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="ml-2 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Corporate Mode Banner (if active workspace is not agency) */}
            {!isAgencyWorkspace && (
              <div className="w-full bg-[#fdf2f2] border border-[#f87171]/40 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#ba1a1a] text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#7f1d1d]">
                      Agency Workspace Required
                    </h3>
                    <p className="text-xs text-[#991b1b] mt-0.5">
                      Client accounts, syndication, and PII masking are exclusive to Agency workspaces. You are currently in a Corporate workspace.
                    </p>
                  </div>
                </div>

                {agencyWorkspace && (
                  <button
                    type="button"
                    onClick={handleSwitchToAgency}
                    disabled={isSwitchingWorkspace}
                    className="px-4 py-2.5 rounded-xl bg-[#131c29] text-white text-xs font-bold hover:bg-black transition-all shadow-sm shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSwitchingWorkspace ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    <span>Switch to {agencyWorkspace.name}</span>
                  </button>
                )}
              </div>
            )}

            {/* SLA / Privacy Banner */}
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
                <span>Active Agency Workspace</span>
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
                  <span className="font-medium text-[#141c27]">
                    {activeClientFilter === "ALL" ? "All Client Accounts" : activeClientFilter}
                  </span>
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
                {/* Client Filter Dropdown */}
                <div className="relative inline-block text-left">
                  <select
                    value={activeClientFilter}
                    onChange={(e) => setActiveClientFilter(e.target.value)}
                    className="h-10 pl-3 pr-8 bg-white text-[#141c27] rounded-lg shadow-2xs border border-[#dee2ef] text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  >
                    <option value="ALL">All Clients ({clients.length})</option>
                    {clients.map((cl) => (
                      <option key={cl.id} value={cl.name}>
                        Client: {cl.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75777c] absolute right-2.5 top-3 pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="h-10 px-3.5 bg-white text-[#141c27] hover:bg-[#eff4ff] rounded-lg shadow-2xs border border-[#dee2ef] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-[#75777c]" />
                  <span>+ Add Client</span>
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

            {/* Top Client Summary Cards (Metrics Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Card 1: Total Clients */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                      Agency Roster
                    </span>
                    <span className="h-5 px-2 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]"></span> Verified
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">
                    {clients.length} Client Accounts
                  </h3>
                  <p className="text-xs text-[#45474c] mb-3">
                    Active fee contracts and talent delivery partnerships
                  </p>
                </div>
                <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                  <span className="text-[#45474c]">Active Clients:</span>
                  <span className="font-bold text-[#141c27]">{clients.length}</span>
                </div>
              </div>

              {/* Card 2: Submissions Volume */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                      Syndication Activity
                    </span>
                    <span className="text-xs text-[#45474c]">Direct Dispatch</span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">
                    {submissions.length} Total Submissions
                  </h3>
                  <p className="text-xs text-[#45474c] mb-3">
                    Candidates syndicated across client review portals
                  </p>
                </div>
                <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                  <span className="text-[#45474c]">Syndicated Records:</span>
                  <span className="font-bold text-[#6137e0]">{submissions.length}</span>
                </div>
              </div>

              {/* Card 3: Talent Pool Candidates */}
              <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                      Available Sourced Pool
                    </span>
                    <span className="text-xs text-[#45474c]">Candidate Inventory</span>
                  </div>
                  <h3 className="text-base font-bold text-[#141c27] mb-0.5">
                    {candidates.length} Profiles Ready
                  </h3>
                  <p className="text-xs text-[#45474c] mb-3">
                    Available candidates ready for client presentation
                  </p>
                </div>
                <div className="bg-[#eff4ff] p-2.5 rounded-lg border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                  <span className="text-[#45474c]">Eligible Applications:</span>
                  <span className="font-bold text-[#069669]">{candidateApplications.length}</span>
                </div>
              </div>
            </div>

            {/* Main Canvas split layout */}
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
                        Candidate Submissions Roster
                      </h2>
                      <p className="text-xs text-[#45474c]">
                        {filteredSubmissions.length} active submissions displayed
                      </p>
                    </div>
                  </div>

                  {/* Filter pills */}
                  <div className="flex items-center gap-1.5">
                    {(["All", "Submitted"] as const).map((tab) => (
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
                        {tab === "All" ? `All (${submissions.length})` : `Submitted (${submissions.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submissions Table Card */}
                <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 overflow-hidden">
                  {loading ? (
                    <div className="p-12 text-center text-xs text-[#75777c]">
                      Loading client submissions...
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-[#75777c]" />
                      <p className="text-xs font-bold text-[#141c27]">
                        No client submissions found
                      </p>
                      <p className="text-xs text-[#75777c] max-w-sm">
                        {clients.length === 0
                          ? "First add a client account, then submit candidate applications to start syndication."
                          : "Submit a candidate application to a client account to start syndication."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewSubModalOpen(true)}
                        className="mt-2 px-4 py-2 bg-[#131c29] text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
                      >
                        + New Candidate Submission
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#eff4ff] text-[#45474c] text-[11px] font-bold uppercase tracking-wider border-b border-[#dee2ef]">
                          <tr>
                            <th className="py-3 px-4">Candidate / Code</th>
                            <th className="py-3 px-4">Client Account</th>
                            <th className="py-3 px-4">Submission Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dee2ef]/40 text-xs text-[#141c27]">
                          {filteredSubmissions.map((sub) => {
                            const isSelected = selectedSubId === sub.id;
                            const snapshotRecord = sub.snapshot && typeof sub.snapshot === "object" ? (sub.snapshot as Record<string, unknown>) : null;
                            const snapshotHeadline = snapshotRecord && typeof snapshotRecord.target_headline === "string" ? snapshotRecord.target_headline : "Candidate Profile";
                            const createdDate = sub.created_at
                              ? new Date(sub.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Recently";

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
                                    <div className="w-9 h-9 rounded-full bg-[#6137e0] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                      <Shield className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-sm text-[#141c27] flex items-center gap-1.5">
                                        <span>Candidate #{sub.id.slice(0, 8)}</span>
                                      </div>
                                      <div className="text-[11px] text-[#75777c] truncate">
                                        {snapshotHeadline}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Client Account */}
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-xs text-[#141c27] flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-[#6137e0]" />
                                    <span>{sub.client_name}</span>
                                  </div>
                                </td>

                                {/* Submission Date */}
                                <td className="py-3.5 px-4 text-xs whitespace-nowrap text-[#45474c]">
                                  {createdDate}
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="h-6 px-2.5 rounded-full text-[10px] inline-flex items-center gap-1.5 font-bold bg-[#e7deff] text-[#1e0060]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]"></span>
                                    <span>{sub.status}</span>
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <span className="text-xs font-semibold text-[#6137e0]">
                                    View Snapshot →
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANEL: Submission Detail Drawer (Col 4) */}
              <div className="xl:col-span-4 bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#dee2ef]/60">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#6137e0]" />
                    <h3 className="text-sm font-bold text-[#141c27]">
                      Syndication Snapshot
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#75777c] font-mono">
                    {selectedSubmission ? `ID: ${selectedSubmission.id.slice(0, 8)}` : "Select a row"}
                  </span>
                </div>

                {selectedSubmission ? (
                  <div className="flex flex-col gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-[#75777c] block">Client Account</span>
                      <span className="font-bold text-[#141c27] text-sm">
                        {selectedSubmission.client_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#75777c] block">Application ID</span>
                      <span className="font-mono text-xs text-[#45474c]">
                        {selectedSubmission.application_id}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#75777c] block">Dispatch Status</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-block mt-0.5">
                        {selectedSubmission.status}
                      </span>
                    </div>

                    {selectedSubmission.snapshot && (
                      <div className="mt-2 p-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef]/60">
                        <span className="text-[10px] font-bold text-[#75777c] uppercase tracking-wider block mb-1.5">
                          Profile Snapshot
                        </span>
                        <pre className="text-[11px] text-[#141c27] whitespace-pre-wrap font-sans">
                          {JSON.stringify(selectedSubmission.snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#75777c]">
                    Select a submission from the roster to inspect its syndication snapshot.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Modal: Add Client Account */}
        {isNewClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#dee2ef]">
              <div className="flex items-center justify-between pb-3 border-b border-[#dee2ef]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#e7deff] text-[#6137e0] flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#141c27]">Add Client Account</h3>
                    <p className="text-xs text-[#45474c]">Register a new client company in your agency workspace</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="text-[#75777c] hover:text-[#141c27] p-1 rounded-lg hover:bg-[#eff4ff]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="py-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#141c27] block mb-1">
                    Client Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corporation"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full h-10 px-3 bg-[#eff4ff] rounded-lg text-xs text-[#141c27] border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#dee2ef]">
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-[#45474c] hover:bg-[#eff4ff]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingClient || !newClientName.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-[#000000] text-white hover:bg-[#131c29] shadow-xs disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingClient ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    <span>Save Client</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                    <p className="text-xs text-[#45474c]">Syndicate candidate application to a client portal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewSubModalOpen(false)}
                  className="text-[#75777c] hover:text-[#141c27] p-1 rounded-lg hover:bg-[#eff4ff]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmission} className="py-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#141c27] block mb-1">
                    Select Client Account *
                  </label>
                  {clients.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
                      No client accounts found. Please add a client first.
                    </div>
                  ) : (
                    <select
                      value={subClientId}
                      onChange={(e) => setSubClientId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#eff4ff] rounded-lg text-xs font-medium text-[#141c27] border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40"
                    >
                      {clients.map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-[#141c27] block mb-1">
                    Select Candidate &amp; Application *
                  </label>
                  {candidateApplications.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
                      No active candidate applications found in this workspace. Upload a resume first.
                    </div>
                  ) : (
                    <select
                      value={subApplicationId}
                      onChange={(e) => setSubApplicationId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#eff4ff] rounded-lg text-xs font-medium text-[#141c27] border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40"
                    >
                      {candidateApplications.map((app) => (
                        <option key={app.applicationId} value={app.applicationId}>
                          {app.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#eff4ff] border border-[#dee2ef] flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-[#6137e0] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[#45474c] leading-relaxed">
                    By default, the candidate dossier will be syndicated with anonymized contact details until the client accepts Stage 1 Intro.
                  </p>
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
                    type="submit"
                    disabled={isSubmitting || clients.length === 0 || candidateApplications.length === 0}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-[#000000] text-white hover:bg-[#131c29] shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    <span>Confirm &amp; Stage Submission</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <CoreFooter />
    </>
  );
}
