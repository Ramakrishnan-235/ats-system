"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { History, Shield, CheckCircle2, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AUDIT_LOGS = [
  {
    id: "AUD-994821",
    action: "Deep LLM Evaluation",
    candidate: "Priya Sharma (Candidate #7712)",
    job: "Senior Backend Engineer",
    model: "gemma2:2b",
    score: "95 / 100",
    latency: "1.84s",
    status: "SUCCESS",
    timestamp: "2026-08-20 10:15:22",
  },
  {
    id: "AUD-994820",
    action: "PII Redaction & Scrub",
    candidate: "Candidate #7712",
    job: "-",
    model: "Presidio NER v2.2",
    score: "Clean",
    latency: "0.12s",
    status: "SUCCESS",
    timestamp: "2026-08-20 10:14:10",
  },
  {
    id: "AUD-994819",
    action: "Hybrid Retrieval & RRF Fusion",
    candidate: "100 candidates",
    job: "Data Platform Architect",
    model: "bge-small-en-v1.5",
    score: "Top 100",
    latency: "0.45s",
    status: "SUCCESS",
    timestamp: "2026-08-19 16:42:01",
  },
  {
    id: "AUD-994818",
    action: "Stage 2 Cross-Encoder Re-Ranking",
    candidate: "Top 20 candidates",
    job: "Lead Product Designer",
    model: "bge-reranker-large",
    score: "Top 20",
    latency: "0.89s",
    status: "SUCCESS",
    timestamp: "2026-08-19 14:11:05",
  },
];

export default function AuditLogPage() {
  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search audit events..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                  Audit & Compliance Log
                </h1>
                <p className="text-xs text-zinc-500 font-medium">
                  Immutable EEOC compliance records, prompt tracking & bias mitigation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Immutable Ledger Active</span>
            </div>
          </div>

          {/* Audit Table Card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-6">Audit ID</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Candidate / Target</th>
                  <th className="p-4">Model Engine</th>
                  <th className="p-4">Latency</th>
                  <th className="p-4">Result</th>
                  <th className="p-4 pr-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                {AUDIT_LOGS.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="p-4 pl-6 font-mono text-zinc-950 font-semibold">
                      {log.id}
                    </td>
                    <td className="p-4 font-bold text-zinc-900">{log.action}</td>
                    <td className="p-4 text-zinc-600">{log.candidate}</td>
                    <td className="p-4 font-mono text-zinc-500">{log.model}</td>
                    <td className="p-4 font-mono text-zinc-600">{log.latency}</td>
                    <td className="p-4">
                      <span className="bg-zinc-100 text-zinc-800 font-semibold px-2 py-0.5 rounded-md border border-zinc-200">
                        {log.score}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right text-zinc-400 font-mono">
                      {log.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
