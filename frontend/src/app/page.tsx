"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { StatCard } from "@/components/dashboard/stat-card";
import { AcquisitionChart } from "@/components/dashboard/acquisition-chart";
import { MatchRateDonut } from "@/components/dashboard/match-rate-donut";
import { PipelineKanban } from "@/components/dashboard/pipeline-kanban";
import { fetchDashboardStats } from "@/lib/api";
import {
  StatMetric,
  WeeklyData,
  AIMatchRate,
  PipelineCandidateItem,
} from "@/types/ats";
import {
  MOCK_STATS,
  MOCK_WEEKLY_DATA,
  MOCK_AI_MATCH_RATE,
  MOCK_PIPELINE,
} from "@/lib/mock-data";
import { AddCandidateModal } from "@/components/candidate/add-candidate-modal";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatMetric[]>(MOCK_STATS);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>(MOCK_WEEKLY_DATA);
  const [matchRate, setMatchRate] = useState<AIMatchRate>(MOCK_AI_MATCH_RATE);
  const [processingResumes, setProcessingResumes] = useState(5);
  const [todayEvaluations, setTodayEvaluations] = useState(94);
  const [pipeline, setPipeline] =
    useState<Record<string, PipelineCandidateItem[]>>(MOCK_PIPELINE);
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
    loadData();
  }, []);

  const handleCandidateAdded = (candidate: PipelineCandidateItem) => {
    setPipeline((prev) => {
      const stage = candidate.stage || "Contacted";
      const currentList = prev[stage] || [];
      return {
        ...prev,
        [stage]: [candidate, ...currentList],
      };
    });
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Dashboard" showDateFilter={true} />

        <main className="flex-1 px-8 pb-12 max-w-[1400px] w-full space-y-6">
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
              <MatchRateDonut
                data={matchRate}
                processingCount={processingResumes}
                todayEvaluations={todayEvaluations}
              />
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
        onCandidateAdded={handleCandidateAdded}
      />
    </div>
  );
}
