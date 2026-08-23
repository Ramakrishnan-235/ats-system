"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Bell,
  User,
  Calendar,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Terminal,
  FileCode,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  timestamp: string;
  candidateInitials: string;
  candidateName: string;
  jobRole: string;
  jobReq: string;
  model: string;
  tokens: string;
  latency: string;
  status: "OK" | "WARNING" | "FAILED";
  promptTokens: number;
  responseTokens: number;
  promptText: string;
  responseText: string;
  rationale: string;
}

const MOCK_AUDIT_LOGS: AuditEntry[] = [
  {
    id: "aud-001",
    timestamp: "Jan 20 14:32:07",
    candidateInitials: "PS",
    candidateName: "Priya Sharma",
    jobRole: "Senior Backend Eng",
    jobReq: "REQ-8902",
    model: "gemma2:2b",
    tokens: "2,340",
    latency: "2.8s",
    status: "OK",
    promptTokens: 1820,
    responseTokens: 520,
    promptText: `System: You are an expert technical recruiter analyzing a candidate's resume against a job description. Ensure unbiased evaluation focusing solely on technical merit, system design capabilities, and relevant backend experience.

Job Context: Senior Backend Engineer (REQ-8902).
Required: Python, Go, Microservices, PostgreSQL, System Design for high-throughput systems (10k+ QPS).`,
    responseText: `{
  "score": 92,
  "confidence": 0.95,
  "verdict": "STRONG_HIRE",
  "key_findings": [
    "Demonstrates strong experience with required languages (Python, Go).",
    "Proven track record with microservices migration directly applicable to REQ-8902."
  ]
}`,
    rationale:
      "The model identified a strong alignment between the candidate's practical experience with Go-based microservices and Kafka event pipelines against the core requirements of the Senior Backend Engineer role. The slight deduction in score (92/100) stems from the absence of direct Kubernetes experience, which was flagged as a preferred skill. Overall recommendation leans heavily towards advancing to a technical screen focusing on system design.",
  },
  {
    id: "aud-002",
    timestamp: "Jan 20 14:28:15",
    candidateInitials: "MC",
    candidateName: "Marcus Chen",
    jobRole: "Senior Software Engineer",
    jobReq: "REQ-8901",
    model: "gemma2:2b",
    tokens: "1,890",
    latency: "1.5s",
    status: "OK",
    promptTokens: 1420,
    responseTokens: 470,
    promptText: `System: Evaluate candidate for Senior Software Engineer (REQ-8901). Focused on full stack scalability, React, TypeScript, and AWS cloud workflows.`,
    responseText: `{
  "score": 96,
  "confidence": 0.98,
  "verdict": "EXCEPTIONAL_HIRE",
  "key_findings": [
    "Demonstrated proficiency in full-stack architecture.",
    "Comprehensive cloud migration background."
  ]
}`,
    rationale:
      "Exceptional synergy with frontend state orchestration and scalable microservices. Unanimous recommendation for immediate interview scheduling.",
  },
  {
    id: "aud-003",
    timestamp: "Jan 20 14:25:33",
    candidateInitials: "ER",
    candidateName: "Elena Rostova",
    jobRole: "Lead Data Engineer",
    jobReq: "REQ-8905",
    model: "gemma2:2b",
    tokens: "3,120",
    latency: "3.2s",
    status: "OK",
    promptTokens: 2450,
    responseTokens: 670,
    promptText: `System: Evaluate candidate for Lead Data Engineer (REQ-8905). Key emphasis on Spark, Kafka stream processing, and distributed vector data infrastructure.`,
    responseText: `{
  "score": 91,
  "confidence": 0.94,
  "verdict": "STRONG_HIRE",
  "key_findings": [
    "Over 7 years architecting low-latency streaming infrastructure.",
    "Extensive experience with PySpark, Delta Lake, and Kafka."
  ]
}`,
    rationale:
      "Candidate shows deep proficiency in high-throughput streaming systems and lakehouse management.",
  },
];

export default function AuditLogPage() {
  const [expandedId, setExpandedId] = useState<string | null>("aud-001");
  const [selectedRange, setSelectedRange] = useState("Last 24 Hours");
  const [selectedModel, setSelectedModel] = useState("All Models");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredLogs = MOCK_AUDIT_LOGS.filter(
    (log) =>
      log.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.jobRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.jobReq.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>ATS</span>
            <span>›</span>
            <span className="text-zinc-900">CANDIDATES</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 text-zinc-900"
              />
            </div>

            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center cursor-pointer">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-[1300px] w-full mx-auto space-y-6">
          {/* Title and Subtitle */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
              Audit & Compliance
            </h1>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Immutable record of every AI scoring decision — prompts, tokens,
              rationale.
            </p>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Date Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3.5 text-xs font-semibold bg-zinc-50 border-zinc-200 rounded-xl gap-2 hover:bg-zinc-100"
                  >
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{selectedRange}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white rounded-xl">
                  {["Last 24 Hours", "Last 7 Days", "Last 30 Days"].map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => setSelectedRange(r)}
                      className="text-xs cursor-pointer"
                    >
                      {r}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Model Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3.5 text-xs font-semibold bg-zinc-50 border-zinc-200 rounded-xl gap-2 hover:bg-zinc-100"
                  >
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{selectedModel}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white rounded-xl">
                  {["All Models", "gemma2:2b", "claude-3-5-sonnet", "gpt-4o"].map(
                    (m) => (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => setSelectedModel(m)}
                        className="text-xs cursor-pointer"
                      >
                        {m}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search Bar */}
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Candidate or REQ..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 text-zinc-900"
                />
              </div>
            </div>

            {/* Export Log */}
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-xl shadow-xs cursor-pointer shrink-0 transition-colors"
            >
              Export Log
            </Button>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
            {/* Table Headers */}
            <div className="grid grid-cols-12 gap-3 px-6 py-3.5 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
              <div className="col-span-2">TIMESTAMP (UTC)</div>
              <div className="col-span-3">CANDIDATE</div>
              <div className="col-span-3">JOB CONTEXT</div>
              <div className="col-span-1">MODEL</div>
              <div className="col-span-1 text-right">TOKENS</div>
              <div className="col-span-1 text-right">LATENCY</div>
              <div className="col-span-1 text-right pr-2">STATUS</div>
            </div>

            {/* Audit Log Rows */}
            {filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;

              return (
                <div key={log.id} className="border-b border-zinc-100 last:border-0">
                  {/* Row Summary */}
                  <div
                    onClick={() => toggleRow(log.id)}
                    className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer text-xs"
                  >
                    <div className="col-span-2 font-mono text-zinc-500 text-[11px]">
                      {log.timestamp}
                    </div>

                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                        {log.candidateInitials}
                      </div>
                      <span className="font-bold text-zinc-950">
                        {log.candidateName}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <p className="font-semibold text-zinc-900 leading-tight">
                        {log.jobRole}
                      </p>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {log.jobReq}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span className="bg-zinc-100 text-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded-md border border-zinc-200">
                        {log.model}
                      </span>
                    </div>

                    <div className="col-span-1 text-right font-mono text-zinc-600">
                      {log.tokens}
                    </div>

                    <div className="col-span-1 text-right font-mono text-zinc-600">
                      {log.latency}
                    </div>

                    <div className="col-span-1 flex items-center justify-end gap-1.5 pr-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>{log.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Expanded Audit Log Details Panel */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-3 bg-[#fbfbfa] border-t border-zinc-100 space-y-4 animate-in fade-in-50 duration-150">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Prompt Sent Box */}
                        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                              <span>PROMPT SENT</span>
                            </div>
                            <span className="bg-zinc-100 text-zinc-600 text-[10px] font-mono px-2 py-0.5 rounded-md">
                              {log.promptTokens.toLocaleString()} tokens
                            </span>
                          </div>
                          <pre className="text-[11px] font-mono text-zinc-700 bg-zinc-50/80 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {log.promptText}
                          </pre>
                        </div>

                        {/* LLM Response Box */}
                        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                            <div className="flex items-center gap-1.5">
                              <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                              <span>LLM RESPONSE</span>
                            </div>
                            <span className="bg-zinc-100 text-zinc-600 text-[10px] font-mono px-2 py-0.5 rounded-md">
                              {log.responseTokens.toLocaleString()} tokens
                            </span>
                          </div>
                          <pre className="text-[11px] font-mono text-zinc-700 bg-zinc-50/80 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {log.responseText}
                          </pre>
                        </div>
                      </div>

                      {/* Scoring Rationale */}
                      <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" />
                          <span>SCORING RATIONALE</span>
                        </div>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {log.rationale}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-2">
            <span>Showing 1–20 of 1,284 records</span>

            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-black text-white hover:text-zinc-300 font-bold flex items-center justify-center transition-colors">
                1
              </button>
              <button className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50">
                2
              </button>
              <button className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50">
                3
              </button>
              <span className="px-1 text-zinc-400">...</span>
              <button className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50">
                65
              </button>
              <button className="w-8 h-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
