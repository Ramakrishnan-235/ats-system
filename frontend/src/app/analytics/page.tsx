"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { BarChart3, TrendingUp, Cpu, Users, Zap, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={true} searchPlaceholder="Search metrics..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                Analytics & Pipeline Insights
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Real-time funnel conversion, inference latency & throughput
              </p>
            </div>
          </div>

          {/* Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>LLM INFERENCE P95</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-zinc-950 mt-3 font-mono">
                1.84s
              </div>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                ✓ 38% faster than benchmark target (&lt;3.0s)
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <span>PII SCRUB SUCCESS</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-bold text-zinc-950 mt-3">
                99.94%
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Presidio engine zero-leakage guarantee
              </p>
            </div>

            <div className="bg-black text-white rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <span>CROSS-ENCODER PRECISION</span>
                <Cpu className="w-4 h-4 text-zinc-300" />
              </div>
              <div className="text-3xl font-bold text-white mt-3">
                94.8%
              </div>
              <p className="text-xs text-zinc-300 font-medium mt-1">
                Stage 2 BAAI/bge-reranker-large
              </p>
            </div>
          </div>

          {/* Funnel Conversion Card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-950">
              3-Stage Retrieval & Evaluation Funnel
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Stage 1: Dense + BM25 Hybrid Retrieval (Top 100)</span>
                  <span className="font-mono">1,247 Ingested → 100 Matched</span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 w-full rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Stage 2: Cross-Encoder Full Cross-Attention Re-Ranking</span>
                  <span className="font-mono">100 → Top 20 Candidates</span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-700 w-3/5 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Stage 3: Deep LLM Rubric Evaluation & Citations</span>
                  <span className="font-mono">Top 20 → 5 Exceptional Fits</span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-500 w-1/4 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
