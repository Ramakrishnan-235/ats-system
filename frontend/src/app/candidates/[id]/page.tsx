"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CandidateHeader } from "@/components/candidate/candidate-header";
import { CandidateLeftPanel } from "@/components/candidate/candidate-left-panel";
import { AIScorecardTab } from "@/components/candidate/ai-scorecard-tab";
import { AIScreeningDecision } from "@/components/candidate/ai-screening-decision";
import { ResumeTab } from "@/components/candidate/resume-tab";
import { TimelineTab } from "@/components/candidate/timeline-tab";
import { AuditTrailTab } from "@/components/candidate/audit-trail-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ApiError,
  fetchCandidate,
  updateCandidateStage,
  getErrorMessage,
  editCandidate,
  addCandidateNote,
  recordCandidateInterview,
  recordCandidateOffer,
} from "@/lib/api";
import { CandidateDetail, CitationLocation, InterviewRecord, OfferRecord, TeamNote } from "@/types/ats";
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
  Edit3,
  Calendar,
  DollarSign,
  CheckCircle2,
  MessageSquare,
  Plus,
  Send,
  AlertTriangle,
  User,
  Award,
  Check,
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
  const applicationRequest = useRef(0);

  // Manual Profile Edit Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editExpYears, setEditExpYears] = useState(0);
  const [editEducation, setEditEducation] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Interview Recording Dialog State
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [interviewRound, setInterviewRound] = useState("Technical Architecture Screen");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewOutcome, setInterviewOutcome] = useState("SCHEDULED");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [isSavingInterview, setIsSavingInterview] = useState(false);

  // Offer Recording Dialog State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerStatus, setOfferStatus] = useState("DRAFTED");
  const [offerSalary, setOfferSalary] = useState("145000");
  const [offerCurrency, setOfferCurrency] = useState("USD");
  const [offerEquity, setOfferEquity] = useState("0.15% Options");
  const [offerSignOn, setOfferSignOn] = useState("15000");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [isSavingOffer, setIsSavingOffer] = useState(false);

  // Team Note Input State
  const [noteContent, setNoteContent] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Recruiter");
  const [isSavingNote, setIsSavingNote] = useState(false);

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

  const openManualEdit = () => {
    if (!candidate) return;
    setEditName(candidate.name || "");
    setEditHeadline(candidate.target_headline || "");
    setEditEmail(candidate.email === "N/A" || candidate.email === "[REDACTED]" ? "" : candidate.email || "");
    setEditPhone(candidate.phone === "N/A" || candidate.phone === "[REDACTED]" ? "" : candidate.phone || "");
    setEditLocation(candidate.location === "N/A" ? "" : candidate.location || "");
    setEditSkills((candidate.core_skills || []).join(", "));
    setEditExpYears(candidate.years_of_experience || 0);
    setEditEducation(candidate.highest_education || "");
    setIsEditOpen(true);
  };

  const handleSaveManualEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    setIsSavingEdit(true);
    try {
      const skillsArray = editSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await editCandidate(candidateId, {
        name: editName.trim() || undefined,
        headline: editHeadline.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        location: editLocation.trim() || undefined,
        skills: skillsArray.length ? skillsArray : undefined,
        experience_years: editExpYears,
        education: editEducation.trim() || undefined,
      });
      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              name: editName.trim() || prev.name,
              target_headline: editHeadline.trim() || prev.target_headline,
              email: editEmail.trim() || prev.email,
              phone: editPhone.trim() || prev.phone,
              location: editLocation.trim() || prev.location,
              core_skills: skillsArray.length ? skillsArray : prev.core_skills,
              years_of_experience: editExpYears,
              highest_education: editEducation.trim() || prev.highest_education,
              processing_status: "COMPLETED",
              error_message: undefined,
            }
          : null
      );
      setIsEditOpen(false);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openInterviewModal = () => {
    setInterviewRound("Technical Architecture Screen");
    setInterviewDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setInterviewerName("Lead Engineer");
    setInterviewOutcome("SCHEDULED");
    setInterviewFeedback("");
    setIsInterviewModalOpen(true);
  };

  const handleRecordInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !candidate.applied_for_job_id) {
      setError("Please select an active target job requisition to record an interview.");
      return;
    }
    setIsSavingInterview(true);
    try {
      const records = await recordCandidateInterview(candidate.applied_for_job_id, candidate.id, {
        round: interviewRound,
        scheduled_at: interviewDate || new Date().toISOString(),
        interviewer_name: interviewerName.trim() || "Recruitment Panel",
        outcome: interviewOutcome,
        feedback: interviewFeedback.trim() || undefined,
      });
      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              interviews: records,
              applications: prev.applications?.map((a) =>
                a.job_id === prev.applied_for_job_id ? { ...a, interviews: records } : a
              ),
            }
          : null
      );
      setIsInterviewModalOpen(false);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingInterview(false);
    }
  };

  const openOfferModal = () => {
    if (!candidate) return;
    const currentOffer = candidate.offer;
    if (currentOffer) {
      setOfferStatus(currentOffer.status || "DRAFTED");
      setOfferSalary(String(currentOffer.base_salary || 145000));
      setOfferCurrency(currentOffer.currency || "USD");
      setOfferEquity(currentOffer.equity || "0.15% Options");
      setOfferSignOn(String(currentOffer.sign_on_bonus || 0));
      setOfferStartDate(currentOffer.start_date || "");
      setOfferNotes(currentOffer.notes || "");
    } else {
      setOfferStatus("DRAFTED");
      setOfferSalary("145000");
      setOfferCurrency("USD");
      setOfferEquity("0.15% Options");
      setOfferSignOn("15000");
      setOfferStartDate("");
      setOfferNotes("");
    }
    setIsOfferModalOpen(true);
  };

  const handleRecordOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !candidate.applied_for_job_id) {
      setError("Please select an active target job requisition to record an offer.");
      return;
    }
    setIsSavingOffer(true);
    try {
      const rec = await recordCandidateOffer(candidate.applied_for_job_id, candidate.id, {
        status: offerStatus,
        salary: Number(offerSalary) || 145000,
        currency: offerCurrency,
        equity: offerEquity.trim() || undefined,
        sign_on_bonus: Number(offerSignOn) || 0,
        start_date: offerStartDate || undefined,
        notes: offerNotes.trim() || undefined,
      });
      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              offer: rec,
              applications: prev.applications?.map((a) =>
                a.job_id === prev.applied_for_job_id ? { ...a, offer: rec } : a
              ),
            }
          : null
      );
      setIsOfferModalOpen(false);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingOffer(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !noteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const newNote = await addCandidateNote(
        candidate.id,
        noteContent.trim(),
        noteAuthor.trim() || "Recruiter",
        candidate.applied_for_job_id
      );
      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              team_notes: [...(prev.team_notes || []), newNote],
              scorecard: {
                ...prev.scorecard,
                team_notes: [...(prev.scorecard?.team_notes || []), newNote],
              },
            }
          : null
      );
      setNoteContent("");
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSavingNote(false);
    }
  };

  const teamNotesList = candidate?.team_notes || candidate?.scorecard?.team_notes || [];

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

            <div className="flex items-center gap-2.5 flex-wrap">
              {candidate && (
                <button
                  type="button"
                  onClick={openManualEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border border-[#dee2ef] bg-white text-[#171c25] hover:bg-[#eaeefb] transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#6137e0]" />
                  <span>Edit Profile Details</span>
                </button>
              )}

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
              {/* AI Processing Failure Alert Banner */}
              {candidate.processing_status === "FAILED" && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-amber-950">AI Resume Extraction Incomplete</h4>
                      <p className="text-[11px] text-amber-800">
                        {candidate.error_message || "Document extraction or parsing encountered an issue."} Review the original resume and enter details manually to rescue this profile.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={openManualEdit}
                    className="bg-amber-900 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg px-4 h-8 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                    Manual Review &amp; Correct
                  </Button>
                </div>
              )}

              {/* Target Job Application Switcher */}
              {candidate.applications && candidate.applications.length > 0 && (
                <div className="bg-white rounded-xl border border-[#dee2ef] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#6137e0]" />
                    <span className="font-bold text-[#171c25]">Target Application:</span>
                    <span className="text-[#75777c]">
                      ({candidate.applications.length} distinct application{candidate.applications.length > 1 ? "s" : ""} on file)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={candidate.applied_for_job_id || ""}
                      className="border border-[#dee2ef] rounded-lg px-3 py-1.5 bg-[#f0f3ff] text-xs font-semibold text-[#171c25] focus:outline-none focus:ring-2 focus:ring-[#6137e0]/30"
                      onChange={async (e) => {
                        const app = candidate.applications?.find((a) => a.job_id === e.target.value);
                        if (!app) return;
                        const requestVersion = ++applicationRequest.current;
                        try {
                          const selected = await fetchCandidate(candidateId, !candidate.is_pii_masked, app.job_id);
                          if (requestVersion !== applicationRequest.current) return;
                          setCandidate((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  applied_for_job_id: app.job_id,
                                  applied_for_job: app.job_title,
                                  stage: app.stage,
                                  status: app.stage,
                                  scorecard: selected.scorecard,
                                  interviews: app.interviews || [],
                                  offer: app.offer,
                                }
                              : null
                          );
                          setActiveCitation(null);
                        } catch (err) {
                          if (requestVersion === applicationRequest.current) setError(getErrorMessage(err));
                        }
                      }}
                    >
                      {candidate.applications.map((a) => (
                        <option key={a.id} value={a.job_id}>
                          {a.job_title} — Stage: {a.stage} {a.match_score !== null ? `(${a.match_score}%)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Header Bar with Status & Stage Advancement */}
              <CandidateHeader
                candidate={candidate}
                onStageChange={handleStageChange}
              />

              <AIScreeningDecision
                key={`${candidate.id}:${candidate.applied_for_job_id || "unassigned"}`}
                candidate={candidate}
                onScorecardUpdated={(scorecard) => setCandidate((current) =>
                  current?.id === candidate.id && current.applied_for_job_id === candidate.applied_for_job_id
                    ? { ...current, scorecard } : current
                )}
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
                          <span>Side-by-Side Evaluator &amp; PDF Grounding View</span>
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
                            AI Rubric Scorecard &amp; Citations
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
                        <TabsList className="bg-white border border-[#dee2ef] rounded-xl p-1 flex-wrap h-auto gap-1">
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
                            value="interviews"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Interviews ({candidate.interviews?.length || 0})
                          </TabsTrigger>
                          <TabsTrigger
                            value="offer"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Offer {candidate.offer?.status ? `(${candidate.offer.status})` : ""}
                          </TabsTrigger>
                          <TabsTrigger
                            value="notes"
                            className="data-[state=active]:bg-[#6137e0] data-[state=active]:text-white rounded-lg text-xs font-semibold px-3 py-1.5"
                          >
                            Team Notes ({teamNotesList.length})
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

                      {/* Tab 1: AI Scorecard */}
                      <TabsContent value="ai-scorecard">
                        <AIScorecardTab
                          candidate={candidate}
                          onSelectCitation={handleSelectCitation}
                        />
                      </TabsContent>

                      {/* Tab 2: Resume PDF */}
                      <TabsContent value="resume">
                        <ResumeTab
                          candidate={candidate}
                          activeCitation={activeCitation}
                          onClearCitation={handleClearCitation}
                        />
                      </TabsContent>

                      {/* Tab 3: Interviews & Panel Records */}
                      <TabsContent value="interviews" className="space-y-4">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                            <div>
                              <h3 className="text-base font-bold text-zinc-950">
                                Recorded Interview Rounds &amp; Outcomes
                              </h3>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Track panel evaluation loops, feedback notes, and candidate outcomes for {candidate.applied_for_job || "this job"}.
                              </p>
                            </div>
                            <Button
                              onClick={openInterviewModal}
                              size="sm"
                              className="bg-[#131c29] hover:bg-[#202d3f] text-white rounded-xl text-xs font-semibold gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Record Interview Round</span>
                            </Button>
                          </div>

                          {(!candidate.interviews || candidate.interviews.length === 0) ? (
                            <div className="text-center py-10 space-y-3">
                              <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#6137e0] flex items-center justify-center mx-auto">
                                <Calendar className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-zinc-900">No interviews recorded yet</h4>
                                <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                                  Click &ldquo;Record Interview Round&rdquo; to save screening, architecture, or panel debrief records.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {candidate.interviews.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-2 hover:border-zinc-300 transition-colors"
                                >
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-zinc-950">
                                        {item.round}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                          item.outcome === "PASSED"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : item.outcome === "FAILED"
                                            ? "bg-rose-100 text-rose-800"
                                            : item.outcome === "COMPLETED"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-amber-100 text-amber-800"
                                        }`}
                                      >
                                        {item.outcome}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-mono">
                                      {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "Date not set"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                                    <User className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Interviewer: <strong>{item.interviewer_name || "Panel"}</strong></span>
                                  </div>

                                  {item.notes && (
                                    <div className="pt-2 text-xs text-zinc-700 bg-white p-3 rounded-lg border border-zinc-100">
                                      <p className="italic">&ldquo;{item.notes}&rdquo;</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* Tab 4: Offer Details & Outcome */}
                      <TabsContent value="offer" className="space-y-4">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                            <div>
                              <h3 className="text-base font-bold text-zinc-950">
                                Offer Package &amp; Outcome
                              </h3>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Manual records for compensation, equity, signing dates, and offer acceptance.
                              </p>
                            </div>
                            <Button
                              onClick={openOfferModal}
                              size="sm"
                              className="bg-[#131c29] hover:bg-[#202d3f] text-white rounded-xl text-xs font-semibold gap-1.5"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{candidate.offer ? "Update Offer Record" : "Record New Offer"}</span>
                            </Button>
                          </div>

                          {!candidate.offer || candidate.offer.status === "NOT_STARTED" ? (
                            <div className="text-center py-10 space-y-3">
                              <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#6137e0] flex items-center justify-center mx-auto">
                                <DollarSign className="w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-zinc-900">No offer recorded yet</h4>
                                <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                                  When candidate reaches final review, use &ldquo;Record New Offer&rdquo; to document base salary, equity, and acceptance status.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                                  Compensation &amp; Terms
                                </span>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between py-1 border-b border-zinc-200/60">
                                    <span className="text-zinc-600">Offer Status</span>
                                    <span className="font-bold text-zinc-950 uppercase">{candidate.offer.status}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-zinc-200/60">
                                    <span className="text-zinc-600">Base Salary</span>
                                    <span className="font-bold text-zinc-950">
                                      {candidate.offer.currency || "USD"} {candidate.offer.base_salary?.toLocaleString() || "145,000"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-zinc-200/60">
                                    <span className="text-zinc-600">Equity Grant</span>
                                    <span className="font-semibold text-zinc-900">{candidate.offer.equity || "None recorded"}</span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-zinc-600">Sign-on Bonus</span>
                                    <span className="font-semibold text-zinc-900">
                                      {candidate.offer.sign_on_bonus ? `${candidate.offer.currency || "USD"} ${candidate.offer.sign_on_bonus.toLocaleString()}` : "—"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                                  Timeline &amp; Notes
                                </span>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between py-1 border-b border-zinc-200/60">
                                    <span className="text-zinc-600">Target Start Date</span>
                                    <span className="font-semibold text-zinc-950">{candidate.offer.start_date || "To be confirmed"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-zinc-200/60">
                                    <span className="text-zinc-600">Last Recorded</span>
                                    <span className="font-mono text-zinc-500">{candidate.offer.updated_at ? new Date(candidate.offer.updated_at).toLocaleDateString() : "Active"}</span>
                                  </div>
                                  {candidate.offer.notes && (
                                    <div className="pt-2">
                                      <span className="text-zinc-500 block text-[11px] mb-1">Offer Notes:</span>
                                      <p className="italic text-zinc-700 bg-white p-2.5 rounded-lg border border-zinc-200">
                                        &ldquo;{candidate.offer.notes}&rdquo;
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* Tab 5: Persistent Recruiter Team Notes */}
                      <TabsContent value="notes" className="space-y-4">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
                          <div className="pb-4 border-b border-zinc-100">
                            <h3 className="text-base font-bold text-zinc-950">
                              Persistent Recruiter Team Notes
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Team observations and evaluations are stored permanently in the database and preserved across reloads.
                            </p>
                          </div>

                          {/* Notes List */}
                          <div className="space-y-3">
                            {teamNotesList.length === 0 ? (
                              <p className="text-xs text-zinc-500 italic py-4">
                                No notes recorded for this candidate yet. Add the first observation below.
                              </p>
                            ) : (
                              teamNotesList.map((note) => (
                                <div
                                  key={note.id}
                                  className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-[#6137e0] text-white flex items-center justify-center font-bold text-[10px]">
                                        {note.initials || "RN"}
                                      </div>
                                      <span className="font-bold text-zinc-900">{note.author}</span>
                                      <span className="text-[11px] text-zinc-400">({note.role})</span>
                                    </div>
                                    <span className="text-[11px] text-zinc-400 font-mono">
                                      {note.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-700 pl-8 leading-relaxed whitespace-pre-wrap">
                                    {note.content}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Add Note Form */}
                          <form onSubmit={handleAddNote} className="pt-4 border-t border-zinc-100 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-zinc-900">Add New Team Note</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Author:</span>
                                <Input
                                  value={noteAuthor}
                                  onChange={(e) => setNoteAuthor(e.target.value)}
                                  className="h-8 text-xs max-w-[160px] rounded-lg"
                                  placeholder="Recruiter Name"
                                />
                              </div>
                            </div>
                            <textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              placeholder="Write observations from screening, candidate preferences, team debrief..."
                              rows={3}
                              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
                              required
                            />
                            <div className="flex justify-end">
                              <Button
                                type="submit"
                                disabled={isSavingNote || !noteContent.trim()}
                                size="sm"
                                className="bg-[#6137e0] hover:bg-[#5028c6] text-white text-xs font-semibold px-4 rounded-xl gap-1.5 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isSavingNote ? "Saving..." : "Post Team Note"}</span>
                              </Button>
                            </div>
                          </form>
                        </div>
                      </TabsContent>

                      {/* Tab 6: Timeline */}
                      <TabsContent value="timeline">
                        <TimelineTab candidate={candidate} />
                      </TabsContent>

                      {/* Tab 7: Audit Trail */}
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

      {/* Manual Profile Correction Modal Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[#6137e0]" />
              <span>Manual Candidate Review &amp; Profile Edit</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveManualEdit} className="space-y-4 mt-2">
            <p className="text-xs text-zinc-500">
              Update candidate details directly. If AI processing failed, saving will rescue the candidate to &ldquo;Completed&rdquo; status.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Full Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Target Headline / Role</label>
              <Input
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                placeholder="Senior Distributed Systems Engineer"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Email Address</label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Phone</label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+1 (555) 019-2831"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Location</label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="San Francisco, CA (Hybrid)"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Years of Experience</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editExpYears}
                  onChange={(e) => setEditExpYears(Number(e.target.value))}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Core Skills (comma-separated)</label>
              <Input
                value={editSkills}
                onChange={(e) => setEditSkills(e.target.value)}
                placeholder="Rust, PostgreSQL, Distributed Systems, Docker"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Highest Education</label>
              <Input
                value={editEducation}
                onChange={(e) => setEditEducation(e.target.value)}
                placeholder="B.S. in Computer Science"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-4 flex justify-end gap-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="bg-black hover:bg-zinc-800 text-white text-xs px-5 rounded-xl transition-colors cursor-pointer"
              >
                {isSavingEdit ? "Saving..." : "Save & Rescue Profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Interview Round Dialog */}
      <Dialog open={isInterviewModalOpen} onOpenChange={setIsInterviewModalOpen}>
        <DialogContent className="max-w-lg p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#6137e0]" />
              <span>Record Interview Round</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordInterview} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Interview Round / Stage Name</label>
              <select
                value={interviewRound}
                onChange={(e) => setInterviewRound(e.target.value)}
                className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
              >
                <option value="Initial Screening">Initial Screening</option>
                <option value="Technical Architecture Screen">Technical Architecture Screen</option>
                <option value="System Design Deep-Dive">System Design Deep-Dive</option>
                <option value="Values & Leadership Interview">Values &amp; Leadership Interview</option>
                <option value="Final Executive Debrief">Final Executive Debrief</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Scheduled Date &amp; Time</label>
                <Input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Interviewer Name</label>
                <Input
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Interview Outcome</label>
              <select
                value={interviewOutcome}
                onChange={(e) => setInterviewOutcome(e.target.value)}
                className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
              >
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="PASSED">PASSED (Advance)</option>
                <option value="FAILED">FAILED (Reject)</option>
                <option value="COMPLETED">COMPLETED (Pending Review)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Feedback &amp; Panel Notes</label>
              <textarea
                value={interviewFeedback}
                onChange={(e) => setInterviewFeedback(e.target.value)}
                placeholder="Candidate demonstrated deep concurrency mastery, solved caching bottleneck..."
                rows={3}
                className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
              />
            </div>

            <DialogFooter className="pt-4 flex justify-end gap-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInterviewModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingInterview}
                className="bg-black hover:bg-zinc-800 text-white text-xs px-5 rounded-xl transition-colors cursor-pointer"
              >
                {isSavingInterview ? "Saving..." : "Record Interview"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Offer Dialog */}
      <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
        <DialogContent className="max-w-lg p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#6137e0]" />
              <span>Record / Update Offer Record</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordOffer} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Offer Status</label>
              <select
                value={offerStatus}
                onChange={(e) => setOfferStatus(e.target.value)}
                className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
              >
                <option value="DRAFTED">DRAFTED — Internal compensation review</option>
                <option value="EXTENDED">EXTENDED — Extended to candidate</option>
                <option value="ACCEPTED">ACCEPTED — Signed / Confirmed</option>
                <option value="DECLINED">DECLINED — Candidate declined</option>
                <option value="REVISED">REVISED — Counter-offer or revised package</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Base Salary</label>
                <Input
                  type="number"
                  value={offerSalary}
                  onChange={(e) => setOfferSalary(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Currency</label>
                <Input
                  value={offerCurrency}
                  onChange={(e) => setOfferCurrency(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Equity Grant</label>
                <Input
                  value={offerEquity}
                  onChange={(e) => setOfferEquity(e.target.value)}
                  placeholder="0.15% Options"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">Sign-on Bonus</label>
                <Input
                  type="number"
                  value={offerSignOn}
                  onChange={(e) => setOfferSignOn(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Target Start Date</label>
              <Input
                type="date"
                value={offerStartDate}
                onChange={(e) => setOfferStartDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Offer Notes &amp; Terms</label>
              <textarea
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
                placeholder="Approved by hiring executive, includes 4-year vesting schedule..."
                rows={3}
                className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
              />
            </div>

            <DialogFooter className="pt-4 flex justify-end gap-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOfferModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingOffer}
                className="bg-black hover:bg-zinc-800 text-white text-xs px-5 rounded-xl transition-colors cursor-pointer"
              >
                {isSavingOffer ? "Saving..." : "Save Offer Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
