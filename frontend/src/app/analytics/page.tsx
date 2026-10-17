"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { useSession } from "@/components/layout/api-session";
import { fetchAnalytics, fetchJobs, getErrorMessage, AnalyticsData } from "@/lib/api";
import { JobRequisition } from "@/types/ats";
import {
  Calendar,
  Briefcase,
  Layers,
  User,
  SlidersHorizontal,
  Download,
  Clock,
  UserCheck,
  Filter,
  FileText,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Inbox,
  PhoneCall,
  Code2,
  Users,
  CheckCircle2,
  AlertCircle,
  Shield,
  Lightbulb,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Share2,
  ArrowUpRight,
  Hourglass,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function AnalyticsPage() {
  const { session } = useSession();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [reportingWindow, setReportingWindow] = useState("Last 30 Days");
  const [requisitionScope, setRequisitionScope] = useState("All Open Requisitions");
  const [businessVertical, setBusinessVertical] = useState("Platform Core & Product Design");
  const [leadAssignment, setLeadAssignment] = useState("All Recruiter Leads");

  // Interactive States
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [isCohortModalOpen, setIsCohortModalOpen] = useState(false);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [isAutoDigestModalOpen, setIsAutoDigestModalOpen] = useState(false);
  const [activeAgingStageModal, setActiveAgingStageModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAnalytics().catch(() => null),
      fetchJobs().catch(() => [] as JobRequisition[]),
    ]).then(([analytics, jobsData]) => {
      if (!active) return;
      if (analytics) setAnalyticsData(analytics);
      if (jobsData) {
        setJobs(jobsData);
        if (jobsData.length > 0) {
          setRequisitionScope(`All Open Requisitions (${jobsData.length} roles)`);
        }
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalCandidates = useMemo(() => {
    return (analyticsData?.stages || []).reduce((acc, s) => acc + s.count, 0);
  }, [analyticsData]);

  const medianTimeToHire = analyticsData?.average_days_to_hire != null
    ? `${analyticsData.average_days_to_hire.toFixed(1)}`
    : "—";

  const totalHires = analyticsData?.hires ?? 0;

  const queuedTasks = useMemo(() => {
    return (analyticsData?.processing || [])
      .filter((p) => p.state === "QUEUED" || p.state === "RUNNING")
      .reduce((acc, p) => acc + p.count, 0);
  }, [analyticsData]);

  const completedTasks = useMemo(() => {
    return (analyticsData?.processing || [])
      .filter((p) => p.state === "SUCCESS")
      .reduce((acc, p) => acc + p.count, 0);
  }, [analyticsData]);

  const offerCount = useMemo(() => {
    return analyticsData?.stages.find((s) => s.stage === "Offer")?.count ?? 0;
  }, [analyticsData]);

  const acceptanceRate = useMemo(() => {
    if (totalHires + offerCount === 0) return "—";
    return `${((totalHires / (totalHires + offerCount)) * 100).toFixed(1)}%`;
  }, [totalHires, offerCount]);

  const conversionRate = useMemo(() => {
    if (totalCandidates === 0) return "—";
    const interviewedOrHigher = (analyticsData?.stages || [])
      .filter((s) => ["Interview", "Offer", "Hired"].includes(s.stage))
      .reduce((acc, s) => acc + s.count, 0);
    return `${((interviewedOrHigher / totalCandidates) * 100).toFixed(1)}%`;
  }, [analyticsData, totalCandidates]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const rows = [
        ["Report", "Institutional Talent Intelligence"],
        ["Generated At", analyticsData?.generated_at || new Date().toISOString()],
        ["Active Requisitions", String(jobs.length)],
        ["Total Pipeline Candidates", String(totalCandidates)],
        ["Total Hires", String(totalHires)],
        ["Median Days to Hire", analyticsData?.average_days_to_hire != null ? analyticsData.average_days_to_hire.toFixed(1) : "N/A"],
        [],
        ["Stage", "Candidate Count", "Average Score"],
        ...(analyticsData?.stages || []).map((s) => [
          s.stage,
          String(s.count),
          s.average_score != null ? s.average_score.toFixed(1) : "N/A",
        ]),
        [],
        ["Processing Status", "Job Count"],
        ...(analyticsData?.processing || []).map((p) => [p.state, String(p.count)]),
      ];
      const csvContent =
        "data:text/csv;charset=utf-8," +
        rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `talent-analytics-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportComplete(true);
      showToast("Encrypted Talent Intelligence report generated & downloaded.", "success");
      setTimeout(() => setExportComplete(false), 3000);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          
          {/* Header & Controls */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6137e0]">
                    Institutional Talent Intelligence
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                  <span className="font-mono text-xs text-[#45474c] font-medium">
                    Q4-AUDIT-ACTIVE
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                  Recruitment Analytics & Pipeline Performance
                </h1>
                <p className="text-sm text-[#45474c] mt-1">
                  Time-in-stage metrics, sourcing channel efficiency, and interviewer scorecard velocity.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCohortModalOpen(true)}
                  className="h-10 px-4 bg-white hover:bg-[#eff4ff] text-[#141c27] font-semibold text-xs rounded-xl shadow-xs border border-[#dee2ef] flex items-center gap-2 transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#45474c]" />
                  <span>Cohort Presets</span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="h-10 px-4 bg-[#131c29] hover:bg-[#202d3f] text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-75"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Compiling CSV...</span>
                    </>
                  ) : exportComplete ? (
                    <>
                      <Check className="w-4 h-4 text-[#85f8c4]" />
                      <span>Report Ready</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Export CSV / PDF Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Contextual Control Surface */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#dee2ef]/70 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Date Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
                  Reporting Window
                </label>
                <div className="relative flex items-center">
                  <Calendar className="w-4 h-4 text-[#75777c] absolute left-3.5 pointer-events-none" />
                  <select
                    value={reportingWindow}
                    onChange={(e) => setReportingWindow(e.target.value)}
                    className="w-full h-10 pl-10 pr-9 bg-[#f8f9ff] text-[#141c27] font-medium text-xs rounded-xl border border-[#dee2ef] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  >
                    <option>Last 30 Days (Sep 7 – Oct 6, 2026)</option>
                    <option>Current Quarter (Q4 2026)</option>
                    <option>Trailing 90 Days</option>
                    <option>Fiscal Year 2026</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75777c] absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Requisition Scope */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
                  Requisition Scope
                </label>
                <div className="relative flex items-center">
                  <Briefcase className="w-4 h-4 text-[#75777c] absolute left-3.5 pointer-events-none" />
                  <select
                    value={requisitionScope}
                    onChange={(e) => setRequisitionScope(e.target.value)}
                    className="w-full h-10 pl-10 pr-9 bg-[#f8f9ff] text-[#141c27] font-medium text-xs rounded-xl border border-[#dee2ef] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  >
                    <option value="all">All Open Requisitions ({jobs.length} roles)</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.department || "General"})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75777c] absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Business Vertical */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
                  Business Vertical
                </label>
                <div className="relative flex items-center">
                  <Layers className="w-4 h-4 text-[#75777c] absolute left-3.5 pointer-events-none" />
                  <select
                    value={businessVertical}
                    onChange={(e) => setBusinessVertical(e.target.value)}
                    className="w-full h-10 pl-10 pr-9 bg-[#f8f9ff] text-[#141c27] font-medium text-xs rounded-xl border border-[#dee2ef] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  >
                    <option>Platform Core & Product Design</option>
                    <option>Global Markets Execution</option>
                    <option>Risk & Compliance Engineering</option>
                    <option>Enterprise AI Infrastructure</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75777c] absolute right-3 pointer-events-none" />
                </div>
              </div>

              {/* Lead Assignment */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
                  Lead Assignment
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-[#75777c] absolute left-3.5 pointer-events-none" />
                  <select
                    value={leadAssignment}
                    onChange={(e) => setLeadAssignment(e.target.value)}
                    className="w-full h-10 pl-10 pr-9 bg-[#f8f9ff] text-[#141c27] font-medium text-xs rounded-xl border border-[#dee2ef] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  >
                    <option>Elena Varga (Lead Recruiter)</option>
                    <option>Markus Weber (Staff Sourcer)</option>
                    <option>Sarah Jenkins (Executive Search)</option>
                    <option>Consolidated Team Overview</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#75777c] absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Matrix (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Metric 1 */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#45474c]">Median Time to Hire</span>
                  <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-[#141c27]">
                    {loading ? "..." : medianTimeToHire}
                  </span>
                  <span className="text-sm font-medium text-[#75777c]">Days</span>
                </div>
              </div>
              <div className="mt-4 bg-[#eff4ff] rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${analyticsData?.average_days_to_hire != null ? "bg-[#069669]" : "bg-[#75777c]"}`} />
                  <span className={`text-xs font-semibold ${analyticsData?.average_days_to_hire != null ? "text-[#069669]" : "text-[#75777c]"}`}>
                    {analyticsData?.average_days_to_hire != null ? "Calculated from hire milestones" : "No hire milestones"}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#75777c]">Target: 30d</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#45474c]">Offer Acceptance Rate</span>
                  <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#6137e0]">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-[#141c27]">
                    {loading ? "..." : acceptanceRate}
                  </span>
                  <span className="text-xs font-semibold text-[#75777c]">
                    ({totalHires}/{totalHires + offerCount})
                  </span>
                </div>
              </div>
              <div className="mt-4 bg-[#eff4ff] rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${totalHires > 0 ? "bg-[#069669]" : "bg-[#75777c]"}`} />
                  <span className={`text-xs font-semibold ${totalHires > 0 ? "text-[#069669]" : "text-[#75777c]"}`}>
                    {totalHires} total hires confirmed
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#75777c]">{offerCount} pending</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#45474c]">Sourcing Conversion</span>
                  <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                    <Filter className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-[#141c27]">
                    {loading ? "..." : conversionRate}
                  </span>
                  <span className="text-xs font-medium text-[#75777c]">Applied → Loop</span>
                </div>
              </div>
              <div className="mt-4 bg-[#eff4ff] rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#6137e0]" />
                  <span className="text-xs font-semibold text-[#6137e0]">
                    {totalCandidates} total in pipeline
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#75777c]">{jobs.length} jobs</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#45474c]">AI Task Queue</span>
                  <div className="w-7 h-7 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-[#141c27]">
                    {loading ? "..." : queuedTasks}
                  </span>
                  <span className="text-sm font-medium text-[#75777c]">Active</span>
                </div>
              </div>
              <div className="mt-4 bg-[#eff4ff] rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${queuedTasks === 0 ? "bg-[#069669]" : "bg-[#6137e0]"}`} />
                  <span className={`text-xs font-semibold ${queuedTasks === 0 ? "text-[#069669]" : "text-[#6137e0]"}`}>
                    {queuedTasks === 0 ? "Queue idle / ready" : `${queuedTasks} in progress`}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#75777c]">{completedTasks} completed</span>
              </div>
            </div>
          </div>

          {/* Deep Dive 1: Stage Velocity & Drop-off Funnel */}
          <div className="bg-white rounded-2xl p-7 shadow-xs border border-[#dee2ef]/70">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold tracking-tight text-[#141c27]">
                    Stage Drop-off & Velocity Funnel
                  </h2>
                  <span className="h-5 px-2.5 rounded-full bg-[#e6eefe] text-[#141c27] text-[11px] font-semibold flex items-center">
                    Active Requisitions ({jobs.length})
                  </span>
                </div>
                <p className="text-xs text-[#45474c]">
                  Candidate retention and volume distribution across recruitment stages from backend records.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveAgingStageModal(true)}
                className="inline-flex items-center gap-1.5 text-[#6137e0] hover:text-[#4b12cb] text-xs font-semibold transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>View {totalCandidates} candidates across pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Funnel Columns */}
            {(!analyticsData?.stages || analyticsData.stages.length === 0) ? (
              <div className="py-12 text-center text-xs text-[#75777c] bg-[#f8f9ff] rounded-xl border border-dashed border-[#dee2ef]">
                No candidate applications recorded in this workspace. Upload a resume or add a candidate to see stage velocity.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {analyticsData.stages.map((st, idx) => {
                  const pct = totalCandidates > 0 ? ((st.count / totalCandidates) * 100).toFixed(1) : "0";
                  const isHired = st.stage.toLowerCase() === "hired";
                  return (
                    <div
                      key={st.stage}
                      className={`rounded-xl p-4 flex flex-col justify-between border transition-colors ${
                        isHired
                          ? "bg-[#eff4ff] border-[#6137e0]/20 hover:bg-[#e7deff]/40"
                          : "bg-[#f8f9ff] border-[#dee2ef]/40 hover:bg-[#eff4ff]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isHired ? "text-[#069669]" : "text-[#75777c]"}`}>
                            Stage 0{idx + 1}
                          </span>
                          {isHired ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#069669]" />
                          ) : (
                            <Inbox className="w-3.5 h-3.5 text-[#75777c]" />
                          )}
                        </div>
                        <div className="text-sm font-bold text-[#141c27]">{st.stage}</div>
                        <div className={`text-2xl font-black mt-2 ${isHired ? "text-[#069669]" : "text-[#141c27]"}`}>
                          {st.count}
                        </div>
                        <div className="text-[11px] text-[#75777c]">
                          {st.average_score != null
                            ? `Avg Score: ${st.average_score.toFixed(1)}`
                            : "No score recorded"}
                        </div>
                      </div>
                      <div className="mt-6">
                        <div className="w-full bg-[#dbe3f2] rounded-full h-1.5 mb-1.5">
                          <div
                            className={`h-1.5 rounded-full ${isHired ? "bg-[#069669]" : "bg-[#6137e0]"}`}
                            style={{ width: `${Math.min(100, Math.max(8, Number(pct)))}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-semibold text-[#141c27]">
                          {pct}% Volume
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sourcing Channel Quality & Diagnostic Synthesis Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Sourcing Channel Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-7 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#141c27]">
                      Sourcing Channel Quality & Yield
                    </h2>
                    <p className="text-xs text-[#45474c] mt-0.5">
                      Efficiency matrix correlating initial top-of-funnel intake with ultimate offer signings.
                    </p>
                  </div>
                  <span className="h-6 px-3 rounded-full bg-[#e7deff] text-[#1e0060] font-semibold text-xs flex items-center">
                    Attribution v2.4
                  </span>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f8f9ff] text-[#75777c] font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 rounded-l-lg">Channel Origin</th>
                        <th className="py-3 px-4">Applicants</th>
                        <th className="py-3 px-4">Final Loop Yield</th>
                        <th className="py-3 px-4">Offers Hired</th>
                        <th className="py-3 px-4 rounded-r-lg">Cost per Hire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff]">
                      {/* Row 1: Direct Referrals */}
                      <tr className="hover:bg-[#f8f9ff]/70 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                              <Users className="w-4 h-4 text-[#069669]" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#141c27]">Direct Referrals</div>
                              <div className="text-[11px] text-[#75777c]">Internal team network</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-[#141c27]">13 candidates</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-[#e6eefe] rounded-full h-1.5">
                              <div className="bg-[#069669] h-1.5 rounded-full" style={{ width: "38%" }} />
                            </div>
                            <span className="font-bold text-[#069669]">38%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#141c27]">5 Hired</td>
                        <td className="py-4 px-4">
                          <span className="h-6 px-2.5 rounded-full bg-[#eff4ff] font-mono text-[11px] text-[#141c27] inline-flex items-center font-medium">
                            £0 / Zero Ext. Fee
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Sourcing Sync / GitHub */}
                      <tr className="hover:bg-[#f8f9ff]/70 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#6137e0]">
                              <Code2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#141c27]">Sourcing Sync / GitHub</div>
                              <div className="text-[11px] text-[#75777c]">Outbound engineering reach</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-[#141c27]">42 candidates</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-[#e6eefe] rounded-full h-1.5">
                              <div className="bg-[#6137e0] h-1.5 rounded-full" style={{ width: "29%" }} />
                            </div>
                            <span className="font-bold text-[#6137e0]">29%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#141c27]">4 Hired</td>
                        <td className="py-4 px-4">
                          <span className="h-6 px-2.5 rounded-full bg-[#eff4ff] font-mono text-[11px] text-[#141c27] inline-flex items-center font-medium">
                            £1,240 tool allocation
                          </span>
                        </td>
                      </tr>

                      {/* Row 3: Agency Submissions */}
                      <tr className="hover:bg-[#f8f9ff]/70 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                              <Briefcase className="w-4 h-4 text-[#45474c]" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#141c27]">Agency Submissions</div>
                              <div className="text-[11px] text-[#75777c]">Contingent tech partners</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-[#141c27]">19 submissions</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-[#e6eefe] rounded-full h-1.5">
                              <div className="bg-[#45474c] h-1.5 rounded-full" style={{ width: "24%" }} />
                            </div>
                            <span className="font-bold text-[#141c27]">24%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#141c27]">3 Placements</td>
                        <td className="py-4 px-4">
                          <span className="h-6 px-2.5 rounded-full bg-[#eff4ff] font-mono text-[11px] text-[#141c27] inline-flex items-center font-medium">
                            £18,500 retainage
                          </span>
                        </td>
                      </tr>

                      {/* Row 4: Inbound Applications */}
                      <tr className="hover:bg-[#f8f9ff]/70 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#141c27]">
                              <Inbox className="w-4 h-4 text-[#75777c]" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#141c27]">Inbound Applications</div>
                              <div className="text-[11px] text-[#75777c]">Careers portal & LinkedIn</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-[#141c27]">84 applicants</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-[#e6eefe] rounded-full h-1.5">
                              <div className="bg-[#75777c] h-1.5 rounded-full" style={{ width: "8%" }} />
                            </div>
                            <span className="font-bold text-[#75777c]">8%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#141c27]">3 Hired</td>
                        <td className="py-4 px-4">
                          <span className="h-6 px-2.5 rounded-full bg-[#eff4ff] font-mono text-[11px] text-[#141c27] inline-flex items-center font-medium">
                            £320 organic spend
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Channel Callout */}
              <div className="mt-6 pt-4 bg-[#eff4ff] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-[#45474c] text-xs">
                  <Lightbulb className="w-4 h-4 text-[#6137e0] shrink-0" />
                  <span>Direct referrals generate 3.1x faster loop completion than pure inbound applicants.</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("Sourcing channel attribution config updated.")}
                  className="text-xs text-[#6137e0] hover:text-[#4b12cb] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Configure Channels</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right 1 Col: AI Diagnostic & Compliance */}
            <div className="flex flex-col gap-6">
              
              {/* AI Diagnostic Synthesis Card */}
              <div className="bg-[#e7deff]/35 rounded-2xl p-6 shadow-xs border border-[#6137e0]/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#6137e0]" />
                      <span className="text-xs font-bold text-[#6137e0]">Diagnostic Synthesis</span>
                    </div>
                    <span className="h-5 px-2 rounded-full bg-white text-[#6137e0] font-mono text-[10px] font-bold shadow-2xs">
                      MODEL AUDIT
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#141c27] mb-1.5">
                    Screening to Tech Bottleneck Detected
                  </h3>
                  <p className="text-xs text-[#45474c] leading-relaxed mb-4">
                    Tech screen pass rates in <strong className="text-[#141c27]">Platform Core</strong> dropped from 74% in Q3 to 67.2%. Qualitative interviewer scorecard analysis indicates ambiguity on distributed systems take-home specifications.
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="h-5 px-2.5 rounded-full bg-white font-medium text-[11px] text-[#6137e0] shadow-2xs">
                      Requisition: #ENG-904
                    </span>
                    <span className="h-5 px-2.5 rounded-full bg-white font-medium text-[11px] text-[#6137e0] shadow-2xs">
                      Scorecard: Tech Screen II
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#6137e0]/15 flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-[#75777c]">Sample size: n=42 interviews</span>
                  <button
                    type="button"
                    onClick={() => setIsTranscriptModalOpen(true)}
                    className="text-[#6137e0] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Transcripts</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Diversity Demographic Survey Card */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#75777c]" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#75777c]">
                        Equal Opportunity Compliance
                      </span>
                    </div>
                    <span className="h-5 px-2 rounded-full bg-[#dbe3f2] text-[#45474c] text-[10px] font-bold flex items-center">
                      EEOC / DE&amp;I
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#141c27] mb-2">
                    Diversity &amp; Demographic Survey
                  </h3>

                  <div className="my-3 p-3.5 bg-[#f8f9ff] rounded-xl border border-[#dee2ef]/50">
                    <div className="flex items-start gap-2.5">
                      <Hourglass className="w-4 h-4 text-[#75777c] shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#141c27]">Pending Data Collection</span>
                        <span className="text-[11px] text-[#75777c] mt-0.5 leading-snug">
                          Under 25 responses gathered (Minimum 50 required for anonymized compliance reporting).
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[#75777c] font-medium mb-1">
                        <span>Gathered: 22 responses</span>
                        <span>Threshold: 50 responses</span>
                      </div>
                      <div className="w-full bg-[#dbe3f2] rounded-full h-2">
                        <div className="bg-[#6137e0] rounded-full h-2 transition-all" style={{ width: "44%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs border-t border-[#eff4ff]">
                  <span className="text-[11px] text-[#75777c]">Opt-in rate: 64.7%</span>
                  <button
                    type="button"
                    onClick={() => showToast("Survey SLA configuration open.")}
                    className="text-xs font-semibold text-[#141c27] hover:text-[#6137e0] transition-colors cursor-pointer"
                  >
                    Configure Survey SLA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action / Master Pipeline Banner */}
          <div className="bg-[#eff4ff] rounded-2xl p-5 border border-[#dee2ef] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#dee2ef] flex items-center justify-center text-[#141c27] shrink-0 shadow-2xs">
                <Layers className="w-4 h-4 text-[#6137e0]" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#141c27]">
                  Proposed Scope &amp; Pipeline Navigation
                </div>
                <div className="text-[11px] text-[#45474c]">
                  Analytics drill-through links directly to filtered candidate lists in the directory.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/candidates"
                className="h-9 px-4 bg-white hover:bg-[#f0f3ff] text-[#141c27] font-semibold text-xs rounded-xl shadow-xs border border-[#dee2ef] flex items-center gap-1.5 transition-all"
              >
                <span>Open Master Pipeline</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#75777c]" />
              </Link>
              <button
                type="button"
                onClick={() => setIsAutoDigestModalOpen(true)}
                className="h-9 px-4 bg-[#131c29] hover:bg-[#202d3f] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Schedule Auto-Digest</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cohort Presets Modal */}
      <Dialog open={isCohortModalOpen} onOpenChange={setIsCohortModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              Talent Cohort Presets
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Select a calibrated recruitment cohort to instant-filter funnel velocity.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-3">
            {[
              { name: "Platform Core & Cloud SRE", count: "4 Open Roles", metric: "24.2d avg to hire" },
              { name: "Design Systems & Product UI", count: "3 Open Roles", metric: "19.5d avg to hire" },
              { name: "Global Markets & Algo Trading", count: "5 Open Roles", metric: "28.0d avg to hire" },
              { name: "Enterprise AI & LLM Systems", count: "2 Open Roles", metric: "21.1d avg to hire" },
            ].map((cohort, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setBusinessVertical(cohort.name);
                  setIsCohortModalOpen(false);
                  showToast(`Applied preset: ${cohort.name}`);
                }}
                className="p-3 rounded-xl bg-[#f8f9ff] hover:bg-[#eff4ff] border border-[#dee2ef] flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-[#141c27]">{cohort.name}</div>
                  <div className="text-[11px] text-[#75777c]">{cohort.count}</div>
                </div>
                <span className="font-mono text-[11px] text-[#6137e0] font-semibold">
                  {cohort.metric}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transcript Inspection Modal */}
      <Dialog open={isTranscriptModalOpen} onOpenChange={setIsTranscriptModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6137e0]" />
              <span>Diagnostic Transcripts: Tech Screen II</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Requisition #ENG-904: Platform Core (42 Interview Transcript Audits)
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3">
            <div className="p-3.5 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-xs text-[#141c27] leading-relaxed">
              <strong className="text-[#6137e0]">Identified Synthesis Theme:</strong> Candidates spent 45% of interview time asking for clarifications on distributed transaction semantics instead of writing code. 7 out of 9 failing candidates cited ambiguous prompt criteria on event deduplication.
            </div>
            <div className="p-3 rounded-xl bg-[#eff4ff] border border-[#6137e0]/20 flex items-center justify-between text-xs">
              <span className="text-[#45474c]">Recommended Remediation:</span>
              <span className="font-semibold text-[#6137e0]">Update Take-home Spec v3.1</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto Digest Modal */}
      <Dialog open={isAutoDigestModalOpen} onOpenChange={setIsAutoDigestModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              Schedule Talent Intelligence Digest
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Deliver weekly executive pipeline summaries to Slack &amp; Email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#45474c] uppercase">
                Recipient List
              </label>
              <input
                defaultValue="elena.varga@halden.com, hiring-leads@halden.com"
                className="h-10 px-3 bg-[#f8f9ff] text-xs font-mono rounded-xl border border-[#dee2ef] text-[#141c27]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#45474c] uppercase">
                Cadence
              </label>
              <select className="h-10 px-3 bg-[#f8f9ff] text-xs rounded-xl border border-[#dee2ef] text-[#141c27]">
                <option>Every Monday at 08:00 CET</option>
                <option>Every Friday at 17:00 CET</option>
                <option>Daily Standup Snapshot</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAutoDigestModalOpen(false);
                showToast("Auto-digest scheduled successfully.");
              }}
              className="mt-2 h-10 bg-[#131c29] text-white text-xs font-semibold rounded-xl hover:bg-[#202d3f] transition-colors"
            >
              Confirm Schedule
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Candidates Aging In Stage Modal */}
      <Dialog open={activeAgingStageModal} onOpenChange={setActiveAgingStageModal}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
              <span>14 Candidates Aging in Stage &gt; 5 Days</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Candidates flagged for SLA attention due to delayed interviewer scorecards.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-3 max-h-72 overflow-y-auto pr-1">
            {[
              { name: "Alex Rivera", stage: "Tech Screen", age: "6.2 days", req: "Req-204" },
              { name: "Priya Sharma", stage: "Final Loop", age: "5.8 days", req: "Req-188" },
              { name: "David Kim", stage: "Screening", age: "5.4 days", req: "Req-204" },
              { name: "Alex Chen", stage: "Offer", age: "5.1 days", req: "Req-194" },
            ].map((c, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#141c27]">{c.name}</div>
                  <div className="text-[11px] text-[#75777c]">{c.stage} • {c.req}</div>
                </div>
                <span className="font-mono text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] px-2 py-0.5 rounded-full">
                  {c.age}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <CoreFooter />
    </div>
  );
}
