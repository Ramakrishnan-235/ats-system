"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CandidateHeader } from "@/components/candidate/candidate-header";
import { CandidateLeftPanel } from "@/components/candidate/candidate-left-panel";
import { AIScorecardTab } from "@/components/candidate/ai-scorecard-tab";
import { ResumeTab } from "@/components/candidate/resume-tab";
import { TimelineTab } from "@/components/candidate/timeline-tab";
import { AuditTrailTab } from "@/components/candidate/audit-trail-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  fetchCandidate,
  fetchCandidateScorecard,
  updateCandidateStage,
  getErrorMessage,
} from "@/lib/api";
import { CandidateDetail, CitationLocation } from "@/types/ats";
import {
  ArrowLeft,
  Columns,
  Sparkles,
  UserX,
  FileText,
  Clock,
  History,
  AlertCircle,
  Briefcase,
} from "lucide-react";

export default function CandidateAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = (params?.id as string) || "";

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      try {
        const data = await fetchCandidate(candidateId, true).catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 403) {
            return fetchCandidate(candidateId);
          }
          throw err;
        });
        setCandidate(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [candidateId]);

  const handleStageChange = async (newStage: string) => {
    if (!candidate) return;
    try {
      await updateCandidateStage(candidateId, newStage, candidate.applied_for_job_id);
      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              stage: newStage,
              status: newStage,
              applications: prev.applications?.map((a) =>
                a.job_id === prev.applied_for_job_id ? { ...a, stage: newStage } : a
              ),
            }
          : null
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
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
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] flex-1 pb-24">
        {/* Top Breadcrumb and Action Bar */}
        <div className="w-full bg-[#f0f3ff] border-b border-[#dee2ef] py-2.5 px-4 sm:px-8">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#45474c]">
              <Link
                href="/candidates"
                className="flex items-center gap-1 hover:text-[#6137e0] font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Candidates</span>
              </Link>
              <span>/</span>
              <span className="font-mono text-[#75777c]">
                {candidate ? candidate.name : candidateId || "Profile"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSplitView((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  splitView
                    ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                    : "bg-white text-[#171c25] border-[#dee2ef] hover:bg-[#eaeefb]"
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>{splitView ? "Single Pane" : "Side-by-Side Split"}</span>
              </button>
            </div>
          </div>
        </div>

        <div
          className={`p-4 sm:p-8 w-full mx-auto space-y-6 transition-all ${
            splitView ? "max-w-[1700px]" : "max-w-[1440px]"
          }`}
        >
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#dee2ef] p-16 text-center text-[#75777c] font-medium text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#6137e0] border-t-transparent animate-spin" />
              <span>Loading candidate profile...</span>
            </div>
          ) : !candidate ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#dee2ef] p-16 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-full bg-[#f0f3ff] text-[#75777c] flex items-center justify-center mx-auto">
                <UserX className="w-6 h-6 text-[#6137e0]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#171c25]">
                  Candidate Profile Not Found
                </h3>
                <p className="text-xs text-[#75777c] max-w-sm mx-auto mt-1 leading-relaxed">
                  Candidate record &apos;{candidateId}&apos; does not exist or has not been ingested yet.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/candidates">
                  <Button
                    size="sm"
                    className="bg-[#131c29] hover:bg-[#2c313a] text-white text-xs font-semibold rounded-lg px-5 h-9 transition-colors cursor-pointer"
                  >
                    Return to Candidates Roster
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Job Application Switcher if multiple applications */}
              {candidate.applications && candidate.applications.length > 1 && (
                <div className="bg-white rounded-xl border border-[#dee2ef] p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#6137e0]" />
                    <span className="font-bold text-[#171c25]">Target Application:</span>
                  </div>
                  <select
                    value={candidate.applied_for_job_id || ""}
                    className="border border-[#dee2ef] rounded-lg px-2.5 py-1 bg-[#f0f3ff] text-xs font-semibold text-[#171c25] focus:outline-none"
                    onChange={async (e) => {
                      const app = candidate.applications?.find((a) => a.job_id === e.target.value);
                      if (!app) return;
                      try {
                        const sc = await fetchCandidateScorecard(candidateId, app.job_id);
                        setCandidate((prev) =>
                          prev
                            ? {
                                ...prev,
                                applied_for_job_id: app.job_id,
                                applied_for_job: app.job_title,
                                stage: app.stage,
                                status: app.stage,
                                scorecard: sc,
                              }
                            : null
                        );
                        setActiveCitation(null);
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    {candidate.applications.map((a) => (
                      <option key={a.id} value={a.job_id}>
                        {a.job_title} — {a.stage}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Header Bar with Status & Stage Advancement */}
              <CandidateHeader
                candidate={candidate}
                onStageChange={handleStageChange}
              />

              {/* Split-View Mode */}
              {splitView ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#dee2ef] p-3 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#6137e0] text-white flex items-center justify-center font-bold">
                        <Columns className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#171c25] flex items-center gap-2">
                          <span>Side-by-Side Evaluator & PDF Grounding View</span>
                          <span className="bg-[#e7deff] text-[#6137e0] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#6137e0]" />
                            Live Citations
                          </span>
                        </h4>
                        <p className="text-[11px] text-[#75777c]">
                          Select supported quotes in the scorecard to ground them directly in the resume evidence.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSplitView(false)}
                      className="px-2.5 py-1 bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-[#dee2ef]"
                    >
                      Exit Split View
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-6 space-y-6">
                      <div className="bg-white rounded-xl border border-[#dee2ef] p-5 shadow-xs">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#dee2ef]/60">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#75777c]">
                            AI Rubric Scorecard & Citations
                          </span>
                          <span className="font-mono text-[11px] text-[#75777c]">
                            #{candidate.id}
                          </span>
                        </div>
                        <AIScorecardTab
                          candidate={candidate}
                          onSelectCitation={handleSelectCitation}
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-6 sticky top-20">
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
                  <div className="lg:col-span-4">
                    <CandidateLeftPanel candidate={candidate} />
                  </div>

                  <div className="lg:col-span-8">
                    <Tabs
                      defaultValue="ai-scorecard"
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                        <TabsList className="bg-white border border-[#dee2ef] rounded-xl p-1">
                          <TabsTrigger
                            value="ai-scorecard"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            AI Scorecard
                          </TabsTrigger>
                          <TabsTrigger
                            value="resume"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Resume PDF
                          </TabsTrigger>
                          <TabsTrigger
                            value="timeline"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Timeline
                          </TabsTrigger>
                          <TabsTrigger
                            value="audit-trail"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Audit Trail
                          </TabsTrigger>
                        </TabsList>

                        <button
                          type="button"
                          onClick={() => setSplitView(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-[#171c25] border border-[#dee2ef] hover:bg-[#eaeefb] shadow-xs transition-all cursor-pointer"
                        >
                          <Columns className="w-3.5 h-3.5 text-[#6137e0]" />
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

                      <TabsContent value="audit-trail">
                        <AuditTrailTab candidate={candidate} />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <CoreFooter />
    </div>
  );
}
