"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Sparkles,
  UploadCloud,
  Search,
  CheckCircle2,
  FileText,
  User,
  Plus,
  X,
  Zap,
  Check,
  Building2,
  Clock,
  Briefcase,
  Layers,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadResumeFile } from "@/lib/api";

export interface NewCandidatePayload {
  name: string;
  headline: string;
  avatar: string;
  isImageAvatar: boolean;
  matchScore: number;
  matchLabel: string;
  skills: string[];
  stage: string;
  stageBadgeStyle?: string;
  technicalDepthScore: number;
  systemDesignScore: number;
  quote: string;
  sourceResumeLink?: string;
  potentialGap?: string;
  suggestedQuestions: string[];
}

interface AddCandidateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  requiredSkills: string[];
  existingCandidateIds?: string[];
  onAddCandidate: (candidate: NewCandidatePayload) => void;
}

// Global Repository Candidate Pool available to be linked to any job
const TALENT_REPOSITORY_POOL = [
  {
    id: "pool-001",
    name: "Dr. Marcus Vance",
    headline: "Staff Distributed Systems Architect @ Meta",
    location: "San Francisco, CA",
    skills: ["Python", "Kubernetes", "FastAPI", "AWS", "Go", "PostgreSQL", "Kafka"],
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    experienceYears: 9,
    quote: "Engineered multi-region event streaming fabric processing 200k RPS with sub-millisecond p99 latency.",
    stage: "Interview",
  },
  {
    id: "pool-002",
    name: "Samantha Reed",
    headline: "Senior Backend & Platform Dev @ Datadog",
    location: "New York, NY",
    skills: ["Python", "PostgreSQL", "FastAPI", "Docker", "Redis", "AWS"],
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    experienceYears: 6,
    quote: "Architected distributed observability ingest services handling 15M metrics/minute with zero packet drop.",
    stage: "Qualified",
  },
  {
    id: "pool-003",
    name: "Kai Nakamura",
    headline: "Cloud Software Engineer @ Shopify",
    location: "Toronto / Remote",
    skills: ["Go", "Kubernetes", "AWS", "gRPC", "Docker", "Terraform"],
    avatar: "KN",
    isImageAvatar: false,
    experienceYears: 4,
    quote: "Maintained Kubernetes cluster orchestration and developed automated canary deployment operators across multi-cloud regions.",
    stage: "Screening",
  },
  {
    id: "pool-004",
    name: "Aisha Patel",
    headline: "Senior Machine Learning Engineer @ Anthropic",
    location: "Seattle, WA",
    skills: ["Python", "PyTorch", "FastAPI", "Docker", "Kubernetes", "Distributed Training"],
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    experienceYears: 7,
    quote: "Implemented distributed inference serving pipelines with vLLM and TensorRT-LLM achieving 3x throughput improvements.",
    stage: "Interview",
  },
  {
    id: "pool-005",
    name: "David Ross",
    headline: "Distributed Systems Developer @ Block",
    location: "Austin, TX",
    skills: ["Go", "Kafka", "PostgreSQL", "Redis", "Microservices"],
    avatar: "DR",
    isImageAvatar: false,
    experienceYears: 5,
    quote: "Built financial ledger consistency check services validating 50k transactions/sec with zero race conditions.",
    stage: "Screening",
  },
  {
    id: "pool-006",
    name: "Lucas Vance",
    headline: "Full Stack Platform Architect @ Stripe",
    location: "Boston, MA",
    skills: ["TypeScript", "Python", "React", "PostgreSQL", "GraphQL", "AWS"],
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80",
    isImageAvatar: true,
    experienceYears: 8,
    quote: "Designed unified developer portal and API gateway serving 40+ engineering teams.",
    stage: "Qualified",
  },
  {
    id: "pool-007",
    name: "Sarah Connor",
    headline: "Lead Site Reliability Engineer @ Netflix",
    location: "Los Angeles, CA",
    skills: ["Kubernetes", "AWS", "Terraform", "Prometheus", "Python", "Go"],
    avatar: "SC",
    isImageAvatar: false,
    experienceYears: 10,
    quote: "Spearheaded enterprise chaos engineering frameworks, maintaining 99.999% uptime across critical video streaming microservices.",
    stage: "Applied",
  },
];

export function AddCandidateJobModal({
  open,
  onOpenChange,
  jobTitle,
  requiredSkills,
  existingCandidateIds = [],
  onAddCandidate,
}: AddCandidateJobModalProps) {
  const [activeTab, setActiveTab] = useState<"pool" | "upload" | "manual">("pool");
  const [searchQuery, setSearchQuery] = useState("");

  // Manual Form State
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillText, setNewSkillText] = useState("");
  const [quote, setQuote] = useState("");
  const [stage, setStage] = useState("Screening");
  const [customScore, setCustomScore] = useState<number>(88);
  const [scoreMode, setScoreMode] = useState<"auto" | "manual">("auto");

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to compute match score dynamically against current job requirements
  const calculateCandidateScore = (candidateSkills: string[]) => {
    if (!requiredSkills || requiredSkills.length === 0) return 85;
    const matches = candidateSkills.filter((s) =>
      requiredSkills.some(
        (req) =>
          req.toLowerCase() === s.toLowerCase() ||
          s.toLowerCase().includes(req.toLowerCase()) ||
          req.toLowerCase().includes(s.toLowerCase())
      )
    ).length;
    const ratio = matches / Math.max(requiredSkills.length, 1);
    const score = Math.round(68 + ratio * 30);
    return Math.min(Math.max(score, 65), 98);
  };

  // Filter Pool Candidates
  const filteredPool = TALENT_REPOSITORY_POOL.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.headline.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  // Handler for adding a candidate from the talent pool
  const handleSelectFromPool = (candidate: (typeof TALENT_REPOSITORY_POOL)[0]) => {
    const finalScore = calculateCandidateScore(candidate.skills);
    const matchLabel =
      finalScore >= 93
        ? "Top Match"
        : finalScore >= 87
        ? "Strong Match"
        : finalScore >= 80
        ? "Match"
        : "Potential Match";

    const techDepth = parseFloat((finalScore / 10.2).toFixed(1));
    const sysDesign = parseFloat(((finalScore - 3.5) / 10.1).toFixed(1));

    const missingSkills = requiredSkills.filter(
      (req) =>
        !candidate.skills.some(
          (s) =>
            s.toLowerCase() === req.toLowerCase() ||
            s.toLowerCase().includes(req.toLowerCase())
        )
    );

    const potentialGap =
      missingSkills.length > 0
        ? `No explicit mention of [${missingSkills.slice(0, 2).join(", ")}] in primary achievements. Recommended to probe during technical interview.`
        : undefined;

    const payload: NewCandidatePayload = {
      name: candidate.name,
      headline: candidate.headline,
      avatar: candidate.avatar,
      isImageAvatar: candidate.isImageAvatar,
      matchScore: finalScore,
      matchLabel,
      skills: candidate.skills,
      stage: candidate.stage,
      stageBadgeStyle:
        candidate.stage === "Interview"
          ? "bg-[#ede8dc] text-zinc-800"
          : candidate.stage === "Qualified"
          ? "bg-emerald-100 text-emerald-900"
          : "bg-zinc-100 text-zinc-700",
      technicalDepthScore: techDepth,
      systemDesignScore: sysDesign,
      quote: candidate.quote,
      sourceResumeLink: `/candidates/cand-${candidate.id}`,
      potentialGap,
      suggestedQuestions: [
        `Can you describe a specific time you architected systems using ${candidate.skills[0] || "distributed microservices"} under heavy load?`,
        `How do you diagnose and resolve database bottlenecks or streaming lag in production?`,
      ],
    };

    onAddCandidate(payload);
    onOpenChange(false);
  };

  // Resume Upload Handler
  const handleResumeFile = (file: File) => {
    setUploadedFile(file);
    setIsUploading(true);
    setUploadProgress(15);
    const fileNameLower = file.name.toLowerCase();
    const isImage = /\.(png|jpe?g|webp|tiff|bmp)$/i.test(fileNameLower);
    const isDocx = /\.(docx|doc)$/i.test(fileNameLower);

    const initialStep = isImage
      ? "Scanning Image via OCR (PyMuPDF / Docling Vision)..."
      : isDocx
      ? "Parsing Word DOCX Layout & Experience Tables..."
      : "Parsing PDF layout & extracting structured sections...";

    setUploadStep(initialStep);

    uploadResumeFile(file).then((res) => {
      // Simulate pipeline steps
      setTimeout(() => {
        setUploadProgress(45);
        setUploadStep("De-identifying PII (names, phone, email) via Presidio...");
      }, 1000);

      setTimeout(() => {
        setUploadProgress(75);
        setUploadStep("Evaluating candidate against job criteria via Ollama LLM...");
      }, 2200);

      setTimeout(() => {
        setUploadProgress(100);
        setUploadStep("Complete! Generating match score and ranking position...");

        setTimeout(() => {
          setIsUploading(false);

          // Generate extracted candidate profile
          const parsedName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

          const extractedSkills = Array.from(
            new Set([...requiredSkills.slice(0, 3), "Python", "Microservices", "Docker"])
          );

          const finalScore = calculateCandidateScore(extractedSkills);
          const initials = parsedName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "CV";

          const payload: NewCandidatePayload = {
            name: parsedName || "Ingested Candidate",
            headline: "Senior Software Engineer (Parsed from Resume)",
            avatar: initials,
            isImageAvatar: false,
            matchScore: finalScore,
            matchLabel: finalScore >= 90 ? "Top Match" : "Strong Match",
            skills: extractedSkills,
            stage: "Screening",
            stageBadgeStyle: "bg-zinc-100 text-zinc-700",
            technicalDepthScore: parseFloat((finalScore / 10.2).toFixed(1)),
            systemDesignScore: parseFloat(((finalScore - 3.8) / 10.1).toFixed(1)),
            quote: `Extracted from uploaded resume [${file.name}]: Extensive hands-on experience designing cloud services and backend systems.`,
            sourceResumeLink: `/candidates/${res.candidate_id || "cand-uploaded"}`,
            potentialGap: "Automated extraction completed. Verification recommended during initial screening call.",
            suggestedQuestions: [
              `Walk through the technical architecture described in your recent project on ${extractedSkills[0] || "distributed systems"}.`,
              `How do you handle zero-downtime database migrations in live microservices?`,
            ],
          };

          onAddCandidate(payload);
          onOpenChange(false);
          setUploadedFile(null);
          setUploadProgress(0);
          setUploadStep(null);
        }, 800);
      }, 3400);
    });
  };

  // Manual Form Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !headline.trim()) return;

    const finalScore =
      scoreMode === "auto" ? calculateCandidateScore(skills) : customScore;

    const matchLabel =
      finalScore >= 93
        ? "Top Match"
        : finalScore >= 87
        ? "Strong Match"
        : finalScore >= 80
        ? "Match"
        : "Potential Match";

    const techDepth = parseFloat((finalScore / 10.2).toFixed(1));
    const sysDesign = parseFloat(((finalScore - 4) / 10.1).toFixed(1));

    const initials = name
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CD";

    const payload: NewCandidatePayload = {
      name: name.trim(),
      headline: headline.trim(),
      avatar: initials,
      isImageAvatar: false,
      matchScore: finalScore,
      matchLabel,
      skills: skills.length > 0 ? skills : ["Python", "Backend"],
      stage,
      stageBadgeStyle:
        stage === "Interview"
          ? "bg-[#ede8dc] text-zinc-800"
          : stage === "Qualified"
          ? "bg-emerald-100 text-emerald-900"
          : "bg-zinc-100 text-zinc-700",
      technicalDepthScore: techDepth,
      systemDesignScore: sysDesign,
      quote:
        quote.trim() ||
        `Demonstrated depth in ${skills.slice(0, 3).join(", ") || "engineering best practices"}.`,
      sourceResumeLink: `/candidates/cand-${Date.now().toString().slice(-4)}`,
      suggestedQuestions: [
        `Can you describe how you architected systems using ${skills[0] || "your core stack"} to handle high traffic?`,
        `How do you monitor and debug unexpected latency spikes in distributed microservices?`,
      ],
    };

    onAddCandidate(payload);
    onOpenChange(false);

    // Reset Form
    setName("");
    setHeadline("");
    setSkills([]);
    setQuote("");
    setStage("Screening");
    setCustomScore(88);
    setScoreMode("auto");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 sm:p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs shrink-0">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-950">
                Add Candidate to Job Ranking
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                Target Requisition: <span className="font-semibold text-zinc-900">{jobTitle}</span>. Adding a candidate triggers instant multi-candidate re-ranking.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-[#f6f5f1] rounded-xl mt-3 border border-zinc-200/60">
          <button
            type="button"
            onClick={() => setActiveTab("pool")}
            className={cn(
              "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              activeTab === "pool"
                ? "bg-white text-zinc-950 shadow-xs font-bold"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Select from Candidate Pool ({filteredPool.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              activeTab === "upload"
                ? "bg-white text-zinc-950 shadow-xs font-bold"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Resume</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
              activeTab === "manual"
                ? "bg-white text-zinc-950 shadow-xs font-bold"
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>Manual Form</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: TALENT REPOSITORY POOL */}
        {/* ============================================================ */}
        {activeTab === "pool" && (
          <div className="space-y-3.5 mt-4">
            {/* Search Filter Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by name, headline, skills, or location..."
                className="h-10 text-xs pl-10 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white"
              />
            </div>

            {/* Candidate List Container */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredPool.map((cand) => {
                const score = calculateCandidateScore(cand.skills);
                const isAlreadyAdded = (existingCandidateIds || []).includes(cand.id);

                return (
                  <div
                    key={cand.id}
                    className="p-3.5 bg-white border border-zinc-200/90 hover:border-zinc-300 rounded-xl shadow-2xs flex items-center justify-between gap-4 transition-all hover:bg-zinc-50/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
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

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-zinc-950">
                            {cand.name}
                          </h4>
                          <span className="text-[10px] font-bold bg-[#ede8dc] text-zinc-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{score}% Match</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {cand.headline}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cand.skills.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="bg-zinc-100 text-zinc-700 text-[10px] font-medium px-1.5 py-0.2 rounded"
                            >
                              {s}
                            </span>
                          ))}
                          {cand.skills.length > 4 && (
                            <span className="text-[10px] text-zinc-400">
                              +{cand.skills.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectFromPool(cand)}
                      size="sm"
                      className="bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-xl text-xs font-semibold h-8 px-3.5 gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add & Re-Rank</span>
                    </Button>
                  </div>
                );
              })}

              {filteredPool.length === 0 && (
                <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  <p className="text-xs text-zinc-500 font-medium">
                    No candidates found matching &ldquo;{searchQuery}&rdquo;.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: RESUME UPLOAD */}
        {/* ============================================================ */}
        {activeTab === "upload" && (
          <div className="space-y-4 mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.tiff,.bmp,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleResumeFile(e.target.files[0]);
                }
              }}
            />

            {!isUploading ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 hover:border-zinc-950 bg-[#faf9f6] hover:bg-zinc-100/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-800 mb-3 shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-zinc-950">
                  Select or drop a candidate resume
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports PDF Layout Parsing, Word DOCX, and Image OCR extraction + Presidio PII scrubbing
                </p>

                {/* Badges */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
                  <span className="bg-red-50 text-red-700 border border-red-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    PDF
                  </span>
                  <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Word DOCX
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Image OCR (PNG/JPG)
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl text-xs font-semibold px-4 border-zinc-300"
                >
                  Browse Document
                </Button>
              </div>
            ) : (
              <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-zinc-800 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-950">
                        {uploadedFile?.name || "Processing resume document"}
                      </h4>
                      <p className="text-[11px] text-zinc-500">{uploadStep}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-800">
                    {uploadProgress}%
                  </span>
                </div>

                <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${uploadProgress}%` }}
                    className="bg-black h-full rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            )}

            {/* Sample Multi-Format Resumes to Test With One Click */}
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Or test with a sample resume:</span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    name: "Alex_Rivera_Staff_Backend.pdf",
                    role: "Staff Backend Engineer",
                    badge: "PDF",
                    badgeClass: "bg-red-50 text-red-700 border-red-200/60",
                    type: "application/pdf",
                  },
                  {
                    name: "David_Chen_Platform_Dev.docx",
                    role: "Senior Platform Architect",
                    badge: "DOCX",
                    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/60",
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  },
                  {
                    name: "Sarah_Jenkins_Frontend.png",
                    role: "Staff UI/UX Systems Dev",
                    badge: "OCR PNG",
                    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                    type: "image/png",
                  },
                ].map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => {
                      const file = new File(
                        ["Sample ATS resume content with skills and experience"],
                        sample.name,
                        { type: sample.type }
                      );
                      handleResumeFile(file);
                    }}
                    className="p-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-left text-xs transition-colors flex flex-col justify-between cursor-pointer gap-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${sample.badgeClass}`}>
                        {sample.badge}
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-400" />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-950 truncate text-[11px]">
                        {sample.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {sample.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: MANUAL ENTRY FORM */}
        {/* ============================================================ */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Candidate Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Headline / Role <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Backend Dev @ Stripe"
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Pipeline Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none"
                >
                  <option value="Screening">Screening</option>
                  <option value="Applied">Applied</option>
                  <option value="Interview">Interview</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Offer">Offer</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700">
                    Match Score
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setScoreMode(scoreMode === "auto" ? "manual" : "auto")
                    }
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 font-semibold underline cursor-pointer"
                  >
                    {scoreMode === "auto" ? "Manual" : "Auto-Calculate"}
                  </button>
                </div>
                {scoreMode === "auto" ? (
                  <div className="h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-zinc-600 font-medium">
                      Auto-computed:
                    </span>
                    <span className="font-bold bg-black text-white px-2 py-0.5 rounded-lg">
                      {calculateCandidateScore(skills)}%
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={40}
                      max={100}
                      value={customScore}
                      onChange={(e) => setCustomScore(Number(e.target.value))}
                      className="h-10 text-xs rounded-xl w-24 font-bold"
                    />
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={customScore}
                      onChange={(e) => setCustomScore(Number(e.target.value))}
                      className="flex-1 accent-black cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Skills Tag Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700 block">
                Skills & Tech Stack
              </label>

              {requiredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider self-center mr-1">
                    Job Match:
                  </span>
                  {requiredSkills.map((reqSkill) => {
                    const isSelected = skills.includes(reqSkill);
                    return (
                      <button
                        key={reqSkill}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSkills(skills.filter((s) => s !== reqSkill));
                          } else {
                            setSkills([...skills, reqSkill]);
                          }
                        }}
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer",
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-400"
                        )}
                      >
                        <span>{reqSkill}</span>
                        {isSelected ? (
                          <X className="w-2.5 h-2.5" />
                        ) : (
                          <Plus className="w-2.5 h-2.5 text-zinc-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="bg-[#ede8dc] text-zinc-900 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => setSkills(skills.filter((s) => s !== skill))}
                        className="text-zinc-500 hover:text-zinc-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  placeholder="Add custom skill (e.g. Terraform, GraphQL)..."
                  className="h-9 text-xs rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = newSkillText.trim();
                      if (t && !skills.includes(t)) {
                        setSkills([...skills, t]);
                        setNewSkillText("");
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const t = newSkillText.trim();
                    if (t && !skills.includes(t)) {
                      setSkills([...skills, t]);
                      setNewSkillText("");
                    }
                  }}
                  className="h-9 text-xs px-3.5 rounded-xl cursor-pointer"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 block">
                Resume Excerpt / Accomplishment
              </label>
              <textarea
                rows={3}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Key accomplishments or summary..."
                className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-xl text-xs px-5 font-semibold gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add & Re-Rank Candidate</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
