"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StatCard } from "@/components/dashboard/stat-card";
import { AcquisitionChart } from "@/components/dashboard/acquisition-chart";
import { MatchRateDonut } from "@/components/dashboard/match-rate-donut";
import { PipelineKanban } from "@/components/dashboard/pipeline-kanban";
import { fetchDashboardStats, getErrorMessage } from "@/lib/api";
import {
  StatMetric,
  WeeklyData,
  AIMatchRate,
  PipelineCandidateItem,
} from "@/types/ats";
import { AddCandidateModal } from "@/components/candidate/add-candidate-modal";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatMetric[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [matchRate, setMatchRate] = useState<AIMatchRate | null>(null);
  const [processingResumes, setProcessingResumes] = useState(0);
  const [todayEvaluations, setTodayEvaluations] = useState(0);
  const [pipeline, setPipeline] =
    useState<Record<string, PipelineCandidateItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const data = await fetchDashboardStats();
      if (data) {
        if (data.stats) setStats(data.stats);
        if (data.weekly_candidates) setWeeklyData(data.weekly_candidates);
        if (data.ai_match_rate) setMatchRate(data.ai_match_rate);
        if (data.processing_resumes !== undefined)
          setProcessingResumes(data.processing_resumes);
        if (data.today_evaluations !== undefined)
          setTodayEvaluations(data.today_evaluations);
        if (data.pipeline) setPipeline(data.pipeline);
      }
    }
    loadData().catch(reason => setError(getErrorMessage(reason)));
  }, []);

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Dashboard" showDateFilter={true} />

        <main className="flex-1 px-8 pb-12 max-w-[1400px] w-full space-y-6">
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {/* Top 4 Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((metric) => (
              <StatCard key={metric.id} metric={metric} />
            ))}
          </div>

          {/* Middle Analytics Section (8-week acquisition + AI match rate) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <AcquisitionChart data={weeklyData} />
            </div>
            <div className="lg:col-span-5">
              {matchRate && <MatchRateDonut
                data={matchRate}
                processingCount={processingResumes}
                todayEvaluations={todayEvaluations}
              />}
            </div>
          </div>

          {/* Pipeline Overview Kanban Section */}
          <PipelineKanban
            pipeline={pipeline}
            onAddCandidate={() => setIsAddCandidateOpen(true)}
          />
        </main>
      </div>

      {/* Add Candidate Modal */}
      <AddCandidateModal
        open={isAddCandidateOpen}
        onOpenChange={setIsAddCandidateOpen}
      />
    </div>
  );
}
