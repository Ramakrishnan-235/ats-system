"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  FolderOpen,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  Briefcase,
  GitMerge,
  Cpu,
  History,
  X,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Edit3,
} from "lucide-react";

interface IngestionItem {
  id: string;
  filename: string;
  size: string;
  hash: string;
  status: "Completed & Rubric Indexed" | "Still Processing" | "Extraction Warning" | "Duplicate Detected & Merged";
  statusColor: string;
  duration?: string;
  progress?: number;
  progressPass?: string;
  targetReq: string;
  targetRole: string;
  stageNote?: string;
  experienceYears?: number;
  skills?: string[];
  diagnosticTag?: string;
  warningDetail?: string;
  duplicateMatchDetail?: string;
  auditEvent?: string;
  candidateId?: string;
  isQuarantined?: boolean;
}

export default function CandidateImportsPipelinePage() {
  // Step 1: Destination Requisition
  const [destinationTarget, setDestinationTarget] = useState<"req_active" | "talent_pool">("req_active");

  // Step 2: Deduplication Strategy
  const [dedupStrategy, setDedupStrategy] = useState<"auto_merge" | "manual_review">("auto_merge");

  // Table Filters
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [targetJobFilter, setTargetJobFilter] = useState("All Ingestion Targets");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ingestion Queue State
  const [queueItems, setQueueItems] = useState<IngestionItem[]>([]);

  // Handle uploaded files
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: IngestionItem[] = Array.from(files).map((file, i) => ({
      id: `ing-${Date.now()}-${i}`,
      filename: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      hash: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
      status: "Still Processing",
      statusColor: "text-[#6137e0] bg-[#e7deff]/60",
      progress: 35,
      progressPass: "Extracting Text Streams & AST Nodes",
      targetReq: destinationTarget === "req_active" ? "REQ-204" : "BENCH-01",
      targetRole: destinationTarget === "req_active" ? "Senior Platform Engineer" : "General Talent Pool",
      diagnosticTag: "Server processing active (Daemon 04-East)",
    }));

    setQueueItems((prev) => [...newItems, ...prev]);
    showToast(`✓ Ingested ${files.length} file(s) into OCR pipeline queue`);

    // Simulate completion after 2.5 seconds
    setTimeout(() => {
      setQueueItems((prev) =>
        prev.map((item) =>
          item.progress === 35
            ? {
                ...item,
                status: "Completed & Rubric Indexed",
                statusColor: "text-emerald-700 bg-emerald-50",
                duration: "1.4s (3 pages)",
                progress: undefined,
                progressPass: undefined,
                candidateId: `CAN-${Math.floor(10000 + Math.random() * 90000)}`,
                diagnosticTag: "Rubric Verified: Leveling vectors calibrated",
              }
            : item
        )
      );
      showToast("✓ Ingestion batch completed: Entities extracted & rubric indexed!");
    }, 2800);
  };

  // Filter queue items
  const filteredItems = queueItems.filter((item) => {
    if (statusFilter === "Processing (9)" && item.status !== "Still Processing") return false;
    if (statusFilter === "Completed (51)" && item.status !== "Completed & Rubric Indexed") return false;
    if (statusFilter === "Warnings & OCR Flags (2)" && item.status !== "Extraction Warning") return false;
    if (statusFilter === "Merged Duplicates (2)" && item.status !== "Duplicate Detected & Merged") return false;
    if (targetJobFilter.includes("REQ-204") && item.targetReq !== "REQ-204") return false;
    if (targetJobFilter.includes("REQ-189") && item.targetReq !== "REQ-189") return false;
    if (targetJobFilter.includes("REQ-212") && item.targetReq !== "REQ-212") return false;
    return true;
  });

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
                  <span className="text-[#6137e0] font-bold">Parser Orchestrator v3.4</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#141c27] tracking-tight">
                  Candidate Imports &amp; Parsing Pipeline
                </h1>
                <p className="text-xs sm:text-sm text-[#45474c] max-w-2xl mt-1">
                  Bulk resume ingestion, CV extraction, duplicate deduplication, and rubric indexing with human-auditable citation trails.
                </p>
              </div>

              {/* Cluster Mode & Background State Indicator */}
              <div className="flex items-center gap-3 self-start lg:self-auto">
                <div className="flex items-center gap-2 bg-[#eff4ff] px-3.5 py-2 rounded-xl shadow-2xs border border-[#dee2ef]/50">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6137e0] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6137e0]"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs leading-none text-[#141c27] font-semibold">Async Daemon 04-East</span>
                    <span className="font-mono text-[11px] leading-tight text-[#45474c]">OCR Workers: 8 / 8 Active</span>
                  </div>
                </div>
                <button
                  onClick={() => showToast("Showing past batch ingestion records from Postgres audit tables")}
                  className="h-10 px-3.5 bg-white text-[#141c27] rounded-lg text-xs font-semibold shadow-2xs border border-[#dee2ef] hover:bg-[#eff4ff] transition-all flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <History className="w-4 h-4 text-[#75777c]" />
                  <span>Past Batches</span>
                </button>
              </div>
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

                  {/* Target Destination Selector */}
                  <div className="space-y-2">
                    {/* Option 1: Open Requisition */}
                    <label
                      onClick={() => setDestinationTarget("req_active")}
                      className={`group relative flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all border ${
                        destinationTarget === "req_active"
                          ? "bg-[#eff4ff] border-[#6137e0]/40 shadow-xs"
                          : "bg-white border-[#dee2ef]/60 hover:bg-[#eff4ff]/50"
                      }`}
                    >
                      <input
                        checked={destinationTarget === "req_active"}
                        onChange={() => setDestinationTarget("req_active")}
                        className="mt-1 h-4 w-4 text-[#6137e0] accent-[#6137e0]"
                        name="destination_target"
                        type="radio"
                        value="req_active"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#141c27]">Open Requisition Target</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#dbe3f2] text-[#141c27]">
                            REQ-204
                          </span>
                        </div>
                        <span className="text-xs text-[#141c27] mt-0.5 font-medium truncate">
                          Senior Platform Engineer • Infrastructure Core
                        </span>
                        <span className="font-mono text-[11px] text-[#45474c] mt-1">
                          Rubric ID: #RB-GO-K8S-SCALE • 6 Weighted Criteria
                        </span>
                      </div>
                    </label>

                    {/* Option 2: General Talent Pool */}
                    <label
                      onClick={() => setDestinationTarget("talent_pool")}
                      className={`group relative flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all border ${
                        destinationTarget === "talent_pool"
                          ? "bg-[#eff4ff] border-[#6137e0]/40 shadow-xs"
                          : "bg-white border-[#dee2ef]/60 hover:bg-[#eff4ff]/50"
                      }`}
                    >
                      <input
                        checked={destinationTarget === "talent_pool"}
                        onChange={() => setDestinationTarget("talent_pool")}
                        className="mt-1 h-4 w-4 text-[#6137e0] accent-[#6137e0]"
                        name="destination_target"
                        type="radio"
                        value="talent_pool"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-bold text-[#141c27]">General Talent Pool</span>
                        <span className="text-xs text-[#45474c] mt-0.5">
                          Unassigned bench • Skills tagged into universal semantic index
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Duplicate Record Strategy Radio Group */}
                <div className="space-y-2 bg-[#eff4ff]/60 p-4 rounded-xl border border-[#dee2ef]/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#45474c] font-bold">
                      Step 2 • Duplicate Identity Resolution
                    </span>
                    <Shield className="w-4 h-4 text-[#75777c]" />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      onClick={() => setDedupStrategy("auto_merge")}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white cursor-pointer border border-[#dee2ef]/50 hover:border-[#6137e0]/30 transition-colors"
                    >
                      <input
                        checked={dedupStrategy === "auto_merge"}
                        onChange={() => setDedupStrategy("auto_merge")}
                        className="mt-0.5 h-4 w-4 text-[#6137e0] accent-[#6137e0]"
                        name="dedup_strategy"
                        type="radio"
                        value="auto_merge"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#141c27]">
                          Auto-merge existing profile records
                        </span>
                        <span className="text-[11px] text-[#45474c] leading-snug">
                          Non-destructive append: appends modern tenure without overwriting historic recruiter notes.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setDedupStrategy("manual_review")}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/70 cursor-pointer border border-transparent hover:bg-white hover:border-[#dee2ef]/50 transition-colors"
                    >
                      <input
                        checked={dedupStrategy === "manual_review"}
                        onChange={() => setDedupStrategy("manual_review")}
                        className="mt-0.5 h-4 w-4 text-[#6137e0] accent-[#6137e0]"
                        name="dedup_strategy"
                        type="radio"
                        value="manual_review"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#141c27]">
                          Flag duplicates for manual recruiter merge
                        </span>
                        <span className="text-[11px] text-[#45474c] leading-snug">
                          Sends overlapping profiles to Stage Gate review queue before ingestion.
                        </span>
                      </div>
                    </label>
                  </div>
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
                    Step 3 • Payload Ingestion
                  </span>
                  <span className="text-xs text-[#45474c]">Tesseract OCR • Apache PDFBox • DOCX Native</span>
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
                    Drag &amp; drop PDF, DOCX, or ZIP batches here
                  </h2>
                  <p className="text-xs text-[#45474c] max-w-md mb-5 leading-relaxed">
                    Max 100 files per upload sequence (up to 50MB aggregate). Encrypted in transit with instant AES-256 vault segregation.
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
                    <span className="text-xs text-[#45474c]">or paste file clipboard (Ctrl+V)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.zip"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>
                </div>

                {/* Batch Constraints & Guardrails Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[#45474c] text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>PII stripping &amp; GDPR purge policies applied automatically</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Cpu className="w-4 h-4 text-[#75777c]" />
                    <span>Max concurrency: 12 docs/sec</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Persistent Processing Queue Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
              {/* Stat 1 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#45474c] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Total Ingested</span>
                  <Briefcase className="w-4 h-4 text-[#75777c]" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">64</span>
                  <span className="text-xs text-[#45474c]">files batch</span>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Completed &amp; Indexed</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">51</span>
                  <span className="text-xs text-emerald-700 font-bold">79.6% pass</span>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#6137e0] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Still Processing</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#6137e0]">9</span>
                  <span className="font-mono text-[11px] text-[#45474c]">Parse 4 • Rubric 5</span>
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div className="flex items-center justify-between text-red-600 mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Extraction Warnings</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-red-600">2</span>
                  <span className="text-xs text-red-600 font-semibold">Needs review</span>
                </div>
              </div>

              {/* Stat 5 */}
              <div className="bg-white p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between col-span-2 md:col-span-1">
                <div className="flex items-center justify-between text-[#45474c] mb-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider">Duplicate Merged</span>
                  <GitMerge className="w-4 h-4 text-[#75777c]" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-[#141c27]">2</span>
                  <span className="text-xs text-[#45474c]">Profile audit linked</span>
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
                      <option>All Statuses (64)</option>
                      <option>Processing (9)</option>
                      <option>Completed (51)</option>
                      <option>Warnings &amp; OCR Flags (2)</option>
                      <option>Merged Duplicates (2)</option>
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
                      <option>Senior Platform Engineer (REQ-204)</option>
                      <option>Lead Product Designer (REQ-189)</option>
                      <option>SRE / Platform (REQ-212)</option>
                      <option>General Talent Pool (Unassigned)</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => showToast("Persistent background parsing unhooked from browser tab")}
                    className="h-9 px-3 rounded-lg bg-[#eff4ff] text-[#141c27] text-xs font-semibold hover:bg-[#dee2ef] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Keep worker threads parsing in background without blocking current tab"
                    type="button"
                  >
                    <Clock className="w-4 h-4 text-[#75777c]" />
                    <span>Stop waiting (Keep server parsing in background)</span>
                  </button>
                  <button
                    onClick={() => showToast("Re-queuing 2 flagged files into OCR clean engine")}
                    className="h-9 px-3 rounded-lg bg-red-100 text-red-900 text-xs font-semibold hover:bg-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    type="button"
                  >
                    <RotateCcw className="w-4 h-4 text-red-700" />
                    <span>Retry Failed (2)</span>
                  </button>
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
                            <p className="text-xs text-[#75777c]">Drop PDF resumes above to start processing and rubric indexing.</p>
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
                            : item.status === "Extraction Warning"
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
                                {item.size} • SHA-256: {item.hash}
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
                                    : item.status === "Extraction Warning"
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
                              {item.targetReq} {item.stageNote ? `• ${item.stageNote}` : ""}
                            </span>
                          </div>
                        </td>

                        {/* Evidence Extracted / Diagnostic */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1 max-w-sm">
                            {item.experienceYears && (
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

                            {item.duplicateMatchDetail && (
                              <div className="p-2 rounded bg-[#eff4ff] border border-[#dee2ef] text-[#141c27]">
                                <span className="text-xs font-bold">Matched existing record Michael Chang (ID-9821).</span>
                                <p className="text-[11px] text-[#45474c] mt-0.5">
                                  Updated work history with 2024-2025 Staff position without discarding previous recruiter notes.
                                </p>
                              </div>
                            )}

                            {!item.warningDetail && !item.duplicateMatchDetail && item.diagnosticTag && (
                              <div className="flex items-center gap-1 text-[#6137e0] text-xs font-medium">
                                <span className="text-[11px] text-[#45474c]">{item.diagnosticTag}</span>
                              </div>
                            )}
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
                          ) : item.isQuarantined ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-red-700">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-xs font-bold">Requires Remediation</span>
                              </div>
                              <span className="font-mono text-[11px] text-[#75777c] block mt-0.5">
                                Dossier quarantined
                              </span>
                            </div>
                          ) : item.auditEvent ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-bold">Record Updated</span>
                              </div>
                              <span className="font-mono text-[11px] text-[#75777c] block mt-0.5">
                                {item.auditEvent}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[#45474c]">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#6137e0]" />
                              <span className="text-xs font-medium">Extracting Entity Graph...</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 align-top text-right">
                          {item.candidateId ? (
                            <Link
                              href={`/candidates/${item.candidateId}`}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#000000] text-white text-xs font-semibold hover:bg-[#131c29] transition-all cursor-pointer"
                            >
                              <span>View Candidate</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          ) : item.isQuarantined ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => showToast(`Retrying OCR parsing on ${item.filename}`)}
                                className="h-8 px-2.5 rounded-lg bg-[#dbe3f2] text-[#141c27] text-xs font-semibold hover:bg-[#eff4ff] transition-colors flex items-center gap-1 cursor-pointer"
                                type="button"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retry Parsing</span>
                              </button>
                              <button
                                onClick={() => showToast(`Opening manual OCR annotation studio for ${item.filename}`)}
                                className="h-8 px-2.5 rounded-lg bg-[#000000] text-white text-xs font-semibold hover:bg-[#131c29] transition-all flex items-center gap-1 cursor-pointer"
                                type="button"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Manual Text Entry</span>
                              </button>
                            </div>
                          ) : item.auditEvent ? (
                            <button
                              onClick={() => showToast(`Viewing merge diff for ${item.filename}`)}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#dbe3f2] text-[#141c27] text-xs font-semibold hover:bg-[#eff4ff] transition-colors cursor-pointer"
                              type="button"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              <span>View Merge Diff</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setQueueItems((prev) => prev.filter((q) => q.id !== item.id));
                                showToast(`Cancelled processing for ${item.filename}`);
                              }}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#dbe3f2] text-[#141c27] text-xs font-semibold hover:bg-red-100 hover:text-red-900 transition-all cursor-pointer"
                              type="button"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel file</span>
                            </button>
                          )}
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
                  <span className="font-bold text-[#141c27]">Proposed Scope:</span>
                  <span>Persistent queue keeps background sync alive even when navigating away.</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span>Memory Consumption: 412 MB</span>
                  <span>Queue Latency: 420ms</span>
                  <span className="text-emerald-700 font-bold">• Stream Healthy</span>
                </div>
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
                    Institutional Compliance &amp; Non-Probabilistic Assessment Policy
                  </span>
                  <p className="text-xs text-[#45474c] max-w-3xl mt-0.5 leading-relaxed">
                    CORE ATS forbids synthetic percentage scores (e.g. “94% fit”). Extraction parses factual timeline data, specific code snippets, and certifiable repository references for recruiter decision validation.
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
