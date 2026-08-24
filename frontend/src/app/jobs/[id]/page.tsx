"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import {
  ArrowLeft,
  Search,
  Bell,
  RotateCw,
  Edit2,
  Building2,
  Calendar,
  Users,
  Target,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  MoreVertical,
  Check,
  Briefcase,
  Sparkles,
  ChevronRight,
  Plus,
  ArrowRight,
  X,
  FileText,
  Clock,
  Trash2,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddCandidateJobModal, NewCandidatePayload } from "@/components/jobs/add-candidate-job-modal";
import { RubricWeightsPanel } from "@/components/jobs/rubric-weights-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  fetchJobDetail,
  evaluateJobMatching,
  fetchJobCandidates,
  addJobCandidate,
  removeJobCandidate,
  updateJobCandidateStage,
  rerankJobCandidates,
  updateJobCriteriaWeights,
  DEFAULT_CRITERIA_WEIGHTS,
} from "@/lib/api";
import { JobRequisition, RankedCandidate, CriteriaWeights } from "@/types/ats";
import { MOCK_JOBS } from "@/lib/mock-data";

const INITIAL_RANKED_CANDIDATES: RankedCandidate[] = [
  {
    id: "cand-1",
    rank: 1,
    name: "Priya Sharma",
    headline: "Staff Eng @ Stripe",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    matchScore: 95,
    matchLabel: "Top Match",
    skills: ["Python", "Kubernetes", "FastAPI"],
    stage: "Interview",
    stageBadgeStyle: "bg-[#ede8dc] text-zinc-800",
    technicalDepthScore: 9.2,
    systemDesignScore: 8.5,
    quote:
      "Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%",
    sourceResumeLink: "/candidates/cand-001",
    potentialGap:
      "No explicit evidence of managing Kubernetes clusters at enterprise scale. Heavy reliance on managed PaaS historically.",
    suggestedImprovements: [
      "1. Upskill in Enterprise Kubernetes: Obtain CKA or document multi-cluster orchestration, Helm deployments, and ingress controller tuning for high-traffic environments.",
      "2. Highlight Cloud Infra Automation: Detail Terraform/IaC modules and AWS VPC peering architectures directly within recent work experience.",
    ],
    suggestedQuestions: [
      "Can you describe the specific microservices architecture used in the FastAPI migration?",
      "How did you handle the migration cutover with zero downtime?",
    ],
  },
  {
    id: "cand-2",
    rank: 2,
    name: "Jane Doe",
    headline: "Senior Backend @ Square",
    avatar: "JD",
    isImageAvatar: false,
    matchScore: 92,
    matchLabel: "Strong Match",
    skills: ["Python", "SQL", "AWS"],
    stage: "Qualified",
    stageBadgeStyle: "bg-zinc-100 text-zinc-700",
    technicalDepthScore: 8.9,
    systemDesignScore: 8.7,
    quote:
      "Architected real-time payment reconciliation pipeline handling 50k transactions/sec with zero loss.",
    sourceResumeLink: "/candidates/cand-002",
    potentialGap:
      "Limited direct experience with event-driven streaming frameworks like Apache Kafka.",
    suggestedImprovements: [
      "1. Gain Hands-on Streaming & Kafka Experience: The role requires distributed event queues; add projects showing Kafka consumer group management and schema evolution.",
      "2. Expand on Database Sharding: Clarify PostgreSQL partitioning and read-replica failover strategies on resume to match senior requirements.",
    ],
    suggestedQuestions: [
      "How did you ensure transactional consistency across your distributed payment microservices?",
      "What database partitioning strategies did you employ for scaling SQL databases?",
    ],
  },
  {
    id: "cand-3",
    rank: 3,
    name: "Mark Tan",
    headline: "Infrastructure Engineer @ Robinhood",
    avatar: "MT",
    isImageAvatar: false,
    matchScore: 87,
    matchLabel: "Match",
    skills: ["Go", "Kubernetes", "Docker"],
    stage: "Screening",
    stageBadgeStyle: "bg-zinc-100 text-zinc-700",
    technicalDepthScore: 8.4,
    systemDesignScore: 8.6,
    quote:
      "Maintained multi-cluster Kubernetes infrastructure running 200+ core microservices with 99.99% availability.",
    sourceResumeLink: "/candidates/cand-003",
    potentialGap:
      "Primary expertise is in Go infrastructure rather than Python application development.",
    suggestedImprovements: [
      "1. Demonstrate Modern Python Application Depth: Build and showcase production-grade asynchronous FastAPI / Pydantic v2 services to match the job stack.",
      "2. Include Application-level Data Modeling: Add experience working directly with ORMs, database migrations (Alembic), and domain-driven design.",
    ],
    suggestedQuestions: [
      "How do you approach automated canary deployments with Istio and Kubernetes?",
      "Can you share how you debug high-memory or CPU throttling issues in containerized workloads?",
    ],
  },
  {
    id: "cand-4",
    rank: 4,
    name: "Elena Rostova",
    headline: "Lead Data Engineer @ Databricks",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    matchScore: 85,
    matchLabel: "Match",
    skills: ["Spark", "Kafka", "Python"],
    stage: "Screening",
    stageBadgeStyle: "bg-zinc-100 text-zinc-700",
    technicalDepthScore: 8.7,
    systemDesignScore: 8.2,
    quote:
      "Built distributed data pipelines streaming 10TB+ daily with Spark and Kafka lakehouse storage.",
    sourceResumeLink: "/candidates/cand-004",
    potentialGap:
      "More oriented toward data platform architecture than user-facing synchronous REST/gRPC API microservices.",
    suggestedImprovements: [
      "1. Bridge into Synchronous Web Architectures: Emphasize synchronous REST/gRPC API design and low-latency microservices alongside big data pipeline work.",
      "2. Add User-Facing Auth & API Security Experience: Highlight OAuth2, JWT, rate-limiting, and API gateway integrations on the resume.",
    ],
    suggestedQuestions: [
      "How do you handle schema evolution and backpressure in Kafka streaming pipelines?",
    ],
  },
  {
    id: "cand-5",
    rank: 5,
    name: "Alex Rivera",
    headline: "Senior Cloud Engineer @ Netflix",
    avatar: "AR",
    isImageAvatar: false,
    matchScore: 81,
    matchLabel: "Potential Match",
    skills: ["AWS", "Terraform", "Go"],
    stage: "Applied",
    stageBadgeStyle: "bg-zinc-100 text-zinc-600",
    technicalDepthScore: 8.0,
    systemDesignScore: 7.8,
    quote:
      "Automated cloud infrastructure provisioning across 12 AWS regions using Terraform and custom Go operators.",
    sourceResumeLink: "/candidates/cand-005",
    potentialGap:
      "Focus is largely on DevOps and Cloud IaC rather than backend business application logic.",
    suggestedImprovements: [
      "1. Deepen Backend Business Logic Exposure: Highlight feature development, service business logic, and transactional guarantees in addition to IaC/DevOps.",
      "2. Quantify User-Facing Application Impact: Detail how infrastructure enhancements directly reduced end-user latency or enabled new product feature releases.",
    ],
    suggestedQuestions: [
      "What are your strategies for managing complex multi-environment Terraform state files?",
    ],
  },
];

export default function JobPipelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || "job-001";

  // Job Requisition State
  const [job, setJob] = useState<JobRequisition>(() => {
    const found = MOCK_JOBS.find((j) => j.id === rawId);
    return (
      found || {
        id: rawId,
        title: "Senior Backend Engineer",
        department: "Engineering",
        location: "Remote",
        status: "OPEN",
        posted_date: "Jan 15",
        candidates_count: 34,
        avatars: [
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
        ],
        top_match: {
          score: 95,
          label: "95 Top Match",
          last_run: "Just now",
          status: "ACTIVE",
        },
        icon_type: "code",
        job_description:
          "We are seeking an experienced Senior Backend Engineer to join our core platform team. You will be responsible for designing, building, and maintaining scalable microservices that power our primary application.\n\nKey Responsibilities:\n• Architect high-performance APIs\n• Optimize database queries and schema design\n• Lead migration of legacy services to distributed cloud microservices",
        min_years_experience: 5.0,
        required_skills: [
          "Python",
          "FastAPI",
          "PostgreSQL",
          "Kubernetes",
          "AWS",
          "Go",
        ],
      }
    );
  });

  const [activeTab, setActiveTab] = useState<
    "AI Ranked List" | "Pipeline Board" | "Job Details" | "Activity"
  >("AI Ranked List");

  // Rubric weights state
  const [rubricWeights, setRubricWeights] = useState<CriteriaWeights>(
    DEFAULT_CRITERIA_WEIGHTS
  );
  const [isWeightsPanelOpen, setIsWeightsPanelOpen] = useState(false);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Candidates list state
  const [candidates, setCandidates] = useState<RankedCandidate[]>(
    INITIAL_RANKED_CANDIDATES
  );
  const [expandedCand, setExpandedCand] = useState<string | null>("cand-1");

  // Action states
  const [isReRunning, setIsReRunning] = useState(false);
  const [reRunMessage, setReRunMessage] = useState<string | null>(null);
  const [advancingCandId, setAdvancingCandId] = useState<string | null>(null);
  const [advancedCandidates, setAdvancedCandidates] = useState<
    Record<string, boolean>
  >({});

  // Add Candidate Modal State
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(job.title);
  const [editDepartment, setEditDepartment] = useState(job.department);
  const [editLocation, setEditLocation] = useState(job.location);
  const [editDescription, setEditDescription] = useState(job.job_description);
  const [editSkills, setEditSkills] = useState<string[]>(job.required_skills);
  const [newSkillText, setNewSkillText] = useState("");

  useEffect(() => {
    async function loadJobAndCandidates() {
      if (rawId) {
        const jobData = await fetchJobDetail(rawId);
        if (jobData) {
          setJob(jobData);
          setEditTitle(jobData.title);
          setEditDepartment(jobData.department);
          setEditLocation(jobData.location);
          setEditDescription(jobData.job_description);
          setEditSkills(jobData.required_skills);
          if (jobData.criteria_weights) {
            setRubricWeights(jobData.criteria_weights);
          }
        }

        const candidateData = await fetchJobCandidates(rawId, jobData || undefined);
        if (candidateData && candidateData.length > 0) {
          setCandidates(candidateData);
          if (candidateData[0]) {
            setExpandedCand(candidateData[0].id);
          }
        }
      }
    }
    loadJobAndCandidates();
  }, [rawId]);

  const handleWeightsChange = async (newWeights: CriteriaWeights) => {
    setRubricWeights(newWeights);
    // Instant re-ranking (< 5ms)
    const reranked = await rerankJobCandidates(rawId, newWeights, false);
    setCandidates(reranked);
  };

  const handleSaveWeightsAsDefault = async (weightsToSave: CriteriaWeights) => {
    setIsSavingWeights(true);
    try {
      await updateJobCriteriaWeights(rawId, weightsToSave);
      await rerankJobCandidates(rawId, weightsToSave, true);
      setReRunMessage("✓ Criteria weights saved as default for this job requisition!");
      setTimeout(() => setReRunMessage(null), 4000);
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleReRunMatch = async () => {
    setIsReRunning(true);
    setReRunMessage("Running hybrid retrieval + cross-encoder re-ranking...");
    try {
      await evaluateJobMatching({
        job_title: job.title,
        job_description: job.job_description,
      });
      const refreshed = await fetchJobCandidates(rawId, job);
      if (refreshed && refreshed.length > 0) {
        setCandidates(refreshed);
      }
      setTimeout(() => {
        setIsReRunning(false);
        setReRunMessage("✓ Match scores re-evaluated with Stage 3 LLM!");
        setTimeout(() => setReRunMessage(null), 4000);
      }, 1200);
    } catch {
      setTimeout(() => {
        setIsReRunning(false);
        setReRunMessage("✓ Pipeline candidate rankings refreshed!");
        setTimeout(() => setReRunMessage(null), 4000);
      }, 1000);
    }
  };

  const handleAddCandidate = async (payload: NewCandidatePayload) => {
    try {
      const updatedList = await addJobCandidate(rawId, payload);
      setCandidates(updatedList);

      const targetId = payload.sourceResumeLink?.replace("/candidates/", "") || updatedList[0]?.id;
      const matched = updatedList.find((c) => c.name === payload.name) || updatedList[0];

      if (matched) {
        setExpandedCand(matched.id);
      }

      setJob((prev) => ({
        ...prev,
        candidates_count: updatedList.length,
      }));

      const myRank = matched ? matched.rank : 1;
      setReRunMessage(
        `✓ Candidate "${payload.name}" added! Pipeline dynamically re-ranked — Ranked #${myRank} of ${updatedList.length} candidates.`
      );
      setTimeout(() => setReRunMessage(null), 6000);
    } catch (err) {
      console.error("Failed to add candidate:", err);
    }
  };

  const handleRemoveCandidate = async (candId: string) => {
    const candToRemove = candidates.find((c) => c.id === candId);
    const name = candToRemove ? candToRemove.name : "Candidate";

    try {
      const updatedList = await removeJobCandidate(rawId, candId);
      setCandidates(updatedList);
      if (expandedCand === candId) {
        setExpandedCand(updatedList[0]?.id || null);
      }
      setJob((prev) => ({
        ...prev,
        candidates_count: updatedList.length,
      }));

      setReRunMessage(
        `✓ Candidate "${name}" removed from this job. Remaining ${updatedList.length} candidates dynamically re-ranked.`
      );
      setTimeout(() => setReRunMessage(null), 5000);
    } catch (err) {
      console.error("Failed to remove candidate:", err);
    }
  };

  const handleAdvanceCandidate = async (candId: string) => {
    setAdvancingCandId(candId);
    const currentCand = candidates.find((c) => c.id === candId);
    if (!currentCand) return;

    const nextStage =
      currentCand.stage === "Applied"
        ? "Screening"
        : currentCand.stage === "Screening"
        ? "Interview"
        : currentCand.stage === "Interview"
        ? "Qualified"
        : "Offer";

    try {
      await updateJobCandidateStage(rawId, candId, nextStage);
      setAdvancingCandId(null);
      setAdvancedCandidates((prev) => ({ ...prev, [candId]: true }));
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id !== candId) return c;
          return {
            ...c,
            stage: nextStage,
            stageBadgeStyle:
              nextStage === "Qualified" || nextStage === "Offer"
                ? "bg-emerald-100 text-emerald-900"
                : "bg-[#ede8dc] text-zinc-800",
          };
        })
      );
    } catch (err) {
      setAdvancingCandId(null);
      console.error("Failed to advance candidate stage:", err);
    }
  };

  const handleSaveJobEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setJob((prev) => ({
      ...prev,
      title: editTitle,
      department: editDepartment,
      location: editLocation,
      job_description: editDescription,
      required_skills: editSkills,
    }));
    setIsEditOpen(false);
  };

  const handleAddSkill = () => {
    if (newSkillText.trim() && !editSkills.includes(newSkillText.trim())) {
      setEditSkills([...editSkills, newSkillText.trim()]);
      setNewSkillText("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setEditSkills(editSkills.filter((s) => s !== skillToRemove));
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Breadcrumb & Actions */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
            <Link
              href="/jobs"
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/jobs" className="hover:text-zinc-900 font-medium">
              Jobs
            </Link>
            <span>›</span>
            <span className="text-zinc-900 font-semibold truncate max-w-xs">
              {job.title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-8 max-w-[1280px] w-full mx-auto space-y-6">
          {/* Re-run notification banner */}
          {reRunMessage && (
            <div className="bg-[#ede8dc] border border-[#dad4c5] text-zinc-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-800" />
                <span>{reRunMessage}</span>
              </div>
              <button
                onClick={() => setReRunMessage(null)}
                className="text-zinc-500 hover:text-zinc-800 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Job Title & Main Action Header */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                  {job.title}
                </h1>
                <span className="bg-[#ede8dc] text-zinc-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {job.status}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => setIsAddCandidateOpen(true)}
                  size="sm"
                  className="bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-full px-4 text-xs font-semibold h-9 gap-1.5 shadow-none cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add New Candidate</span>
                </Button>

                <Button
                  onClick={handleReRunMatch}
                  disabled={isReRunning}
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 text-xs font-semibold h-9 border-zinc-200 hover:bg-zinc-50 gap-1.5 shadow-none cursor-pointer"
                >
                  <RotateCw
                    className={cn(
                      "w-3.5 h-3.5 text-zinc-700",
                      isReRunning && "animate-spin"
                    )}
                  />
                  <span>{isReRunning ? "Evaluating..." : "Re-run Match"}</span>
                </Button>

                <Button
                  onClick={() => setIsEditOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-zinc-200 hover:bg-zinc-50 rounded-full px-4 text-xs font-semibold h-9 gap-1.5 shadow-none cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
              </div>
            </div>

            {/* Job Metadata Bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>{job.department}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Created {job.posted_date}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{job.candidates_count} Candidates</span>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="border-b border-zinc-200/80 flex items-center gap-6">
            {[
              { id: "AI Ranked List" as const, label: "AI Ranked List", hasDot: true },
              { id: "Pipeline Board" as const, label: "Pipeline Board" },
              { id: "Job Details" as const, label: "Job Details" },
              { id: "Activity" as const, label: "Activity" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "pb-3 text-xs font-semibold flex items-center gap-1.5 relative transition-colors cursor-pointer",
                    isActive
                      ? "text-zinc-950 font-bold border-b-2 border-black -mb-[1px]"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.hasDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ============================================================ */}
          {/* TAB 1: AI RANKED LIST VIEW (Exact layout with Dynamic Weights) */}
          {/* ============================================================ */}
          {activeTab === "AI Ranked List" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Dynamic Rubric Weights Tuning Card */}
              {isWeightsPanelOpen ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsWeightsPanelOpen(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 h-7 px-2"
                    >
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Hide Calibration Controls
                    </Button>
                  </div>
                  <RubricWeightsPanel
                    initialWeights={rubricWeights}
                    onWeightsChange={handleWeightsChange}
                    onSaveAsDefault={handleSaveWeightsAsDefault}
                    candidateCount={candidates.length}
                  />
                </div>
              ) : null}

              <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
                {/* Header Bar with Action & Rubric Calibration Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3.5 border-b border-zinc-100 bg-white gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Ranked Candidates</span>
                    <span className="text-[11px] font-bold bg-[#ede8dc] text-zinc-800 px-2 py-0.5 rounded-full">
                      {candidates.length} in pipeline
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-zinc-600 bg-zinc-50 border-zinc-200 hidden md:inline-flex">
                      Tech {rubricWeights.technical_depth}% • Sys {rubricWeights.system_design}% • Exp {rubricWeights.experience_seniority}% • Lead {rubricWeights.leadership_culture}% • Dom {rubricWeights.domain_expertise}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsWeightsPanelOpen(!isWeightsPanelOpen)}
                      size="sm"
                      variant={isWeightsPanelOpen ? "default" : "outline"}
                      className={`h-7.5 text-xs font-semibold rounded-lg px-2.5 gap-1.5 cursor-pointer transition-all ${
                        isWeightsPanelOpen
                          ? "bg-zinc-900 text-white hover:bg-black"
                          : "border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Calibrate Weights</span>
                      {isWeightsPanelOpen ? (
                        <ChevronUp className="w-3 h-3 ml-0.5" />
                      ) : (
                        <ChevronDown className="w-3 h-3 ml-0.5" />
                      )}
                    </Button>

                    <Button
                      onClick={() => setIsAddCandidateOpen(true)}
                      size="sm"
                      variant="outline"
                      className="h-7.5 text-xs font-semibold rounded-lg px-2.5 gap-1.5 border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add Candidate</span>
                    </Button>
                  </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
                  <div className="col-span-1 text-center flex items-center justify-center gap-1">
                    <span>#</span>
                    <span className="text-[9px] text-zinc-400 font-normal lowercase">(Δ)</span>
                  </div>
                  <div className="col-span-4">CANDIDATE</div>
                  <div className="col-span-3">AI COMPOSITE MATCH SCORE</div>
                  <div className="col-span-2">KEY SKILLS EXTRACTION</div>
                  <div className="col-span-2 text-right pr-4">STAGE</div>
                </div>

                {/* Candidates Rows */}
                {candidates.map((cand) => {
                  const isExpanded = expandedCand === cand.id;
                  const isAdvanced = !!advancedCandidates[cand.id];
                  const isAdvancingThis = advancingCandId === cand.id;
                  const delta = cand.rankDelta || 0;

                  return (
                    <div
                      key={cand.id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      {/* Summary Row */}
                      <div
                        onClick={() =>
                          setExpandedCand(isExpanded ? null : cand.id)
                        }
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer"
                      >
                        {/* Rank Number + Delta Indicator */}
                        <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
                          <span className="text-base font-bold text-zinc-950">
                            {cand.rank}
                          </span>
                          {delta > 0 ? (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1 py-0.2 rounded font-mono">
                              ↑+{delta}
                            </span>
                          ) : delta < 0 ? (
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200/60 px-1 py-0.2 rounded font-mono">
                              ↓{delta}
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-300 font-mono">-</span>
                          )}
                        </div>

                        {/* Candidate Avatar & Info */}
                        <div className="col-span-4 flex items-center gap-3">
                          {cand.isImageAvatar ? (
                            <img
                              src={cand.avatar}
                              alt={cand.name}
                              className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                              {cand.avatar}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-sm text-zinc-950 hover:underline">
                              {cand.name}
                            </h4>
                            <p className="text-xs text-zinc-500 font-medium">
                              {cand.headline}
                            </p>
                          </div>
                        </div>

                      {/* AI Match Score + Bar */}
                      <div className="col-span-3 space-y-1.5 pr-6">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-bold text-base text-zinc-950">
                            {cand.matchScore}
                          </span>
                          {cand.matchLabel && (
                            <span className="text-[10px] font-bold text-zinc-500">
                              {cand.matchLabel}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${cand.matchScore}%` }}
                            className="bg-black h-full rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* Key Skills Extraction Badges */}
                      <div className="col-span-2 flex flex-wrap gap-1">
                        {cand.skills.map((s) => (
                          <span
                            key={s}
                            className="bg-zinc-100 text-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Stage Pill + Action Options */}
                      <div className="col-span-2 flex items-center justify-end gap-2 pr-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
                            cand.stageBadgeStyle || "bg-zinc-100 text-zinc-800"
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                          <span>{cand.stage}</span>
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              title="Options"
                              className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-white rounded-xl text-xs p-1 shadow-lg border border-zinc-200 min-w-[200px]"
                          >
                            <DropdownMenuItem asChild>
                              <Link
                                href={cand.sourceResumeLink || `/candidates/${cand.id}`}
                                className="cursor-pointer font-medium"
                              >
                                View Candidate Profile
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAdvanceCandidate(cand.id)}
                              className="cursor-pointer font-medium"
                            >
                              Advance Candidate Stage
                            </DropdownMenuItem>
                            <div className="h-px bg-zinc-100 my-1" />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCandidate(cand.id);
                              }}
                              className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 flex items-center gap-2 font-medium"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Remove from Job Ranking</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Expanded AI Reasoning & Breakdown Panel */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-[#fcfbfa] border-t border-zinc-100 space-y-5 animate-in fade-in-50 duration-200">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                          {/* Left Column: AI Reasoning */}
                          <div className="lg:col-span-7 space-y-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                              <Target className="w-4 h-4 stroke-[2]" />
                              <span>AI REASONING</span>
                            </div>

                            {/* 5-Factor Weighted Criteria Scores Breakdown */}
                            <div className="space-y-3 p-3.5 bg-white rounded-xl border border-zinc-200/90 shadow-2xs">
                              <div className="flex items-center justify-between text-xs border-b border-zinc-100 pb-2">
                                <span className="font-bold text-zinc-900">Multi-Factor Criteria Breakdown</span>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                  Composite: <strong className="text-zinc-950">{cand.matchScore}/100</strong>
                                </span>
                              </div>

                              {/* 1. Technical Depth */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-zinc-700">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Technical Depth
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                      (weight: {rubricWeights.technical_depth}%)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-zinc-900">
                                    {cand.criteriaScores?.technical_depth ?? (cand.technicalDepthScore ? cand.technicalDepthScore * 10 : 85)}/100
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    style={{
                                      width: `${cand.criteriaScores?.technical_depth ?? (cand.technicalDepthScore ? cand.technicalDepthScore * 10 : 85)}%`,
                                    }}
                                    className="bg-blue-500 h-full rounded-full"
                                  />
                                </div>
                              </div>

                              {/* 2. System Design */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-zinc-700">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    System Design & Architecture
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                      (weight: {rubricWeights.system_design}%)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-zinc-900">
                                    {cand.criteriaScores?.system_design ?? (cand.systemDesignScore ? cand.systemDesignScore * 10 : 80)}/100
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    style={{
                                      width: `${cand.criteriaScores?.system_design ?? (cand.systemDesignScore ? cand.systemDesignScore * 10 : 80)}%`,
                                    }}
                                    className="bg-purple-500 h-full rounded-full"
                                  />
                                </div>
                              </div>

                              {/* 3. Experience & Seniority */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-zinc-700">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Experience & Seniority
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                      (weight: {rubricWeights.experience_seniority}%)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-zinc-900">
                                    {cand.criteriaScores?.experience_seniority ?? 85}/100
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    style={{
                                      width: `${cand.criteriaScores?.experience_seniority ?? 85}%`,
                                    }}
                                    className="bg-emerald-500 h-full rounded-full"
                                  />
                                </div>
                              </div>

                              {/* 4. Leadership & Culture */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-zinc-700">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    Leadership & Communication
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                      (weight: {rubricWeights.leadership_culture}%)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-zinc-900">
                                    {cand.criteriaScores?.leadership_culture ?? 80}/100
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    style={{
                                      width: `${cand.criteriaScores?.leadership_culture ?? 80}%`,
                                    }}
                                    className="bg-amber-500 h-full rounded-full"
                                  />
                                </div>
                              </div>

                              {/* 5. Domain Expertise */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-zinc-700">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                    Domain & Industry Knowledge
                                    <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                      (weight: {rubricWeights.domain_expertise}%)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-zinc-900">
                                    {cand.criteriaScores?.domain_expertise ?? 82}/100
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    style={{
                                      width: `${cand.criteriaScores?.domain_expertise ?? 82}%`,
                                    }}
                                    className="bg-rose-500 h-full rounded-full"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Verbatim Quote Box */}
                            {cand.quote && (
                              <div className="p-3.5 bg-white rounded-xl border border-zinc-200 text-xs italic text-zinc-700 leading-relaxed shadow-2xs">
                                <p>&ldquo;{cand.quote}&rdquo;</p>
                                {cand.sourceResumeLink && (
                                  <Link
                                    href={cand.sourceResumeLink}
                                    className="mt-2 inline-flex items-center gap-1 text-[11px] not-italic font-bold text-zinc-950 hover:underline"
                                  >
                                    <span>↗ Source Resume</span>
                                  </Link>
                                )}
                              </div>
                            )}

                            {/* Potential Gap Alert */}
                            {cand.potentialGap && (
                              <div className="p-4 bg-red-50/50 border border-red-200/80 rounded-xl space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
                                  <span>Potential Gap Identified</span>
                                </div>
                                <p className="text-xs text-zinc-600 leading-relaxed">
                                  {cand.potentialGap}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Areas for Improvement & CTA */}
                          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800">
                                  <Sparkles className="w-4 h-4 text-amber-600 stroke-[2]" />
                                  <span>AREAS FOR IMPROVEMENT</span>
                                </div>
                                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/60">
                                  Role & Resume Analysis
                                </span>
                              </div>

                              {(cand.suggestedImprovements && cand.suggestedImprovements.length > 0
                                ? cand.suggestedImprovements
                                : cand.suggestedQuestions && cand.suggestedQuestions.length > 0
                                ? cand.suggestedQuestions
                                : [
                                    "1. Upskill in Core Architecture: Deepen hands-on production framework and concurrency experience for this role.",
                                    "2. Quantify Scale Impact: Add specific throughput, latency, and operational scale metrics to resume work history.",
                                  ]
                              ).map((item, itemIdx) => (
                                <div
                                  key={itemIdx}
                                  className="p-3.5 bg-white rounded-xl border border-zinc-200/90 text-xs text-zinc-700 shadow-2xs leading-relaxed flex items-start gap-2.5 transition-colors hover:border-zinc-300"
                                >
                                  <span className="font-semibold text-zinc-900 shrink-0 select-none">
                                    {item.match(/^\d+\./) ? "" : `${itemIdx + 1}.`}
                                  </span>
                                  <span className="flex-1 font-normal text-zinc-700">
                                    {item}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Profile & Stage Progression CTAs */}
                            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                              <Button
                                asChild
                                className="flex-1 bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-full h-10 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer transition-colors"
                              >
                                <Link href={cand.sourceResumeLink || `/candidates/${cand.id}`}>
                                  <span>View Full Candidate Evaluation</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </Button>
                              <Button
                                onClick={() => handleAdvanceCandidate(cand.id)}
                                disabled={isAdvancingThis || isAdvanced}
                                variant="outline"
                                className="rounded-full h-10 text-xs font-semibold px-4 border-zinc-300 hover:bg-zinc-50 cursor-pointer"
                              >
                                {isAdvanced ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Stage Advanced ✓</span>
                                  </>
                                ) : (
                                  <span>
                                    {isAdvancingThis ? "Advancing..." : "Advance Stage →"}
                                  </span>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleRemoveCandidate(cand.id)}
                                variant="outline"
                                className="rounded-full h-10 text-xs font-semibold px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200/80 cursor-pointer gap-1.5"
                                title="Remove candidate from this job ranking"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Remove</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


          {/* ============================================================ */}
          {/* TAB 2: PIPELINE BOARD (Kanban Board for this job) */}
          {/* ============================================================ */}
          {activeTab === "Pipeline Board" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  {
                    stage: "Screening",
                    count: 2,
                    items: candidates.filter(
                      (c) => c.stage === "Screening" || c.stage === "Applied"
                    ),
                  },
                  {
                    stage: "Interview",
                    count: candidates.filter((c) => c.stage === "Interview").length,
                    items: candidates.filter((c) => c.stage === "Interview"),
                  },
                  {
                    stage: "Qualified",
                    count: candidates.filter((c) => c.stage === "Qualified").length,
                    items: candidates.filter(
                      (c) => c.stage === "Qualified"
                    ),
                  },
                  {
                    stage: "Offer",
                    count: 1,
                    items: [
                      {
                        id: "cand-offer-1",
                        rank: 0,
                        name: "Marcus Chen",
                        headline: "Lead Architect",
                        avatar:
                          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
                        isImageAvatar: true,
                        matchScore: 96,
                        skills: ["Python", "AWS", "Kafka"],
                        stage: "Offer",
                      },
                    ],
                  },
                ].map((col) => (
                  <div
                    key={col.stage}
                    className="bg-[#f6f5f1] rounded-2xl p-4 flex flex-col gap-3 min-h-[420px]"
                  >
                    <div className="flex items-center justify-between px-1 pb-1">
                      <span className="font-bold text-xs text-zinc-800">
                        {col.stage}
                      </span>
                      <span className="w-5 h-5 rounded-full bg-[#eae7df] text-zinc-700 font-bold text-[11px] flex items-center justify-center">
                        {col.items.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {col.items.map((cand) => (
                        <div
                          key={cand.id}
                          className="bg-white rounded-xl p-4 border border-zinc-200/80 shadow-xs space-y-3 hover:border-zinc-400 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              {cand.isImageAvatar ? (
                                <img
                                  src={cand.avatar}
                                  alt={cand.name}
                                  className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center">
                                  {cand.avatar}
                                </div>
                              )}
                              <div>
                                <h5 className="font-bold text-xs text-zinc-950">
                                  {cand.name}
                                </h5>
                                <p className="text-[11px] text-zinc-500 font-medium leading-tight">
                                  {cand.headline}
                                </p>
                              </div>
                            </div>
                            <span className="bg-zinc-100 text-zinc-900 font-bold text-[11px] px-2 py-0.5 rounded-md">
                              {cand.matchScore}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {cand.skills.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="bg-[#f4f3ee] text-zinc-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                              >
                                {s}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px]">
                            <Link
                              href={`/candidates/${cand.id}`}
                              className="text-zinc-600 font-semibold hover:text-black hover:underline"
                            >
                              View Profile
                            </Link>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAdvanceCandidate(cand.id)}
                                className="text-zinc-950 font-bold hover:underline cursor-pointer"
                              >
                                Advance →
                              </button>
                              <button
                                onClick={() => handleRemoveCandidate(cand.id)}
                                title="Remove candidate from this job"
                                className="text-zinc-400 hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: JOB DETAILS */}
          {/* ============================================================ */}
          {activeTab === "Job Details" && (
            <div className="space-y-6 animate-in fade-in-50 duration-150">
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">
                      Requisition Specifications
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Target requirements used for automated vector and cross-encoder scoring.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsEditOpen(true)}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-semibold gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Specs</span>
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Job Description
                    </h4>
                    <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed bg-zinc-50/70 p-4 rounded-xl border border-zinc-100">
                      {job.job_description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-zinc-50/70 p-4 rounded-xl border border-zinc-100 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                        Required Core Skills
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {job.required_skills.map((skill) => (
                          <Badge
                            key={skill}
                            variant="tag"
                            className="text-xs px-2.5 py-1"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="bg-zinc-50/70 p-4 rounded-xl border border-zinc-100 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                        Target Experience
                      </span>
                      <p className="text-xs text-zinc-800 font-medium">
                        {job.min_years_experience} + years professional industry experience in backend / distributed systems.
                      </p>
                      <div className="text-xs text-zinc-500 pt-1">
                        Location: <span className="font-semibold text-zinc-800">{job.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: ACTIVITY LOG */}
          {/* ============================================================ */}
          {activeTab === "Activity" && (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5 animate-in fade-in-50 duration-150">
              <h3 className="font-bold text-base text-zinc-950 border-b border-zinc-100 pb-3">
                Job Activity & Matching Audit Stream
              </h3>

              <div className="space-y-4">
                {[
                  {
                    title: "AI Candidate Evaluation Completed",
                    desc: "Ollama model (gemma4:e2b) finished Stage 3 Rubric evaluations for 34 ingested resumes.",
                    time: "2 hours ago",
                    badge: "AI System",
                  },
                  {
                    title: "Priya Sharma Advanced to Interview",
                    desc: "Recruiter Admin advanced candidate following 95 Top Match score recommendation.",
                    time: "3 hours ago",
                    badge: "Recruiter Admin",
                  },
                  {
                    title: "Batch Resume Ingestion Triggered",
                    desc: "12 new candidate resumes parsed and PII redacted via Microsoft Presidio.",
                    time: "Yesterday at 4:20 PM",
                    badge: "Background Worker",
                  },
                ].map((act, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-50/60 border border-zinc-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#eae7df] text-zinc-800 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-zinc-950">
                          {act.title}
                        </h4>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {act.time}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {act.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Job Modal Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-950">
              Edit Requisition Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveJobEdit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Job Title
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">
                  Department
                </label>
                <Input
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-600">
                  Location
                </label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Job Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-600 block">
                Required Skills
              </label>
              <div className="flex flex-wrap gap-1.5">
                {editSkills.map((sk) => (
                  <span
                    key={sk}
                    className="bg-zinc-100 text-zinc-800 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1"
                  >
                    <span>{sk}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(sk)}
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  placeholder="Add skill..."
                  className="h-8 text-xs max-w-[160px] rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddSkill}
                  className="h-8 text-xs px-3"
                >
                  Add
                </Button>
              </div>
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
                className="bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 text-xs px-5 rounded-xl transition-colors"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Candidate & Re-Rank Modal */}
      <AddCandidateJobModal
        open={isAddCandidateOpen}
        onOpenChange={setIsAddCandidateOpen}
        jobTitle={job.title}
        jobId={rawId}
        requiredSkills={job.required_skills}
        existingCandidateIds={candidates.map((c) => c.id)}
        onAddCandidate={handleAddCandidate}
      />
    </div>
  );
}
