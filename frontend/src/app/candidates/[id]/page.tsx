"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { CandidateHeader } from "@/components/candidate/candidate-header";
import { CandidateLeftPanel } from "@/components/candidate/candidate-left-panel";
import { AIScorecardTab } from "@/components/candidate/ai-scorecard-tab";
import { ResumeTab } from "@/components/candidate/resume-tab";
import { TimelineTab } from "@/components/candidate/timeline-tab";
import { AuditTrailTab } from "@/components/candidate/audit-trail-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchCandidate } from "@/lib/api";
import { CandidateDetail } from "@/types/ats";
import { MOCK_CANDIDATE_PRIYA } from "@/lib/mock-data";

export default function CandidateDetailPage() {
  const params = useParams();
  const candidateId = (params?.id as string) || "cand-001";
  const [candidate, setCandidate] =
    useState<CandidateDetail>(MOCK_CANDIDATE_PRIYA);
  const [activeTab, setActiveTab] = useState("ai-scorecard");

  useEffect(() => {
    async function load() {
      const data = await fetchCandidate(candidateId);
      if (data) setCandidate(data);
    }
    load();
  }, [candidateId]);

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search platform..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Header Bar with Status & Stage Advancement */}
          <CandidateHeader candidate={candidate} />

          {/* Main 2-Column Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Profile Column (4 cols) */}
            <div className="lg:col-span-4">
              <CandidateLeftPanel candidate={candidate} />
            </div>

            {/* Right Multi-Tab Column (8 cols) */}
            <div className="lg:col-span-8">
              <Tabs
                defaultValue="ai-scorecard"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList>
                  <TabsTrigger value="ai-scorecard">AI Scorecard</TabsTrigger>
                  <TabsTrigger value="resume">Resume</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
                </TabsList>

                <TabsContent value="ai-scorecard">
                  <AIScorecardTab candidate={candidate} />
                </TabsContent>

                <TabsContent value="resume">
                  <ResumeTab candidate={candidate} />
                </TabsContent>

                <TabsContent value="timeline">
                  <TimelineTab candidate={candidate} />
                </TabsContent>

                <TabsContent value="notes">
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs">
                    <h3 className="font-bold text-sm text-zinc-950 mb-3">
                      Recruiter & Hiring Team Feedback
                    </h3>
                    <AIScorecardTab candidate={candidate} />
                  </div>
                </TabsContent>

                <TabsContent value="audit-trail">
                  <AuditTrailTab candidate={candidate} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
