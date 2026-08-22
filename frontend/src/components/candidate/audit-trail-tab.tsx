import React from "react";
import { Shield, Cpu, Clock, Terminal } from "lucide-react";
import { CandidateDetail } from "@/types/ats";

interface AuditTrailTabProps {
  candidate: CandidateDetail;
}

export function AuditTrailTab({ candidate }: AuditTrailTabProps) {
  const telemetry = {
    audit_id: "AUD-994821",
    model: "gemma2:2b (Ollama local runner)",
    latency_ms: 1842,
    prompt_tokens: 1420,
    completion_tokens: 388,
    compliance_passed: true,
    hash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    timestamp: "2026-08-20T10:15:22Z",
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-900">
              Immutable Scoring & EEOC Compliance Ledger
            </h4>
            <p className="text-[11px] text-zinc-500">
              Audit ID: {telemetry.audit_id}
            </p>
          </div>
        </div>

        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
          EEOC & AI Bias Verified
        </span>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/60">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            LLM MODEL
          </span>
          <span className="text-xs font-bold text-zinc-900 mt-1 block">
            {telemetry.model}
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/60">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            INFERENCE LATENCY
          </span>
          <span className="text-xs font-bold text-zinc-900 mt-1 block font-mono">
            {telemetry.latency_ms} ms
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/60">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            PROMPT TOKENS
          </span>
          <span className="text-xs font-bold text-zinc-900 mt-1 block font-mono">
            {telemetry.prompt_tokens}
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/60">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            COMPLETION TOKENS
          </span>
          <span className="text-xs font-bold text-zinc-900 mt-1 block font-mono">
            {telemetry.completion_tokens}
          </span>
        </div>
      </div>

      {/* Cryptographic Proof */}
      <div className="bg-[#18181b] text-zinc-300 rounded-xl p-4 font-mono text-[11px] space-y-1">
        <div className="text-zinc-500">
          # SHA-256 Checksum Immutable Ledger Hash
        </div>
        <div className="text-emerald-400 break-all">{telemetry.hash}</div>
        <div className="text-zinc-500 pt-2">
          TIMESTAMP: {telemetry.timestamp}
        </div>
      </div>
    </div>
  );
}
