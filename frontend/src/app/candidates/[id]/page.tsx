"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Columns, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { CandidateHeader } from "@/components/candidate/candidate-header";
import { CandidateLeftPanel } from "@/components/candidate/candidate-left-panel";
import { AIScorecardTab } from "@/components/candidate/ai-scorecard-tab";
import { ResumeTab } from "@/components/candidate/resume-tab";
import { TimelineTab } from "@/components/candidate/timeline-tab";
import { AuditTrailTab } from "@/components/candidate/audit-trail-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchCandidate, updateCandidateStage } from "@/lib/api";
import { CandidateDetail, CitationLocation } from "@/types/ats";

export default function CandidateDetailPage() {
  const params = useParams();
  const candidateId = (params?.id as string) || "";
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ai-scorecard");
  const [activeCitation, setActiveCitation] = useState<CitationLocation | null>(null);
  const [splitView, setSplitView] = useState(false);

  useEffect(() => {
    async function load() {
      if (!candidateId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchCandidate(candidateId);
        setCandidate(data);
      } catch (err) {
        console.error("Failed to load candidate:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [candidateId]);

  const handleStageChange = async (newStage: string) => {
    if (!candidate) return;
    setCandidate((prev) => (prev ? { ...prev, stage: newStage, status: newStage } : null));
    await updateCandidateStage(candidateId, newStage);
  };

  const handleSelectCitation = (citation: CitationLocation) => {
    setActiveCitation(citation);
    if (!splitView) {
      setActiveTab("resume");
    }
  };

  const handleClearCitation = () => {
    setActiveCitation(null);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search platform..." />

        <main className={`flex-1 p-8 w-full mx-auto space-y-6 transition-all ${
          splitView ? "max-w-[1700px]" : "max-w-6xl"
        }`}>
          {loading ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 font-medium text-xs">
              Loading candidate profile...
            </div>
          ) : !candidate ? (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <Columns className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900">
                  Candidate Profile Not Found
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
                  Candidate record &apos;{candidateId}&apos; does not exist or has not been uploaded yet.
                </p>
              </div>
              <Link href="/candidates">
                <Button
                  size="sm"
                  className="bg-black hover:bg-zinc-800 text-white text-xs font-semibold rounded-full px-5 h-9 transition-colors"
                >
                  Return to Candidates Directory
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Header Bar with Status & Stage Advancement */}
              <CandidateHeader candidate={candidate} onStageChange={handleStageChange} />

          {/* Split-View Mode (Side-by-Side Scorecard & Interactive PDF Viewer) */}
          {splitView ? (
            <div className="space-y-4">
              {/* Split View Active Controls Bar */}
              <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold">
                    <Columns className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-950 flex items-center gap-2">
                      <span>Side-by-Side Evaluator & PDF Grounding View</span>
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-700" />
                        Live Click-to-Highlight Active
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Click any quote in the AI Scorecard on the left to instantly highlight its exact bounding box in the PDF on the right.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSplitView(false)}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-zinc-200"
                >
                  Exit Split View
                </button>
              </div>

              {/* Dual-Pane Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: AI Scorecard (6 cols) */}
                <div className="lg:col-span-6 space-y-6">
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        AI Scorecard & Citations
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400">
                        Candidate #{candidate.id}
                      </span>
                    </div>
                    <AIScorecardTab
                      candidate={candidate}
                      onSelectCitation={handleSelectCitation}
                    />
                  </div>
                </div>

                {/* Right Column: Interactive PDF Viewer (6 cols) */}
                <div className="lg:col-span-6 sticky top-6">
                  <ResumeTab
                    candidate={candidate}
                    activeCitation={activeCitation}
                    onClearCitation={handleClearCitation}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Standard 2-Column Content Layout */
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
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <TabsList>
                      <TabsTrigger value="ai-scorecard">AI Scorecard</TabsTrigger>
                      <TabsTrigger value="resume">Resume PDF</TabsTrigger>
                      <TabsTrigger value="timeline">Timeline</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                      <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
                    </TabsList>

                    <button
                      onClick={() => setSplitView(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400 shadow-2xs transition-all cursor-pointer"
                    >
                      <Columns className="w-3.5 h-3.5 text-zinc-700" />
                      <span>Side-by-Side View</span>
                    </button>
                  </div>

                  <TabsContent value="ai-scorecard">
                    <AIScorecardTab
                      candidate={candidate}
                      onSelectCitation={handleSelectCitation}
                    />
                  </TabsContent>

                  <TabsContent value="resume">
                    <ResumeTab
                      candidate={candidate}
                      activeCitation={activeCitation}
                      onClearCitation={handleClearCitation}
                    />
                  </TabsContent>

                  <TabsContent value="timeline">
                    <TimelineTab candidate={candidate} />
                  </TabsContent>

                  <TabsContent value="notes">
                    <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs">
                      <h3 className="font-bold text-sm text-zinc-950 mb-3">
                        Recruiter & Hiring Team Feedback
                      </h3>
                      <AIScorecardTab
                        candidate={candidate}
                        onSelectCitation={handleSelectCitation}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="audit-trail">
                    <AuditTrailTab candidate={candidate} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
          </>
          )}
        </main>
      </div>
    </div>
  );
}
