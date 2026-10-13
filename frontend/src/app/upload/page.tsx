"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { useSession } from "@/components/layout/api-session";
import { fetchJobs, uploadResumeFile, getErrorMessage } from "@/lib/api";
import { completedProfile, monitorIngestion, resumeHash } from "@/lib/ingestion";
import type { JobRequisition } from "@/types/ats";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  FolderOpen,
  Shield,
  Filter,
  Briefcase,
  Cpu,
  History,
  X,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

type IngestionStatus = "Uploading" | "Still Processing" | "Completed" | "Failed" | "Status unavailable";
interface IngestionItem {
  id: string; filename: string; size: string; hash: string;
  status: IngestionStatus; statusColor: string;
  taskId?: string; candidateId?: string; progress?: number; progressPass?: string;
  targetReq: string; targetRole: string; diagnosticTag?: string; warningDetail?: string;
  experienceYears?: number; skills?: string[]; duration?: string; startedAt: number;
  evaluationStatus?: string; matchScore?: number | null;
}

const PROCESSING_COLOR = "text-[#6137e0] bg-[#e7deff]/60";
const FAILED_COLOR = "text-red-700 bg-red-50";

export default function CandidateImportsPipelinePage() {
  const { session } = useSession();
  return <UploadPipeline key={session?.user.tenant_id || "disconnected"} />;
}

function UploadPipeline() {
  const [destinationTarget, setDestinationTarget] = useState("talent_pool");
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [jobsError, setJobsError] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [targetJobFilter, setTargetJobFilter] = useState("All Ingestion Targets");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queueItems, setQueueItems] = useState<IngestionItem[]>([]);
  const monitors = useRef(new Map<string, AbortController>());
  const uploads = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const currentMonitors = monitors.current;
    const currentUploads = uploads.current;
    let active = true;
    fetchJobs({ status: "OPEN" }).then(value => {
      if (active) setJobs(value.filter(job => job.status === "OPEN"));
    }).catch(error => {
      if (active) setJobsError(getErrorMessage(error));
    }).finally(() => { if (active) setLoadingJobs(false); });
    return () => {
      active = false;
      mounted.current = false;
      currentMonitors.forEach(controller => controller.abort());
      currentMonitors.clear();
      currentUploads.forEach(controller => controller.abort());
      currentUploads.clear();
    };
  }, []);

  const updateItem = (id: string, patch: Partial<IngestionItem>) => {
    if (mounted.current) setQueueItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const monitorItem = async (item: IngestionItem) => {
    if (!item.taskId || monitors.current.has(item.id)) return;
    const controller = new AbortController();
    monitors.current.set(item.id, controller);
    updateItem(item.id, { status: "Still Processing", statusColor: PROCESSING_COLOR, warningDetail: undefined });
    try {
      await monitorIngestion(item.taskId, controller.signal, async task => {
        if (controller.signal.aborted) return;
        if (task.state === "FAILURE") {
          updateItem(item.id, { status: "Failed", statusColor: FAILED_COLOR, progress: undefined,
            warningDetail: task.error || "Resume processing failed on the server.", diagnosticTag: "Backend processing failed" });
        } else if (task.state === "SUCCESS") {
          const profile = await completedProfile(task);
          if (controller.signal.aborted) return;
          updateItem(item.id, { status: "Completed", statusColor: "text-emerald-700 bg-emerald-50",
            candidateId: profile.id, progress: undefined, progressPass: undefined,
            duration: ((Date.now() - item.startedAt) / 1000).toFixed(1) + "s elapsed",
            experienceYears: profile.years_of_experience, skills: profile.core_skills,
            evaluationStatus: task.result?.evaluation_status || "Not reported",
            matchScore: task.result?.match_score ?? null, diagnosticTag: "Saved candidate profile verified" });
        } else {
          updateItem(item.id, { progress: typeof task.progress === "number" ? Math.max(0, Math.min(100, task.progress)) : undefined,
            progressPass: task.step || task.state, diagnosticTag: "Backend task: " + task.state });
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) updateItem(item.id, { status: "Status unavailable", statusColor: FAILED_COLOR,
        warningDetail: getErrorMessage(error) + " Server processing may continue. Check status again.", progress: undefined });
    } finally {
      if (monitors.current.get(item.id) === controller) monitors.current.delete(item.id);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const job = jobs.find(value => value.id === destinationTarget);
    if (destinationTarget !== "talent_pool" && !job) {
      setToastMessage("Select an available open job or the talent pool."); return;
    }
    const items = Array.from(files).map(file => ({ file, item: {
      id: crypto.randomUUID(), filename: file.name, size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      hash: "Pending validation", status: "Uploading" as const, statusColor: PROCESSING_COLOR,
      targetReq: job?.id || "talent_pool", targetRole: job?.title || "General Talent Pool", startedAt: Date.now(),
      diagnosticTag: "Waiting to send file",
    } }));
    setQueueItems(prev => [...items.map(value => value.item), ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Submit files sequentially; backend tasks are monitored independently.
    for (const { file, item } of items) {
      const controller = new AbortController();
      uploads.current.set(item.id, controller);
      try {
        const hash = await resumeHash(file);
        if (controller.signal.aborted) break;
        updateItem(item.id, { hash, diagnosticTag: "Sending file to backend" });
        const accepted = await uploadResumeFile(file, job?.id, controller.signal, { idempotencyKey: item.id });
        if (controller.signal.aborted) break;
        if (!accepted.task_id) throw new Error("The backend did not return a processing task. Completion cannot be confirmed.");
        const queued = { ...item, taskId: accepted.task_id };
        updateItem(item.id, { taskId: accepted.task_id, status: "Still Processing", diagnosticTag: accepted.message || "Queued by backend" });
        void monitorItem(queued);
      } catch (error) {
        if (controller.signal.aborted) break;
        updateItem(item.id, { status: "Failed", statusColor: FAILED_COLOR, warningDetail: getErrorMessage(error),
          diagnosticTag: "Upload not confirmed" });
      } finally { uploads.current.delete(item.id); }
    }
  };

  const completed = queueItems.filter(item => item.status === "Completed").length;
  const processing = queueItems.filter(item => ["Uploading", "Still Processing"].includes(item.status)).length;
  const failed = queueItems.filter(item => item.status === "Failed").length;
  const unavailable = queueItems.filter(item => item.status === "Status unavailable").length;
  const filteredItems = queueItems.filter(item =>
    (statusFilter === "All Statuses" || item.status === statusFilter) &&
    (targetJobFilter === "All Ingestion Targets" || item.targetReq === targetJobFilter));

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            {/* Toast feedback */}
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

            {/* Pipeline Header Segment with Breadcrumb & System State */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-[#45474c] text-xs font-semibold mb-1 uppercase tracking-wider">
                  <span className="hover:text-[#171c25] cursor-pointer">Workspace Ingestion</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#75777c]" />
                  <span className="hover:text-[#171c25] cursor-pointer">Requisition Ingestion</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#75777c]" />
                  <span className="text-[#6137e0] font-bold">Resume Processing</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#141c27] tracking-tight">
                  Candidate Imports &amp; Parsing Pipeline
                </h1>
                <p className="text-xs sm:text-sm text-[#45474c] max-w-2xl mt-1">
                  Upload PDF resumes, follow backend processing, and review saved candidate profiles.
                </p>
              </div>

              <Link href="/candidates" className="h-10 px-3.5 bg-white text-[#141c27] rounded-lg text-xs font-semibold border border-[#dee2ef] inline-flex items-center gap-1.5 self-start"><History className="w-4 h-4" /> View saved candidates</Link>
            </div>

            {/* Ingestion Configuration & Upload Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
              {/* Left Configuration: Target Destination & Merge Governance (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between bg-white p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 gap-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#45474c] font-bold">
                      Step 1 • Destination Requisition
                    </span>
                    <span className="text-xs text-[#6137e0] bg-[#e7deff] px-2 py-0.5 rounded-full font-semibold">
                      Deterministic Routing
                    </span>
                  </div>

                  <div className="space-y-3">
                    <label htmlFor="upload-destination" className="text-sm font-bold text-[#141c27]">Destination</label>
                    <select id="upload-destination" value={destinationTarget} onChange={event => setDestinationTarget(event.target.value)} className="w-full rounded-xl border border-[#dee2ef] bg-[#eff4ff] p-3 text-sm">
                      <option value="talent_pool">General Talent Pool</option>
                      {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
                    </select>
                    {loadingJobs && <p className="text-xs text-[#45474c]">Loading open jobs…</p>}
                    {jobsError && <p role="alert" className="text-xs text-red-700">Jobs could not be loaded: {jobsError}</p>}
                    {!loadingJobs && !jobsError && <p className="text-xs text-[#45474c]">{jobs.length} open jobs available</p>}
                    <p className="text-xs text-[#45474c]">A selected job is sent with the resume for job-specific evaluation. Talent pool uploads create an unassigned profile.</p>
                  </div>
                </div>
                <div className="bg-[#eff4ff]/60 p-4 rounded-xl border border-[#dee2ef]/50 text-xs text-[#45474c] space-y-2">
                  <p className="font-bold text-[#141c27]">Server-confirmed results</p>
                  <p>Completion is shown after the backend finishes processing and the saved candidate can be retrieved. AI evaluation status is reported separately.</p>
                </div>
              </div>

              {/* Right Upload Drag-and-Drop Dropzone (7 cols) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={`lg:col-span-7 flex flex-col justify-between bg-white p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border relative overflow-hidden transition-all ${
                  isDragging
                    ? "border-[#6137e0] bg-[#e7deff]/20 scale-[1.005]"
                    : "border-[#dee2ef]/70"
                }`}
              >
                {/* Decorative ambient gradient */}
                <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#e7deff]/40 blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-[#45474c] font-bold">
                    Step 2 • Resume Upload
                  </span>
                  <span className="text-xs text-[#45474c]">PDF resumes</span>
                </div>

                {/* Drag & Drop Visual Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 my-2 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#eff4ff] hover:bg-[#e1e8f8]/60 transition-colors cursor-pointer border border-dashed border-[#c5c6cc]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#e7deff] flex items-center justify-center text-[#6137e0] mb-4 shadow-xs">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h2 className="text-base font-bold text-[#141c27] mb-1">
                    Drag &amp; drop PDF resumes here
                  </h2>
                  <p className="text-xs text-[#45474c] max-w-md mb-5 leading-relaxed">
                    PDF only, up to 10 MB per file. Files are sent to the backend for processing.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="h-10 px-4 bg-[#000000] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md hover:bg-[#131c29] transition-all cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Browse files</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>
                </div>

                {/* Batch Constraints & Guardrails Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[#45474c] text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resume processing runs on the backend</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Cpu className="w-4 h-4 text-[#75777c]" />
                    <span>Live task status</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Persistent Processing Queue Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
              {/* Stat 1 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#45474c] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Files selected this visit</span>
                  <Briefcase className="w-4 h-4 text-[#75777c]" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">{queueItems.length}</span>
                  <span className="text-xs text-[#45474c]">files selected</span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Profiles saved</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">{completed}</span>
                  <span className="text-xs text-emerald-700 font-bold">{queueItems.length ? ((completed / queueItems.length) * 100).toFixed(1) : "0"}% completed</span>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#6137e0] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Still Processing</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#6137e0]">{processing}</span>
                  <span className="font-mono text-[11px] text-[#45474c]">Uploads and backend tasks</span>
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-red-600 mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Failed</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-red-600">{failed}</span>
                  <span className="text-xs text-red-600 font-semibold">Needs review</span>
                </div>
              </div>

              {/* Stat 5 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between col-span-2 md:col-span-1">
                <div className="flex items-center justify-between text-[#45474c] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Status unavailable</span>
                  <RefreshCw className="w-4 h-4 text-[#75777c]" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">{unavailable}</span>
                  <span className="text-xs text-[#45474c]">Check status again</span>
                </div>
              </div>
            </div>

            {/* Persistent Queue Main Table Card */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 overflow-hidden flex flex-col">
              {/* Queue Control Header Bar */}
              <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-b border-[#dee2ef]/50">
                <div className="flex items-center flex-wrap gap-2.5">
                  <div className="flex items-center gap-1.5 bg-[#eff4ff] px-3 py-1.5 rounded-lg border border-[#dee2ef]/50">
                    <Filter className="w-4 h-4 text-[#75777c]" />
                    <span className="text-xs text-[#45474c] font-semibold">Filter by Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      aria-label="Filter queue by status"
                      className="bg-transparent text-xs font-bold text-[#141c27] focus:outline-none cursor-pointer"
                    >
                      <option value="All Statuses">All Statuses ({queueItems.length})</option>
                      <option value="Uploading">Uploading ({queueItems.filter(item => item.status === "Uploading").length})</option>
                      <option value="Still Processing">Processing ({queueItems.filter(item => item.status === "Still Processing").length})</option>
                      <option value="Completed">Completed ({completed})</option>
                      <option value="Failed">Failed ({failed})</option>
                      <option value="Status unavailable">Status unavailable ({unavailable})</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#eff4ff] px-3 py-1.5 rounded-lg border border-[#dee2ef]/50">
                    <Briefcase className="w-4 h-4 text-[#75777c]" />
                    <span className="text-xs text-[#45474c] font-semibold">Target Job:</span>
                    <select
                      value={targetJobFilter}
                      onChange={(e) => setTargetJobFilter(e.target.value)}
                      aria-label="Filter queue by target job"
                      className="bg-transparent text-xs font-bold text-[#141c27] focus:outline-none cursor-pointer"
                    >
                      <option>All Ingestion Targets</option>
                      {Array.from(new Map(queueItems.map(item => [item.targetReq, item.targetRole])).entries()).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button type="button" onClick={() => queueItems.filter(item => item.status === "Status unavailable").forEach(item => void monitorItem(item))}
                    disabled={!unavailable} className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-semibold disabled:opacity-40">Check unavailable status ({unavailable})</button>
                </div>
              </div>

              {/* Processing Queue Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-[#141c27]">
                  <thead className="bg-[#eff4ff] text-[#45474c] text-[11px] font-bold uppercase tracking-wider border-b border-[#dee2ef]">
                    <tr>
                      <th className="py-3 px-5">Source File &amp; Hash</th>
                      <th className="py-3 px-4">Parsing Pipeline Status</th>
                      <th className="py-3 px-4">Target Requisition</th>
                      <th className="py-3 px-4">Evidence Extracted / Diagnostic</th>
                      <th className="py-3 px-4">Ingestion Result</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dee2ef]/40 text-xs">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#75777c]">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Upload className="w-8 h-8 text-[#9ea3ae]" />
                            <p className="font-semibold text-sm text-[#171c25]">Ingestion Queue is Empty</p>
                            <p className="text-xs text-[#75777c]">Drop PDF resumes above to send them to the backend.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          item.status === "Still Processing"
                            ? "bg-[#e7deff]/10 hover:bg-[#e7deff]/20"
                            : item.status === "Failed"
                            ? "bg-red-50/50 hover:bg-red-50"
                            : "hover:bg-[#eff4ff]/40"
                        }`}
                      >
                        {/* Source File & Hash */}
                        <td className="py-4 px-5 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#dbe3f2] text-[#141c27] flex items-center justify-center shrink-0 mt-0.5">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-[#141c27] truncate max-w-[220px]">
                                {item.filename}
                              </span>
                              <span className="font-mono text-[11px] text-[#75777c]">
                                {item.size} • SHA-256: {item.hash.length === 64 ? item.hash.slice(0, 12) + "…" : item.hash}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Parsing Pipeline Status */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1 items-start">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.statusColor}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.status === "Still Processing"
                                    ? "bg-[#6137e0] animate-pulse"
                                    : item.status === "Failed"
                                    ? "bg-red-600"
                                    : "bg-emerald-600"
                                }`}
                              ></span>
                              <span>{item.status}</span>
                            </div>

                            {item.progress !== undefined ? (
                              <div className="w-48 mt-1">
                                <div className="w-full bg-[#dbe3f2] h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-[#6137e0] h-full rounded-full transition-all duration-500"
                                    style={{ width: `${item.progress}%` }}
                                  ></div>
                                </div>
                                <span className="font-mono text-[10px] text-[#45474c] mt-0.5 block">
                                  {item.progressPass}
                                </span>
                              </div>
                            ) : item.duration ? (
                              <span className="font-mono text-[11px] text-[#75777c]">
                                Duration: {item.duration}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Target Requisition */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#141c27]">{item.targetRole}</span>
                            <span className="font-mono text-[11px] text-[#45474c]">
                              {item.targetReq === "talent_pool" ? "Unassigned" : item.targetReq}
                            </span>
                          </div>
                        </td>

                        {/* Evidence Extracted / Diagnostic */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1 max-w-sm">
                            {item.experienceYears !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold bg-[#dbe3f2] px-2 py-0.5 rounded text-[#141c27]">
                                  {item.experienceYears}y experience
                                </span>
                                {item.skills?.map((sk) => (
                                  <span
                                    key={sk}
                                    className="text-[10px] font-bold bg-[#e7deff] text-[#1e0060] px-2 py-0.5 rounded"
                                  >
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.warningDetail && (
                              <div className="p-2 rounded bg-white border border-red-200 text-red-900">
                                <div className="flex items-center gap-1 text-red-700 text-xs font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{item.diagnosticTag}</span>
                                </div>
                                <p className="text-[11px] text-red-800 mt-0.5">{item.warningDetail}</p>
                              </div>
                            )}

                            {!item.warningDetail && item.diagnosticTag && <p className="text-[11px] text-[#45474c]">{item.diagnosticTag}</p>}
                            {item.evaluationStatus && <p className="text-[11px] text-[#45474c]">AI evaluation: {item.evaluationStatus}</p>}
                            {item.matchScore != null && <p className="text-xs font-semibold">Job match score: {item.matchScore}/100</p>}
                          </div>
                        </td>

                        {/* Ingestion Result */}
                        <td className="py-4 px-4 align-top">
                          {item.candidateId ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <Link
                                  href={`/candidates/${item.candidateId}`}
                                  className="font-bold text-[#141c27] underline hover:text-[#6137e0]"
                                >
                                  Candidate Profile Created
                                </Link>
                              </div>
                              <span className="font-mono text-[11px] text-[#75777c] block mt-0.5">
                                ID: {item.candidateId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#45474c]">{item.status === "Failed" ? "No completed profile confirmed" : "Awaiting backend confirmation"}</span>
                          )}
                        </td>
                        <td className="py-4 px-5 align-top text-right">
                          {item.candidateId ? (
                            <Link href={`/candidates/${item.candidateId}`} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-black text-white text-xs font-semibold">View Profile <ExternalLink className="w-3.5 h-3.5" /></Link>
                          ) : item.status === "Status unavailable" && item.taskId ? (
                            <button type="button" onClick={() => void monitorItem(item)} className="h-8 px-3 rounded-lg bg-[#eff4ff] text-xs font-semibold">Check status</button>
                          ) : <span className="text-xs text-[#75777c]">{item.status === "Failed" ? "Upload a corrected PDF to try again" : "Processing on server"}</span>}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>

              {/* Persistent Queue Footer Status Strip */}
              <div className="p-3.5 sm:p-4 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#45474c] text-xs border-t border-[#dee2ef]/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6137e0]" />
                  <span>Metrics cover files selected during this visit. Saved profiles remain in Candidates.</span>
                </div>
                <span>{filteredItems.length} of {queueItems.length} files shown</span>
              </div>
            </div>

            {/* Evidence & Governance Callout (Institutional Rigor standard) */}
            <div className="mt-5 bg-[#e7deff]/40 border border-[#cbbeff]/60 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white text-[#6137e0] flex items-center justify-center shrink-0 shadow-xs border border-[#dee2ef]">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#141c27]">
                    Review extracted information
                  </span>
                  <p className="text-xs text-[#45474c] max-w-3xl mt-0.5 leading-relaxed">
                    Review the saved profile and evidence before using the result. A completed upload does not mean that job-specific AI evaluation succeeded.
                  </p>
                </div>
              </div>
              <Link
                href="/audit-log"
                className="px-4 py-2 rounded-lg bg-white text-[#6137e0] text-xs font-bold hover:bg-[#eff4ff] transition-colors shrink-0 shadow-xs border border-[#dee2ef]"
              >
                Review Audit Logs
              </Link>
            </div>
          </div>
        </div>
      </main>

      <CoreFooter />
    </>
  );
}
