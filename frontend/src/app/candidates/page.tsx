"use client";

import { SymbolIcon } from "@/components/ui/symbol-icon";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { AddCandidateModal } from "@/components/candidate/add-candidate-modal";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { fetchCandidates, fetchJobs, getErrorMessage, updateCandidateStage } from "@/lib/api";
import { CandidateDetail, JobRequisition } from "@/types/ats";
import {
  Sparkles,
  ChevronDown,
  Filter,
  MapPin,
  X,
  RefreshCw,
  Users,
  User,
} from "lucide-react";

interface CandidateRosterItem {
  id: string;
  name: string;
  title: string;
  companyTag?: string;
  avatar?: string;
  isStarred?: boolean;
  targetJob: string;
  jobId?: string;
  matchScore?: number | null;
  matchScoreLabel?: string;
  isProcessing?: boolean;
  applicationsCount?: number;
  multiApplications?: Array<{ title: string; score: number }>;
  stage: string;
  stageColor: string;
  skills: string[];
  extractingSkillsCount?: number;
  experienceYears: number;
  location: string;
  locationType: "Hybrid" | "Remote" | "On-site";
  source: string;
  sourceDetail: string;
  owner: string;
  ownerAvatar?: string;
  actionType: "Review Evidence" | "View Scorecard" | "View Status" | "Select App" | "Match to Job";
}

const MIN_EXP_OPTIONS = ["All", "1+ yrs", "3+ yrs", "5+ yrs", "8+ yrs", "10+ yrs"];

function getStageBadgeColor(stage: string): { dot: string; bg: string; text: string } {
  switch (stage?.toLowerCase()) {
    case "recruiter review":
      return { dot: "bg-amber-500", bg: "bg-amber-100", text: "text-amber-900" };
    case "screening":
      return { dot: "bg-blue-500", bg: "bg-blue-100", text: "text-blue-900" };
    case "interview":
    case "interview (stage 2)":
      return { dot: "bg-purple-500", bg: "bg-purple-100", text: "text-purple-900" };
    case "qualified":
      return { dot: "bg-indigo-500", bg: "bg-indigo-100", text: "text-indigo-900" };
    case "offer":
    case "offered":
      return { dot: "bg-emerald-500", bg: "bg-emerald-100", text: "text-emerald-900" };
    case "hired":
      return { dot: "bg-green-600", bg: "bg-green-100", text: "text-green-900" };
    case "talent pool":
      return { dot: "bg-slate-500", bg: "bg-slate-200", text: "text-slate-800" };
    case "rejected":
      return { dot: "bg-rose-500", bg: "bg-rose-100", text: "text-rose-900" };
    case "applied":
    default:
      return { dot: "bg-[#497cff]", bg: "bg-[#dee2ef]", text: "text-[#171c25]" };
  }
}

type CandidateWithMeta = CandidateDetail & {
  source?: string;
  sourceDetail?: string;
  owner?: string;
};

export default function CandidateDirectoryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isMovingStage, setIsMovingStage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateRosterItem[]>([]);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Filters - All default to "All"
  const [stageFilter, setStageFilter] = useState("All");
  const [minExpFilter, setMinExpFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [skillFilter, setSkillFilter] = useState("All");

  // Modals
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Load live candidates and jobs from backend
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      (fetchCandidates as (p?: unknown) => Promise<unknown>)({ page: currentPage, limit: pageSize, envelope: true }).catch(() => fetchCandidates()),
      fetchJobs().catch(() => [] as JobRequisition[])
    ])
      .then(([rawCandidates, liveJobs]) => {
        if (!cancelled) {
          if (liveJobs) {
            setJobs(liveJobs);
          }
          if (rawCandidates) {
            const items: CandidateDetail[] = Array.isArray(rawCandidates)
              ? (rawCandidates as CandidateDetail[])
              : (((rawCandidates as { items?: CandidateDetail[] })?.items) || []);
            const total = Array.isArray(rawCandidates)
              ? rawCandidates.length
              : (((rawCandidates as { total?: number })?.total) ?? items.length);
            const more = Array.isArray(rawCandidates)
              ? false
              : (((rawCandidates as { has_more?: boolean })?.has_more) ?? false);

            setTotalCandidates(total);
            setHasMore(more);

            const mapped: CandidateRosterItem[] = items.map((c) => {
              const actualStage = c.stage || "Applied";
              const stageColors = getStageBadgeColor(actualStage);
              const candObj = c as CandidateWithMeta;
              const source =
                candObj.source ||
                (c.applied_for_job && c.applied_for_job !== "Talent Pool"
                  ? "Job Application"
                  : c.linkedin
                  ? "LinkedIn Sourced"
                  : "Not recorded");
              const sourceDetail =
                candObj.sourceDetail ||
                (source === "Job Application"
                  ? c.applied_for_job
                  : source === "LinkedIn Sourced"
                  ? "Inbound profile"
                  : source === "Not recorded" ? "Not recorded" : "Direct upload");
              const owner = candObj.owner || "Unassigned";

              return {
                id: c.id,
                name: c.name || "Candidate",
                title: c.target_headline || c.role || "Candidate Profile",
                avatar: c.avatar || undefined,
                targetJob: c.applied_for_job || "Talent Pool",
                jobId: c.applied_for_job_id,
                matchScore: c.scorecard?.overall_match_score ?? null,
                matchScoreLabel: c.scorecard ? "(Rubric evaluated)" : "(Pending)",
                stage: actualStage,
                stageColor: stageColors.dot,
                skills: c.core_skills && c.core_skills.length > 0 ? c.core_skills.slice(0, 5) : [],
                experienceYears: Math.round(c.years_of_experience || 0),
                location: c.location || "Remote",
                locationType: (c.location?.toLowerCase().includes("hybrid")
                  ? "Hybrid"
                  : c.location?.toLowerCase().includes("site")
                  ? "On-site"
                  : "Remote"),
                source,
                sourceDetail,
                owner,
                actionType: "Review Evidence",
              };
            });
            setCandidates(mapped);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Dynamic filter lists derived from real candidate data
  const availableStages = useMemo(() => {
    const stageSet = new Set(candidates.map((c) => c.stage).filter(Boolean));
    return ["All", ...Array.from(stageSet).sort()];
  }, [candidates]);

  const availableSources = useMemo(() => {
    const sourceSet = new Set(candidates.map((c) => c.source).filter(Boolean));
    return ["All", ...Array.from(sourceSet).sort()];
  }, [candidates]);

  const availableOwners = useMemo(() => {
    const ownerSet = new Set(candidates.map((c) => c.owner).filter(Boolean));
    return ["All", ...Array.from(ownerSet).sort()];
  }, [candidates]);

  const availableSkills = useMemo(() => {
    const skillSet = new Set<string>();
    candidates.forEach((c) => {
      c.skills.forEach((s) => skillSet.add(s));
    });
    return ["All", ...Array.from(skillSet).sort()];
  }, [candidates]);

  // Active filters helper
  const hasActiveFilters = useMemo(() => {
    return (
      stageFilter !== "All" ||
      minExpFilter !== "All" ||
      sourceFilter !== "All" ||
      ownerFilter !== "All" ||
      skillFilter !== "All" ||
      searchQuery.trim().length > 0
    );
  }, [stageFilter, minExpFilter, sourceFilter, ownerFilter, skillFilter, searchQuery]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (stageFilter !== "All") count++;
    if (minExpFilter !== "All") count++;
    if (sourceFilter !== "All") count++;
    if (ownerFilter !== "All") count++;
    if (skillFilter !== "All") count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [stageFilter, minExpFilter, sourceFilter, ownerFilter, skillFilter, searchQuery]);

  // Reset all filters properly
  const handleResetFilters = () => {
    setStageFilter("All");
    setMinExpFilter("All");
    setSourceFilter("All");
    setOwnerFilter("All");
    setSkillFilter("All");
    setSearchQuery("");
    showToast("✓ All filters have been reset to default view");
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesSkills = c.skills.some((s) => s.toLowerCase().includes(q));
        const matchesCompany = c.companyTag?.toLowerCase().includes(q);
        const matchesJob = c.targetJob?.toLowerCase().includes(q);
        const matchesLocation = c.location?.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesSkills && !matchesCompany && !matchesJob && !matchesLocation) {
          return false;
        }
      }

      // 2. Stage Filter
      if (stageFilter !== "All" && c.stage.toLowerCase() !== stageFilter.toLowerCase()) {
        return false;
      }

      // 3. Min Experience Filter
      if (minExpFilter !== "All") {
        const minYears = parseInt(minExpFilter, 10);
        if (!isNaN(minYears) && c.experienceYears < minYears) {
          return false;
        }
      }

      // 4. Source Filter
      if (sourceFilter !== "All" && c.source.toLowerCase() !== sourceFilter.toLowerCase()) {
        return false;
      }

      // 5. Owner Filter
      if (ownerFilter !== "All" && c.owner.toLowerCase() !== ownerFilter.toLowerCase()) {
        return false;
      }

      // 6. Skill Filter
      if (skillFilter !== "All") {
        const hasSkill = c.skills.some((s) => s.toLowerCase() === skillFilter.toLowerCase());
        if (!hasSkill) {
          return false;
        }
      }

      return true;
    });
  }, [candidates, searchQuery, stageFilter, minExpFilter, sourceFilter, ownerFilter, skillFilter]);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allSelected =
    filteredCandidates.length > 0 && filteredCandidates.every((c) => selectedIds[c.id]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({});
    } else {
      const all: Record<string, boolean> = {};
      filteredCandidates.forEach((c) => {
        all[c.id] = true;
      });
      setSelectedIds(all);
    }
  };

  const toggleSelectCandidate = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };



  const handleQuickAction = (cand: CandidateRosterItem) => {
    router.push(`/candidates/${encodeURIComponent(cand.id)}`);
  };

  const handleBulkMoveStage = async (newStage: string) => {
    const selected = candidates.filter(candidate => selectedIds[candidate.id]);
    if (!selected.length || isMovingStage) return;
    setIsMovingStage(true);
    setError(null);
    try {
      const results = await Promise.allSettled(selected.map(candidate =>
        updateCandidateStage(candidate.id, newStage, candidate.jobId)));
      const saved = new Map<string, string>();
      const failures: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") saved.set(selected[index].id, result.value.stage);
        else failures.push(`${selected[index].name}: ${getErrorMessage(result.reason)}`);
      });
      setCandidates(previous => previous.map(candidate => {
        const stage = saved.get(candidate.id);
        return stage ? { ...candidate, stage, stageColor: getStageBadgeColor(stage).dot } : candidate;
      }));
      setSelectedIds(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !saved.has(id))));
      if (failures.length) setError(`${saved.size} of ${selected.length} updated. ${failures.join("; ")}`);
      else showToast(`Moved ${saved.size} candidates to ${newStage}.`);
    } finally {
      setIsMovingStage(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = filteredCandidates.length > 0 ? filteredCandidates : candidates;
    const headers = "Name,Title,Target Job,Stage,Skills,Experience,Location,Source,Owner\n";
    const rows = listToExport
      .map(
        (c) =>
          `"${c.name}","${c.title}","${c.targetJob}","${c.stage}","${c.skills.join("; ")}",${c.experienceYears}y,"${c.location}","${c.source}","${c.owner}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates-roster-${Date.now()}.csv`;
    a.click();
    showToast(`✓ Exported ${listToExport.length} candidates to CSV`);
  };

  const requisitionsCount = jobs.length;

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f9f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full gap-6">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading && <p role="status" className="text-sm text-zinc-600">Loading candidates…</p>}
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <Sparkles className="w-4 h-4 text-[#7a55fa] shrink-0" />
                <span className="text-xs font-semibold">{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="ml-2 text-[#7b8495] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Header Area: Clean title & dynamic candidate count */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#171c25] tracking-tight">
                  Candidate Directory
                </h1>
                <p className="text-xs sm:text-sm text-[#45474c] mt-0.5">
                  {hasActiveFilters ? (
                    <>
                      Showing <span className="font-semibold text-[#171c25]">{filteredCandidates.length}</span> of{" "}
                      <span className="font-semibold text-[#171c25]">{candidates.length}</span> active candidates across{" "}
                      <span className="font-semibold text-[#171c25]">{requisitionsCount}</span> {requisitionsCount === 1 ? "requisition" : "requisitions"} and verified talent pools
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-[#171c25]">{candidates.length}</span> active {candidates.length === 1 ? "candidate" : "candidates"} across{" "}
                      <span className="font-semibold text-[#171c25]">{requisitionsCount}</span> {requisitionsCount === 1 ? "requisition" : "requisitions"} and verified talent pools
                    </>
                  )}
                </p>
              </div>

              {/* Live Agent Diagnostic Bar */}
              <div className="flex items-center gap-3 bg-[#f0f3ff] px-4 py-2 rounded-xl border border-[#dee2ef]/50 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6137e0] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6137e0]"></span>
                  </span>
                  <span className="text-xs font-semibold text-[#171c25]">Sourcing Sync: Active</span>
                </div>
                <span className="text-[#c5c6cc] font-mono text-xs">|</span>
                <span className="text-xs text-[#45474c]">
                  {candidates.filter((c) => typeof c.matchScore === "number").length} of {candidates.length} evaluated
                </span>
                <div className="flex items-center -space-x-1.5 ml-1">
                  <div className="w-5 h-5 rounded-full bg-[#6137e0] text-white text-[9px] flex items-center justify-center font-bold">
                    A1
                  </div>
                  <div className="w-5 h-5 rounded-full bg-[#131c29] text-white text-[9px] flex items-center justify-center font-bold">
                    A2
                  </div>
                  <div className="w-5 h-5 rounded-full bg-[#dee2ef] text-[#171c25] text-[9px] flex items-center justify-center font-bold">
                    A3
                  </div>
                </div>
              </div>
            </div>

            {/* Command & Filter Workspace */}
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.02)] border border-[#dee2ef]/70 flex flex-col gap-4">
              {/* Primary Filter Bar: Search + Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input with Keyboard Indicator */}
                <div className="relative min-w-0 w-full flex-[1_1_320px]">
                  <SymbolIcon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#75777c] text-[20px]" style={{ fontSize: "20px" }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-24 rounded-lg bg-[#f0f3ff] text-[#171c25] placeholder:text-[#75777c] text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6137e0]/40 transition-colors border border-transparent focus:border-[#6137e0]/20"
                    placeholder="Search by name, skills, title, previous companies (e.g. Stripe, AWS, Go)..."
                    type="text"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="p-1 rounded hover:bg-[#eaeefb] text-[#75777c] hover:text-[#171c25]"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <kbd className="px-1.5 py-0.5 rounded bg-[#eaeefb] text-[#45474c] font-mono text-[11px] font-medium">
                        ⌘F
                      </kbd>
                    )}
                  </div>
                </div>

                {/* Right Command Actions */}
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                  {/* View Segmented Switch */}
                  <div className="flex items-center bg-[#f0f3ff] p-1 rounded-lg border border-[#dee2ef]/50">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === "table"
                          ? "bg-white text-[#171c25] shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                      type="button"
                    >
                      <SymbolIcon name="view_list" className="text-[16px]" style={{ fontSize: "16px" }} />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white text-[#171c25] shadow-xs"
                          : "text-[#45474c] hover:text-[#171c25]"
                      }`}
                      type="button"
                    >
                      <SymbolIcon name="grid_view" className="text-[16px]" style={{ fontSize: "16px" }} />
                      <span>Grid</span>
                    </button>
                  </div>

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportCSV}
                    className="h-10 px-3 rounded-lg bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] transition-colors flex items-center gap-1.5 text-xs font-semibold border border-[#dee2ef]/50 cursor-pointer"
                    type="button"
                  >
                    <SymbolIcon name="download" className="text-[18px] text-[#75777c]" style={{ fontSize: "18px" }} />
                    <span>Export CSV</span>
                  </button>

                  {/* Add Candidate Primary Button */}
                  <button
                    onClick={() => setIsAddCandidateOpen(true)}
                    className="h-10 px-4 rounded-lg bg-black text-white hover:bg-[#131c29] transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    type="button"
                  >
                    <SymbolIcon name="add" className="text-[18px]" style={{ fontSize: "18px" }} />
                    <span>Add Candidate</span>
                  </button>
                </div>
              </div>

              {/* Granular Filter Ribbon Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#dee2ef]/60">
                <span className="text-[10px] text-[#45474c] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-[#75777c]" />
                  Filters:
                </span>

                {/* Stage Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                        stageFilter !== "All"
                          ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                          : "bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]/60"
                      }`}
                      type="button"
                    >
                      <span className={stageFilter !== "All" ? "text-white/80" : "text-[#45474c]"}>Stage:</span>
                      <span className="font-semibold">{stageFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 bg-white border border-[#dee2ef] shadow-xl rounded-xl p-1 z-50">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Filter by Stage</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                    <DropdownMenuRadioGroup value={stageFilter} onValueChange={setStageFilter}>
                      {availableStages.map((stage) => (
                        <DropdownMenuRadioItem
                          key={stage}
                          value={stage}
                          className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff] focus:bg-[#f0f3ff]"
                        >
                          {stage === "All" ? "All Stages" : stage}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Min Experience Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                        minExpFilter !== "All"
                          ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                          : "bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]/60"
                      }`}
                      type="button"
                    >
                      <span className={minExpFilter !== "All" ? "text-white/80" : "text-[#45474c]"}>Min Experience:</span>
                      <span className="font-semibold">{minExpFilter === "All" ? "Any" : minExpFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-white border border-[#dee2ef] shadow-xl rounded-xl p-1 z-50">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Minimum Experience</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                    <DropdownMenuRadioGroup value={minExpFilter} onValueChange={setMinExpFilter}>
                      {MIN_EXP_OPTIONS.map((opt) => (
                        <DropdownMenuRadioItem
                          key={opt}
                          value={opt}
                          className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff] focus:bg-[#f0f3ff]"
                        >
                          {opt === "All" ? "Any Experience" : opt}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Source Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                        sourceFilter !== "All"
                          ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                          : "bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]/60"
                      }`}
                      type="button"
                    >
                      <span className={sourceFilter !== "All" ? "text-white/80" : "text-[#45474c]"}>Source:</span>
                      <span className="font-semibold">{sourceFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 bg-white border border-[#dee2ef] shadow-xl rounded-xl p-1 z-50">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Filter by Source</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                    <DropdownMenuRadioGroup value={sourceFilter} onValueChange={setSourceFilter}>
                      {availableSources.map((src) => (
                        <DropdownMenuRadioItem
                          key={src}
                          value={src}
                          className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff] focus:bg-[#f0f3ff]"
                        >
                          {src === "All" ? "All Sources" : src}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Owner Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                        ownerFilter !== "All"
                          ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                          : "bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]/60"
                      }`}
                      type="button"
                    >
                      <span className={ownerFilter !== "All" ? "text-white/80" : "text-[#45474c]"}>Owner:</span>
                      <span className="font-semibold">{ownerFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52 bg-white border border-[#dee2ef] shadow-xl rounded-xl p-1 z-50">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Filter by Owner</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                    <DropdownMenuRadioGroup value={ownerFilter} onValueChange={setOwnerFilter}>
                      {availableOwners.map((own) => (
                        <DropdownMenuRadioItem
                          key={own}
                          value={own}
                          className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff] focus:bg-[#f0f3ff]"
                        >
                          {own === "All" ? "All Owners" : own}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Skill Filter Dropdown */}
                {availableSkills.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                          skillFilter !== "All"
                            ? "bg-[#6137e0] text-white border-[#6137e0] shadow-xs"
                            : "bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]/60"
                        }`}
                        type="button"
                      >
                        <span className={skillFilter !== "All" ? "text-white/80" : "text-[#45474c]"}>Skill:</span>
                        <span className="font-semibold">{skillFilter}</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52 max-h-60 overflow-y-auto bg-white border border-[#dee2ef] shadow-xl rounded-xl p-1 z-50">
                      <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Filter by Skill</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                      <DropdownMenuRadioGroup value={skillFilter} onValueChange={setSkillFilter}>
                        {availableSkills.map((sk) => (
                          <DropdownMenuRadioItem
                            key={sk}
                            value={sk}
                            className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff] focus:bg-[#f0f3ff]"
                          >
                            {sk === "All" ? "All Skills" : sk}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Reset Filters Action Button */}
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#f0f3ff] text-[#6137e0] border border-[#6137e0]/30 hover:border-[#6137e0] text-xs font-semibold shadow-2xs transition-all cursor-pointer ml-auto"
                    type="button"
                    title="Clear all active filters"
                  >
                    <RefreshCw className="w-3 h-3 text-[#6137e0]" />
                    <span>Reset filters ({activeFiltersCount})</span>
                  </button>
                )}
              </div>

              {/* Active Filter Chips with Direct Dismiss buttons */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#75777c] font-semibold">Active filters:</span>
                  {stageFilter !== "All" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold">
                      <span>Stage: {stageFilter}</span>
                      <button
                        onClick={() => setStageFilter("All")}
                        className="hover:bg-[#cbbeff] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Remove stage filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {minExpFilter !== "All" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold">
                      <span>Exp: {minExpFilter}</span>
                      <button
                        onClick={() => setMinExpFilter("All")}
                        className="hover:bg-[#cbbeff] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Remove experience filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {sourceFilter !== "All" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold">
                      <span>Source: {sourceFilter}</span>
                      <button
                        onClick={() => setSourceFilter("All")}
                        className="hover:bg-[#cbbeff] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Remove source filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {ownerFilter !== "All" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold">
                      <span>Owner: {ownerFilter}</span>
                      <button
                        onClick={() => setOwnerFilter("All")}
                        className="hover:bg-[#cbbeff] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Remove owner filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {skillFilter !== "All" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold">
                      <span>Skill: {skillFilter}</span>
                      <button
                        onClick={() => setSkillFilter("All")}
                        className="hover:bg-[#cbbeff] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Remove skill filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchQuery.trim().length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eaeefb] text-[#171c25] text-xs font-medium">
                      <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="hover:bg-[#dee2ef] rounded-full p-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                        type="button"
                        title="Clear search query"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Main Candidate Roster Table Card */}
            {viewMode === "table" ? (
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.02)] border border-[#dee2ef]/70 overflow-hidden flex flex-col">
                {/* Table Scroll Container */}
                <div
                  role="region"
                  aria-label="Candidate profiles"
                  tabIndex={0}
                  className="max-h-[min(60dvh,36rem)] overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-[#6137e0] focus-visible:-outline-offset-2"
                >
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-[#f0f3ff]">
                      <tr className="bg-[#f0f3ff] text-[#45474c] text-[11px] font-bold uppercase tracking-wider border-b border-[#dee2ef]">
                        <th className="py-3 px-4 w-12 text-center">
                          <input
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded text-[#6137e0] accent-[#6137e0] cursor-pointer"
                            type="checkbox"
                          />
                        </th>
                        <th className="py-3 px-4">Candidate &amp; Current Title</th>
                        <th className="py-3 px-4">Target Job &amp; Agent Match</th>
                        <th className="py-3 px-4">Stage</th>
                        <th className="py-3 px-4">Top Validated Skills</th>
                        <th className="py-3 px-4">Experience &amp; Location</th>
                        <th className="py-3 px-4">Sourced Via</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaeefb] text-xs">
                      {filteredCandidates.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-[#75777c]">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Users className="w-8 h-8 text-[#9ea3ae]" />
                              <p className="font-semibold text-sm text-[#171c25]">
                                {candidates.length === 0 ? "No candidates found" : "No candidates match the current filters"}
                              </p>
                              <p className="text-xs text-[#75777c]">
                                {candidates.length === 0
                                  ? "Upload resumes in the Ingestion Pipeline to add candidates to your directory."
                                  : "Try adjusting or resetting your search and filter criteria."}
                              </p>
                              {candidates.length > 0 ? (
                                <button
                                  onClick={handleResetFilters}
                                  className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#6137e0] text-white text-xs font-semibold hover:bg-[#7a55fa] transition-colors cursor-pointer"
                                  type="button"
                                >
                                  Reset Filters
                                </button>
                              ) : (
                                <Link
                                  href="/upload"
                                  className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#6137e0] text-white text-xs font-semibold hover:bg-[#7a55fa] transition-colors"
                                >
                                  Upload Resumes
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredCandidates.map((cand) => {
                          const isChecked = Boolean(selectedIds[cand.id]);

                          return (
                            <tr
                              key={cand.id}
                              className={`transition-colors group ${
                                isChecked
                                  ? "bg-[#e7deff]/20 hover:bg-[#e7deff]/30"
                                  : "hover:bg-[#f0f3ff]"
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-4 px-4 text-center">
                                <input
                                  checked={isChecked}
                                  onChange={() => toggleSelectCandidate(cand.id)}
                                  className="w-4 h-4 rounded text-[#6137e0] accent-[#6137e0] cursor-pointer"
                                  type="checkbox"
                                />
                              </td>

                              {/* Candidate & Current Title */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3 min-w-[240px]">
                                  <div className="relative shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-[#f4f3ff] text-[#6137e0] flex items-center justify-center ring-1 ring-[#dee2ef]">
                                      <User className="w-5 h-5 text-[#6137e0]" />
                                    </div>
                                    {cand.isStarred && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#6137e0] flex items-center justify-center text-white text-[8px] font-bold">
                                        ★
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <Link
                                        href={`/candidates/${cand.id}`}
                                        className="font-bold text-[#171c25] hover:text-[#6137e0] hover:underline truncate text-sm transition-colors"
                                      >
                                        {cand.name}
                                      </Link>
                                      {cand.companyTag && (
                                        <span className="px-1.5 py-0.2 rounded bg-[#dee2ef] text-[#45474c] text-[10px] font-semibold">
                                          {cand.companyTag}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-[#45474c] truncate">{cand.title}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Target Job & Agent Match */}
                              <td className="py-4 px-4">
                                <div className="flex flex-col gap-1 min-w-[200px]">
                                  <span className="text-xs text-[#171c25] font-semibold truncate">
                                    {cand.targetJob}
                                  </span>

                                  {cand.isProcessing ? (
                                    <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold w-fit">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                      <span>Resume Parsing in Progress</span>
                                    </div>
                                  ) : cand.multiApplications ? (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#e4e8f5] text-[#45474c] text-[10px] font-bold w-fit">
                                        <SymbolIcon name="layers" className="text-[13px] text-[#6137e0]" style={{ fontSize: "13px" }} />
                                        <span>2 Active Applications</span>
                                      </div>
                                      <div className="text-[11px] text-[#171c25] flex items-center justify-between">
                                        <span>Sr Platform Eng:</span>
                                        <span className="font-mono text-[#45474c]">78/100</span>
                                      </div>
                                      <div className="text-[11px] text-[#171c25] flex items-center justify-between font-semibold">
                                        <span>Site Reliability Lead:</span>
                                        <span className="font-mono text-[#6137e0]">91/100</span>
                                      </div>
                                    </div>
                                  ) : cand.matchScore ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="inline-flex items-center gap-1 bg-[#e7deff] text-[#1e0060] text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        <SymbolIcon name="auto_awesome" className="text-[13px] text-[#6137e0]" style={{ fontSize: "13px" }} />
                                        <span>Job Match: {cand.matchScore}/100</span>
                                      </div>
                                      <span className="font-mono text-[10px] text-[#75777c]">
                                        {cand.matchScoreLabel}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="font-mono text-[11px] text-[#75777c] flex items-center gap-1">
                                      <SymbolIcon name="help_outline" className="text-[13px]" style={{ fontSize: "13px" }} />
                                      <span>Select a job to view match</span>
                                      <a href="#" className="text-[#6137e0] hover:underline font-semibold ml-1">
                                        Assign
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Stage */}
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dee2ef] text-[#171c25] text-xs font-semibold">
                                  <span className={`w-1.5 h-1.5 rounded-full ${cand.stageColor}`}></span>
                                  <span>{cand.stage}</span>
                                </span>
                              </td>

                              {/* Top Validated Skills */}
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {cand.skills.map((skill) => (
                                    <span
                                      key={skill}
                                      onClick={() => setSkillFilter(skill)}
                                      className="px-2 py-0.5 rounded bg-[#eaeefb] hover:bg-[#dee2ef] text-[#171c25] font-mono text-[11px] font-medium cursor-pointer transition-colors"
                                      title={`Filter by skill: ${skill}`}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {cand.extractingSkillsCount && (
                                    <span className="px-2 py-0.5 rounded bg-[#e4e8f5] text-[#75777c] font-mono text-[11px] italic">
                                      Extracting ({cand.extractingSkillsCount})...
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Experience & Location */}
                              <td className="py-4 px-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[#171c25] text-xs">
                                    {cand.experienceYears} yrs total
                                  </span>
                                  <span className="text-xs text-[#45474c] flex items-center gap-1">
                                    <SymbolIcon name="location_on" className="text-[14px] text-[#75777c]" style={{ fontSize: "14px" }} />
                                    <span>
                                      {cand.location} ({cand.locationType})
                                    </span>
                                  </span>
                                </div>
                              </td>

                              {/* Sourced Via */}
                              <td className="py-4 px-4">
                                <div className="flex flex-col">
                                  <span className="text-xs text-[#171c25] font-semibold">{cand.source}</span>
                                  <span className="font-mono text-[10px] text-[#6137e0] font-medium truncate max-w-[140px]">
                                    {cand.sourceDetail}
                                  </span>
                                </div>
                              </td>

                              {/* Owner */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5">
                                  {cand.ownerAvatar ? (
                                    <Image
                                      alt={cand.owner}
                                      className="w-6 h-6 rounded-full object-cover"
                                      src={cand.ownerAvatar}
                                      width={24}
                                      height={24}
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-[9px]">
                                      {cand.owner
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                  <span className="text-xs text-[#171c25] font-medium truncate">{cand.owner}</span>
                                </div>
                              </td>

                              {/* Quick Action Button */}
                              <td className="py-4 px-4 text-right">
                                {cand.actionType === "Review Evidence" ? (
                                  <Link
                                    href={`/candidates/${cand.id}`}
                                    className="px-3 py-1.5 rounded-lg bg-[#6137e0] text-white hover:bg-[#7a55fa] transition-colors text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <SymbolIcon name="fact_check" className="text-[16px]" style={{ fontSize: "16px" }} />
                                    <span>Review Evidence</span>
                                  </Link>
                                ) : cand.actionType === "View Scorecard" ? (
                                  <button
                                    onClick={() => handleQuickAction(cand)}
                                    className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                    type="button"
                                  >
                                    <SymbolIcon name="query_stats" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                                    <span>View Scorecard</span>
                                  </button>
                                ) : cand.actionType === "View Status" ? (
                                  <button
                                    onClick={() => handleQuickAction(cand)}
                                    className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                    type="button"
                                  >
                                    <SymbolIcon name="schedule" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                                    <span>View Status</span>
                                  </button>
                                ) : cand.actionType === "Select App" ? (
                                  <button
                                    onClick={() => handleQuickAction(cand)}
                                    className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                    type="button"
                                  >
                                    <SymbolIcon name="call_split" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                                    <span>Select App</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleQuickAction(cand)}
                                    className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                    type="button"
                                  >
                                    <SymbolIcon name="add_link" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                                    <span>Match to Job</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Sticky Footer: Bulk Selection Context & Micro Pagination Controls */}
                <div className="p-4 bg-[#f0f3ff] flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[#dee2ef]">
                  {/* Selection & Bulk Operation Dock */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                      <span className="text-xs font-bold text-[#171c25]">
                        {selectedCount} of {filteredCandidates.length} selected
                      </span>
                    </div>
                    <span className="text-[#c5c6cc] font-mono text-xs">·</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" disabled title="Owner assignment is not supported by the connected backend." className="px-3 py-1 rounded-md text-xs text-zinc-500 border opacity-60 cursor-not-allowed">
                        Assign Owner (unavailable)
                      </button>
                      {/* Bulk Move Stage Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={selectedCount === 0 || isMovingStage}
                            className={`px-3 py-1 rounded-md text-xs font-semibold shadow-xs border transition-colors cursor-pointer flex items-center gap-1 ${
                              selectedCount > 0
                                ? "bg-white hover:bg-[#eaeefb] text-[#171c25] border-[#dee2ef]"
                                : "bg-white/50 text-[#75777c] border-[#dee2ef]/40 cursor-not-allowed opacity-60"
                            }`}
                            type="button"
                          >
                            <span>Move Stage</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 bg-white border border-[#dee2ef] shadow-lg rounded-xl p-1 z-50">
                          <DropdownMenuLabel className="text-[11px] font-semibold text-[#75777c] px-2 py-1">Move to Stage</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-[#dee2ef]/60 my-1" />
                          {["Screening", "Recruiter Review", "Interview", "Offer", "Hired", "Rejected"].map((stage) => (
                            <DropdownMenuItem
                              key={stage}
                              onClick={() => handleBulkMoveStage(stage)}
                              disabled={isMovingStage}
                              className="text-xs py-1.5 px-2 rounded-lg cursor-pointer hover:bg-[#f0f3ff]"
                            >
                              {stage}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button type="button" disabled title="Bulk email is not supported by the connected backend." className="px-3 py-1 rounded-md text-xs text-zinc-500 border opacity-60 cursor-not-allowed">
                        Send Email (unavailable)
                      </button>

                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold shadow-xs border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Pagination Numbers & Status */}
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#45474c]">
                      Showing {filteredCandidates.length > 0 ? 1 : 0}-{filteredCandidates.length} of {candidates.length} candidates
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-8 h-8 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center shadow-xs cursor-pointer"
                        type="button"
                      >
                        1
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View Mode */
              filteredCandidates.length === 0 ? (
                <div className="py-12 text-center text-[#75777c] bg-white rounded-xl border border-[#dee2ef]/70">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-[#9ea3ae]" />
                    <p className="font-semibold text-sm text-[#171c25]">
                      {candidates.length === 0 ? "No candidates found" : "No candidates match the current filters"}
                    </p>
                    <p className="text-xs text-[#75777c]">
                      {candidates.length === 0
                        ? "Upload resumes in the Ingestion Pipeline to add candidates to your directory."
                        : "Try adjusting or resetting your search and filter criteria."}
                    </p>
                    {candidates.length > 0 ? (
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#6137e0] text-white text-xs font-semibold hover:bg-[#7a55fa] transition-colors cursor-pointer"
                        type="button"
                      >
                        Reset Filters
                      </button>
                    ) : (
                      <Link
                        href="/upload"
                        className="mt-2 px-3.5 py-1.5 rounded-lg bg-[#6137e0] text-white text-xs font-semibold hover:bg-[#7a55fa] transition-colors"
                      >
                        Upload Resumes
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  role="region"
                  aria-label="Candidate profiles"
                  tabIndex={0}
                  className="grid max-h-[min(60dvh,36rem)] grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto overscroll-contain rounded-xl focus-visible:outline-2 focus-visible:outline-[#6137e0] focus-visible:-outline-offset-2"
                >
                  {filteredCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#f4f3ff] text-[#6137e0] flex items-center justify-center ring-1 ring-[#dee2ef]">
                              <User className="w-6 h-6 text-[#6137e0]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/candidates/${cand.id}`}
                                  className="font-bold text-sm text-[#171c25] hover:text-[#6137e0] hover:underline transition-colors"
                                >
                                  {cand.name}
                                </Link>
                                {cand.companyTag && (
                                  <span className="px-1.5 py-0.2 rounded bg-[#dee2ef] text-[#45474c] text-[10px] font-semibold">
                                    {cand.companyTag}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#45474c]">{cand.title}</p>
                            </div>
                          </div>

                          {cand.matchScore && (
                            <div className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-mono text-[11px] font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-[#6137e0]" />
                              <span>{cand.matchScore}/100</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-3 text-xs text-[#75777c]">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {cand.location}
                          </span>
                          <span>·</span>
                          <span>{cand.experienceYears}y exp</span>
                          <span>·</span>
                          <span className="font-semibold text-[#171c25]">{cand.stage}</span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-3">
                          {cand.skills.map((s) => (
                            <span
                              key={s}
                              onClick={() => setSkillFilter(s)}
                              className="px-2 py-0.5 rounded bg-[#f0f3ff] hover:bg-[#dee2ef] text-[#45474c] font-mono text-[10px] cursor-pointer transition-colors"
                              title={`Filter by ${s}`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#dee2ef]/60 flex items-center justify-between">
                        <span className="text-[11px] text-[#75777c]">Owner: {cand.owner}</span>
                        <button
                          onClick={() => handleQuickAction(cand)}
                          className="px-3 py-1.5 rounded-lg bg-[#6137e0] text-white text-xs font-semibold hover:bg-[#7a55fa] transition-colors cursor-pointer"
                        >
                          {cand.actionType}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Pagination Controls Bar */}
            {totalCandidates > 0 && (
              <div className="bg-white rounded-xl border border-[#dee2ef] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#45474c] shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    Showing{" "}
                    <strong className="text-[#171c25]">
                      {(currentPage - 1) * pageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-[#171c25]">
                      {Math.min(currentPage * pageSize, totalCandidates)}
                    </strong>{" "}
                    of <strong className="text-[#171c25]">{totalCandidates}</strong> candidate records
                  </span>
                  {totalCandidates > 500 && (
                    <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                      Server Paginated Beyond 500
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const newSize = Number(e.target.value);
                        setPageSize(newSize);
                        setCurrentPage(1);
                      }}
                      className="border border-[#dee2ef] rounded-lg px-2 py-1 bg-white text-xs text-[#171c25] focus:outline-none"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || loading}
                      className="px-3 py-1.5 rounded-lg border border-[#dee2ef] bg-white text-[#171c25] font-semibold hover:bg-[#f0f3ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="font-semibold text-[#171c25]">
                      Page {currentPage} of {Math.max(1, Math.ceil(totalCandidates / pageSize))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={(!hasMore && currentPage >= Math.ceil(totalCandidates / pageSize)) || loading}
                      className="px-3 py-1.5 rounded-lg border border-[#dee2ef] bg-white text-[#171c25] font-semibold hover:bg-[#f0f3ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <CoreFooter />

      <AddCandidateModal open={isAddCandidateOpen} onOpenChange={setIsAddCandidateOpen} />
    </>
  );
}
