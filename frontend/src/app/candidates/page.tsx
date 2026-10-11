"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CandidateReviewModal } from "@/components/dashboard/candidate-review-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchCandidates,
  fetchJobs,
  addJobCandidate,
  getErrorMessage,
} from "@/lib/api";
import { CandidateDetail, JobRequisition } from "@/types/ats";
import {
  Search,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Plus,
  Table as TableIcon,
  LayoutGrid,
  MapPin,
  Check,
  X,
  Star,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Bolt,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
  ArrowRight,
} from "lucide-react";

interface CandidateRosterItem {
  id: string;
  name: string;
  title: string;
  companyTag?: string;
  avatar?: string;
  isStarred?: boolean;
  targetJob: string;
  matchScore?: number | null;
  matchScoreLabel?: string;
  isProcessing?: boolean;
  applicationsCount?: number;
  multiApplications?: Array<{ title: string; score: number }>;
  stage: "Applied" | "Interview (Stage 2)" | "Screening" | "Talent Pool" | "Offer" | "Hired";
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

const DEFAULT_CANDIDATE_ROSTER: CandidateRosterItem[] = [
  {
    id: "cand-mv",
    name: "Marcus Vance",
    title: "Staff Platform Engineer · Cloud Infras",
    companyTag: "ex-Stripe",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAJY8ncbeAejDR02cAONL3NeR949_XihWoAXq5lghpXYgj8DfytUD0JvS9k-GubYcOSwCTdWD6jn5Y97gAgPyD9iU1q0IJK0ZPA3eLozxUHlXTr_8As4EkVRh8JnS1DJNFe8bMucr7X3CepVx1hlF0oCpDYvmpXpkoQBT9jFasVF1xavchVtOR0CM8L7-qK_XNfxq3NV79-gFWdJBtbKRql5VNrPE4cFdpNg3z9eWTlzsPf5XWEU0xA5w",
    isStarred: true,
    targetJob: "Senior Platform Engineer",
    matchScore: 94,
    matchScoreLabel: "(Rubric verified)",
    stage: "Applied",
    stageColor: "bg-[#497cff]",
    skills: ["Kubernetes", "Golang", "Kafka", "Terraform"],
    experienceYears: 11,
    location: "London, UK",
    locationType: "Hybrid",
    source: "Internal Referral",
    sourceDetail: "by Alex Chen (VP Eng)",
    owner: "Elena Varga",
    ownerAvatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAb-xhC8Gt5a03IKeWoDmDYIb7OA7BFzq9MsVFM-rwt-YyHrVDJuLTTjQMMaNeKBbZMIHcWMSdXGW10tTDx5ZoEOpjrAMNKkwLFKzPxljc_M-xlr0M99deH89FjCESOhATVNQm1yejVm0SIVwzM5g5adk49UfUM46utSaH31Gn5G5kma9PN7GGOCPqOOJ-w4nct86OTEFn2AEOjFwU9p92xWtXzzqpF_a6NmoRqV7rmUek9kATdvAw3vA",
    actionType: "Review Evidence",
  },
  {
    id: "cand-ps",
    name: "Priya Sharma",
    title: "Product Design Lead · Design Systems",
    companyTag: "ex-Figma",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDD8o0ORRU-Xkfh4w7f3aY1eu6FePUSUbRZj63sEeYY453GEJHKUU5JOjZoD4A4fs1XXLkVVXuMQgx5r1Pl492mqa-8WxaGuG18Bs1QNYAAOYHf9cleNeUZolCFDS5eoYa-A1ixr9r9SSEKm6zt1oTDQpvHdtzSXuLIZkhvIuVHnGcR9stS_UpDlQsCVG939dkF6CUyZes8wnSU4u_c06nbc7IZzS_q4afrqmyXsatF8XzMX6avOsFXKA",
    targetJob: "Lead Product Designer",
    matchScore: 89,
    matchScoreLabel: "(Portfolio scored)",
    stage: "Interview (Stage 2)",
    stageColor: "bg-[#6137e0]",
    skills: ["Design Systems", "Figma", "User Research"],
    experienceYears: 8,
    location: "Berlin, Germany",
    locationType: "On-site",
    source: "Inbound Application",
    sourceDetail: "Careers Portal · direct",
    owner: "Tomas Novak",
    actionType: "View Scorecard",
  },
  {
    id: "cand-sl",
    name: "Sarah Lin",
    title: "Cloud Infrastructure Specialist",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDiQWLB8KWJKmsEPUGg5gXiEs1Id7UZfD5C0Cml7SP61XViN79AFwMsO5YlyyXa3rlQB4bZnYzFPXwAj1FoCQbJ_SPxPk-HpMrKXDKG94XBZpJnvpjtQeUqCRSyZw3H2bU4TYQ8a5kwXvPGdshO0ob5diWzIJtjFodksZTG_MKoOBjNvtoMBGnuFp6ZG10_Hj5JrIL3Jh2b_A2WVjMb59yu_3725Zzn7Z1XzegZkfEjb9gS5MLaYgDFng",
    targetJob: "Senior Platform Engineer",
    isProcessing: true,
    stage: "Applied",
    stageColor: "bg-[#497cff]",
    skills: ["AWS", "Docker"],
    extractingSkillsCount: 3,
    experienceYears: 6,
    location: "Toronto, CA",
    locationType: "Remote",
    source: "LinkedIn Import",
    sourceDetail: "Agent Scraping Run #44",
    owner: "Elena Varga",
    ownerAvatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAb-xhC8Gt5a03IKeWoDmDYIb7OA7BFzq9MsVFM-rwt-YyHrVDJuLTTjQMMaNeKBbZMIHcWMSdXGW10tTDx5ZoEOpjrAMNKkwLFKzPxljc_M-xlr0M99deH89FjCESOhATVNQm1yejVm0SIVwzM5g5adk49UfUM46utSaH31Gn5G5kma9PN7GGOCPqOOJ-w4nct86OTEFn2AEOjFwU9p92xWtXzzqpF_a6NmoRqV7rmUek9kATdvAw3vA",
    actionType: "View Status",
  },
  {
    id: "cand-mc",
    name: "Michael Chang",
    title: "Full Stack / Systems Engineer",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDWtxPa2N9AlgQG8DN_bb_XhTXUeENW5_2pY3X2872a1l_pVhX_4qQsqRHfejLnqe2E8ScFRvJUKgs9BM8Ccu54FOPH_9WT92plKYNhttTyYYMvZysOONqSn-59o8aAfm223kUuYbgg5qsSlNgYI6w_CKjloS4Dl2iZ9tNaRX9lRaT6Ftgc0SCE7kl_dUfHDSsmGzm5-0EU-930HXsECjSnD4fHCzf9OZPCjY7EyVVmnG_wYkwC2YoaIg",
    targetJob: "Multiple",
    applicationsCount: 2,
    multiApplications: [
      { title: "Sr Platform Eng", score: 78 },
      { title: "Site Reliability Lead", score: 91 },
    ],
    stage: "Screening",
    stageColor: "bg-amber-500",
    skills: ["Python", "TypeScript", "GCP", "Kubernetes"],
    experienceYears: 7,
    location: "New York, USA",
    locationType: "Hybrid",
    source: "Agency Submission",
    sourceDetail: "Riviera Partners",
    owner: "Elena Varga",
    ownerAvatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAb-xhC8Gt5a03IKeWoDmDYIb7OA7BFzq9MsVFM-rwt-YyHrVDJuLTTjQMMaNeKBbZMIHcWMSdXGW10tTDx5ZoEOpjrAMNKkwLFKzPxljc_M-xlr0M99deH89FjCESOhATVNQm1yejVm0SIVwzM5g5adk49UfUM46utSaH31Gn5G5kma9PN7GGOCPqOOJ-w4nct86OTEFn2AEOjFwU9p92xWtXzzqpF_a6NmoRqV7rmUek9kATdvAw3vA",
    actionType: "Select App",
  },
  {
    id: "cand-cd",
    name: "Claire Dubois",
    title: "Security & Compliance Analyst",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBvuzGK93puGmy3B5N4RxjWjC9fTKROn9Ac0zrzqej5RLHJQzpD1Csv6qdzhlkl6O-B7sSi1XIL1uHViZJ4lugGdjgqimlqLYaA4KQ6C0bKPlI2sxy6cpLyXfoDMLdp_s3T5bs5jQZV1D7nhpThILA-xgYvpjIhXzAdd6liQYDeTnVBXBztti_rk69I21fhmI8tCWnhMVJkWtvPfm5COKVn9cvpyyz-dVVUXzYY1SxwKbjDvWMk5FfxpA",
    targetJob: "None selected",
    stage: "Talent Pool",
    stageColor: "bg-[#75777c]",
    skills: ["SOC2", "ISO27001", "Vendor Risk"],
    experienceYears: 5,
    location: "Paris, France",
    locationType: "Hybrid",
    source: "Direct Sourced",
    sourceDetail: "Autonomous Scout #12",
    owner: "Tomas Novak",
    actionType: "Match to Job",
  },
];

export default function CandidateDirectoryPage() {
  const [candidates, setCandidates] = useState<CandidateRosterItem[]>(DEFAULT_CANDIDATE_ROSTER);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({ "cand-mv": true });
  const [searchQuery, setSearchQuery] = useState("Senior Platform");
  const [targetJobLens, setTargetJobLens] = useState("Senior Platform Engineer");
  const [savedView, setSavedView] = useState("Urgent Reviews (12)");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Filters
  const [stageFilter, setStageFilter] = useState("All");
  const [skillsFilterActive, setSkillsFilterActive] = useState(true);
  const [minExpFilter, setMinExpFilter] = useState("5+ yrs");
  const [sourceFilter, setSourceFilter] = useState("Referral & Sourced");
  const [ownerFilter, setOwnerFilter] = useState("Elena Varga");

  // Modals
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<{
    name: string;
    role: string;
    req: string;
  }>({
    name: "Marcus Vance",
    role: "Senior Platform Engineer",
    req: "Req-204",
  });

  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [newCandName, setNewCandName] = useState("");
  const [newCandTitle, setNewCandTitle] = useState("");
  const [newCandSkills, setNewCandSkills] = useState("");
  const [newCandExp, setNewCandExp] = useState(6);
  const [newCandLocation, setNewCandLocation] = useState("London, UK");

  // Toast / Activity state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTime, setSyncTime] = useState("Just now");
  const [recentSyncItems, setRecentSyncItems] = useState([
    { title: "Enriched GitHub for 18 applicants", time: "4m ago", icon: "bolt", color: "text-[#6137e0]" },
    { title: "Sent auto-confirmation to 7 new leads", time: "21m ago", icon: "mail", color: "text-[#497cff]" },
    { title: "Synced 34 profiles from Ashby import", time: "1h ago", icon: "sync", color: "text-[#75777c]" },
  ]);

  // Load live candidates from backend
  useEffect(() => {
    let cancelled = false;
    fetchCandidates()
      .then((live) => {
        if (!cancelled && live && live.length > 0) {
          const mapped: CandidateRosterItem[] = live.map((c) => ({
            id: c.id,
            name: c.name || "Candidate",
            title: c.target_headline || c.role || "Software Engineer",
            avatar: c.avatar || undefined,
            targetJob: c.applied_for_job || "Senior Platform Engineer",
            matchScore: c.scorecard?.overall_match_score ?? 84,
            matchScoreLabel: "(Rubric evaluated)",
            stage: "Applied",
            stageColor: "bg-[#497cff]",
            skills: c.core_skills && c.core_skills.length > 0 ? c.core_skills.slice(0, 4) : ["Python", "AWS"],
            experienceYears: Math.round(c.years_of_experience || 5),
            location: c.location || "London, UK",
            locationType: "Hybrid",
            source: "Platform Ingest",
            sourceDetail: "Direct upload",
            owner: "Elena Varga",
            actionType: "Review Evidence",
          }));

          // Merge without overriding Marcus Vance
          setCandidates((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = mapped.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newOnes];
          });
        }
      })
      .catch((err) => {
        console.warn("Using offline candidate directory snapshot:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allSelected =
    candidates.length > 0 && candidates.every((c) => selectedIds[c.id]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({});
    } else {
      const all: Record<string, boolean> = {};
      candidates.forEach((c) => {
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

  // Instant sync trigger
  const handleTriggerInstantSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncTime("Just now");
      setRecentSyncItems((prev) => [
        {
          title: "Scraped & verified 12 new GitHub profiles",
          time: "Just now",
          icon: "bolt",
          color: "text-[#6137e0]",
        },
        ...prev.slice(0, 2),
      ]);
      showToast("✓ Instant sync completed: 12 new enriched profiles ingested!");
    }, 1200);
  };

  // Quick Action Handler
  const handleQuickAction = (cand: CandidateRosterItem) => {
    if (cand.actionType === "Review Evidence") {
      setReviewCandidate({
        name: cand.name,
        role: cand.targetJob || "Senior Platform Engineer",
        req: "Req-204",
      });
      setIsReviewModalOpen(true);
    } else if (cand.actionType === "View Scorecard") {
      showToast(`Scorecard: ${cand.name} scored ${cand.matchScore}/100 across 4 rubric dimensions`);
    } else if (cand.actionType === "View Status") {
      showToast(`Extraction status for ${cand.name}: Resume Parsing in Progress (84% complete)`);
    } else if (cand.actionType === "Select App") {
      showToast(`Active applications for ${cand.name}: Sr Platform Eng (78/100), SRE Lead (91/100)`);
    } else {
      showToast(`Matching ${cand.name} to Target Job: Senior Platform Engineer...`);
    }
  };

  // Add Candidate Handler
  const handleAddCandidate = () => {
    if (!newCandName.trim()) return;
    const newCand: CandidateRosterItem = {
      id: `cand-${Date.now()}`,
      name: newCandName,
      title: newCandTitle || "Senior Software Engineer",
      targetJob: targetJobLens,
      matchScore: 88,
      matchScoreLabel: "(Rubric evaluated)",
      stage: "Applied",
      stageColor: "bg-[#497cff]",
      skills: newCandSkills
        ? newCandSkills.split(",").map((s) => s.trim())
        : ["TypeScript", "Distributed Systems"],
      experienceYears: Number(newCandExp) || 5,
      location: newCandLocation,
      locationType: "Hybrid",
      source: "Manual Ingestion",
      sourceDetail: "Added by Recruiter",
      owner: "Elena Varga",
      actionType: "Review Evidence",
    };
    setCandidates((prev) => [newCand, ...prev]);
    setIsAddCandidateOpen(false);
    setNewCandName("");
    setNewCandTitle("");
    setNewCandSkills("");
    showToast(`✓ Candidate ${newCand.name} added to roster!`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = "Name,Title,Target Job,Stage,Skills,Experience,Location,Owner\n";
    const rows = candidates
      .map(
        (c) =>
          `"${c.name}","${c.title}","${c.targetJob}","${c.stage}","${c.skills.join("; ")}",${c.experienceYears}y,"${c.location}","${c.owner}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates-roster.csv";
    a.click();
    showToast("✓ Exported candidates roster to CSV");
  };

  // Filtered list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesSkills = c.skills.some((s) => s.toLowerCase().includes(q));
        const matchesCompany = c.companyTag?.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesSkills && !matchesCompany) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, searchQuery]);

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f9f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full gap-6">
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

            {/* Header Area: Title & Autonomous Pipeline State */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#45474c] font-medium mb-1">
                  <span>HALDEN TALENT ORCHESTRATION</span>
                  <span className="text-[#75777c]">/</span>
                  <span className="text-[#6137e0] font-semibold">AI-ASSISTED CANDIDATE MATCHING</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#171c25] tracking-tight">
                  Candidate Directory
                </h1>
                <p className="text-xs sm:text-sm text-[#45474c] mt-0.5">
                  412 active candidates across 14 requisitions and verified talent pools
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
                <span className="text-xs text-[#45474c]">149 profiles evaluated overnight</span>
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
              {/* Primary Filter Bar: Search + Target Role Context Pill + Action CTA */}
              <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                {/* Search Input with Keyboard Indicator */}
                <div className="relative flex-1 min-w-[280px]">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#75777c] text-[20px]">
                    search
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-24 rounded-lg bg-[#f0f3ff] text-[#171c25] placeholder:text-[#75777c] text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#6137e0]/40 transition-colors border border-transparent focus:border-[#6137e0]/20"
                    placeholder="Search by name, skills, title, previous companies (e.g. Stripe, AWS, Go)..."
                    type="text"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-[#eaeefb] text-[#45474c] font-mono text-[11px] font-medium">
                      ⌘F
                    </kbd>
                  </div>
                </div>

                {/* Target Job Lens Selector Pill (Crucial: Drives score calculations) */}
                <div className="flex items-center gap-2 shrink-0 bg-[#131c29] text-white px-3.5 py-1.5 rounded-full shadow-xs">
                  <span className="material-symbols-outlined text-[16px] text-[#497cff]">tune</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#c5c6cc]">
                    Match Lens
                  </span>
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      className="text-xs text-white font-semibold flex items-center gap-1 hover:text-[#dae3f6] transition-colors cursor-pointer"
                    >
                      <span>Target Job: {targetJobLens}</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
                    </button>
                  </div>
                  <span className="bg-[#6137e0] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                    14 Openings
                  </span>
                </div>

                {/* Right Command Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Saved Views Dropdown */}
                  <button
                    className="h-10 px-3 rounded-lg bg-[#f0f3ff] hover:bg-[#eaeefb] transition-colors flex items-center gap-2 text-[#171c25] text-xs font-semibold border border-[#dee2ef]/50 cursor-pointer"
                    type="button"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                    <span>{savedView}</span>
                    <span className="material-symbols-outlined text-[#75777c] text-[18px]">expand_more</span>
                  </button>

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
                      <span className="material-symbols-outlined text-[16px]">view_list</span>
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
                      <span className="material-symbols-outlined text-[16px]">grid_view</span>
                      <span>Grid</span>
                    </button>
                  </div>

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportCSV}
                    className="h-10 px-3 rounded-lg bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] transition-colors flex items-center gap-1.5 text-xs font-semibold border border-[#dee2ef]/50 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#75777c]">download</span>
                    <span>Export CSV</span>
                  </button>

                  {/* Add Candidate Primary Button */}
                  <button
                    onClick={() => setIsAddCandidateOpen(true)}
                    className="h-10 px-4 rounded-lg bg-black text-white hover:bg-[#131c29] transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Add Candidate</span>
                  </button>
                </div>
              </div>

              {/* Granular Filter Ribbon Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#dee2ef]/60">
                <span className="text-[10px] text-[#45474c] uppercase font-bold tracking-wider mr-1">
                  Applied Filters:
                </span>

                {/* Stage Filter */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] text-xs transition-colors cursor-pointer"
                  type="button"
                >
                  <span className="text-[#45474c]">Stage:</span>
                  <span className="font-semibold">All (Screening, Interview, Offer)</span>
                  <span className="material-symbols-outlined text-[14px] text-[#75777c]">expand_more</span>
                </button>

                {/* Active Filter Pill with Dismiss */}
                {skillsFilterActive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-bold">
                    <span className="material-symbols-outlined text-[14px] text-[#6137e0]">verified</span>
                    <span>Skills: Go, Kubernetes (2)</span>
                    <button
                      onClick={() => setSkillsFilterActive(false)}
                      className="hover:bg-[#cbbeff] rounded-full p-0.5 ml-0.5 inline-flex items-center justify-center transition-colors cursor-pointer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </span>
                )}

                {/* Experience Filter */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] text-xs transition-colors cursor-pointer"
                  type="button"
                >
                  <span className="text-[#45474c]">Min Experience:</span>
                  <span className="font-semibold">{minExpFilter}</span>
                  <span className="material-symbols-outlined text-[14px] text-[#75777c]">expand_more</span>
                </button>

                {/* Source Filter */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] text-xs transition-colors cursor-pointer"
                  type="button"
                >
                  <span className="text-[#45474c]">Source:</span>
                  <span className="font-semibold">{sourceFilter}</span>
                  <span className="material-symbols-outlined text-[14px] text-[#75777c]">expand_more</span>
                </button>

                {/* Owner Filter */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#eaeefb] text-[#171c25] text-xs transition-colors cursor-pointer"
                  type="button"
                >
                  <span className="text-[#45474c]">Owner:</span>
                  <span className="font-semibold">{ownerFilter}</span>
                  <span className="material-symbols-outlined text-[14px] text-[#75777c]">expand_more</span>
                </button>

                {/* Clear All Text Button */}
                <button
                  onClick={() => {
                    setSkillsFilterActive(true);
                    setSearchQuery("");
                    showToast("Filters reset to default view");
                  }}
                  className="text-[#6137e0] hover:underline text-xs font-semibold ml-2 transition-colors cursor-pointer"
                  type="button"
                >
                  Reset filters
                </button>
              </div>
            </div>

            {/* Main Candidate Roster Table Card */}
            {viewMode === "table" ? (
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.02)] border border-[#dee2ef]/70 overflow-hidden flex flex-col">
                {/* Table Scroll Container */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
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
                      {filteredCandidates.map((cand) => {
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
                                  {cand.avatar ? (
                                    <img
                                      className="w-10 h-10 rounded-full object-cover ring-1 ring-[#dee2ef]"
                                      alt={cand.name}
                                      src={cand.avatar}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-xs">
                                      {cand.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  {cand.isStarred && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#6137e0] flex items-center justify-center text-white text-[8px] font-bold">
                                      ★
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[#171c25] truncate text-sm">
                                      {cand.name}
                                    </span>
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
                                      <span className="material-symbols-outlined text-[13px] text-[#6137e0]">
                                        layers
                                      </span>
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
                                      <span className="material-symbols-outlined text-[13px] text-[#6137e0]">
                                        auto_awesome
                                      </span>
                                      <span>Job Match: {cand.matchScore}/100</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-[#75777c]">
                                      {cand.matchScoreLabel}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="font-mono text-[11px] text-[#75777c] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px]">help_outline</span>
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
                                    className="px-2 py-0.5 rounded bg-[#eaeefb] text-[#171c25] font-mono text-[11px] font-medium"
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
                                  <span className="material-symbols-outlined text-[14px] text-[#75777c]">
                                    location_on
                                  </span>
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
                                <span className="font-mono text-[10px] text-[#6137e0] font-medium">
                                  {cand.sourceDetail}
                                </span>
                              </div>
                            </td>

                            {/* Owner */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                {cand.ownerAvatar ? (
                                  <img
                                    alt={cand.owner}
                                    className="w-6 h-6 rounded-full object-cover"
                                    src={cand.ownerAvatar}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-[9px]">
                                    TN
                                  </div>
                                )}
                                <span className="text-xs text-[#171c25] font-medium truncate">{cand.owner}</span>
                              </div>
                            </td>

                            {/* Quick Action Button */}
                            <td className="py-4 px-4 text-right">
                              {cand.actionType === "Review Evidence" ? (
                                <button
                                  onClick={() => handleQuickAction(cand)}
                                  className="px-3 py-1.5 rounded-lg bg-[#6137e0] text-white hover:bg-[#7a55fa] transition-colors text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[16px]">fact_check</span>
                                  <span>Review Evidence</span>
                                </button>
                              ) : cand.actionType === "View Scorecard" ? (
                                <button
                                  onClick={() => handleQuickAction(cand)}
                                  className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">
                                    assignment
                                  </span>
                                  <span>View Scorecard</span>
                                </button>
                              ) : cand.actionType === "View Status" ? (
                                <button
                                  onClick={() => handleQuickAction(cand)}
                                  className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">
                                    hourglass_empty
                                  </span>
                                  <span>View Status</span>
                                </button>
                              ) : cand.actionType === "Select App" ? (
                                <button
                                  onClick={() => handleQuickAction(cand)}
                                  className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">
                                    call_split
                                  </span>
                                  <span>Select App</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleQuickAction(cand)}
                                  className="px-3 py-1.5 rounded-lg bg-[#eaeefb] hover:bg-[#dee2ef] transition-colors text-xs text-[#171c25] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#75777c]">
                                    add_link
                                  </span>
                                  <span>Match to Job</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                        {selectedCount} of 412 selected
                      </span>
                    </div>
                    <span className="text-[#c5c6cc] font-mono text-xs">·</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => showToast(`Owner assigned for ${selectedCount} selected candidates`)}
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold shadow-xs border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        Assign Owner
                      </button>
                      <button
                        onClick={() => showToast(`Stage updated for ${selectedCount} selected candidates`)}
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold shadow-xs border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        Move Stage
                      </button>
                      <button
                        onClick={() => showToast(`Email sequence queued for ${selectedCount} candidates`)}
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold shadow-xs border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        Send Email
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
                    <span className="text-xs text-[#45474c]">Showing 1-25 of 412 candidates</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-8 h-8 rounded-lg bg-[#eaeefb] text-[#75777c] flex items-center justify-center cursor-not-allowed"
                        disabled
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center shadow-xs cursor-pointer"
                        type="button"
                      >
                        1
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold flex items-center justify-center border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        2
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold flex items-center justify-center border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        3
                      </button>
                      <span className="px-1 text-[#45474c] font-mono text-xs">...</span>
                      <button
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#eaeefb] text-[#171c25] text-xs font-semibold flex items-center justify-center border border-[#dee2ef] transition-colors cursor-pointer"
                        type="button"
                      >
                        17
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#eaeefb] text-[#171c25] flex items-center justify-center border border-[#dee2ef] shadow-xs transition-colors cursor-pointer"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View Mode */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {cand.avatar ? (
                            <img
                              className="w-12 h-12 rounded-full object-cover ring-1 ring-[#dee2ef]"
                              alt={cand.name}
                              src={cand.avatar}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-sm">
                              {cand.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm text-[#171c25]">{cand.name}</h3>
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
                            className="px-2 py-0.5 rounded bg-[#f0f3ff] text-[#45474c] font-mono text-[10px]"
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
            )}

            {/* Agent Summary Insight Panel (Cockpit Style Architecture) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Dark AI Command Briefing Tile */}
              <div className="bg-[#131c29] text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden border border-black">
                <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-[#6137e0]/20 blur-2xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 bg-[#e7deff]/15 text-[#e7deff] px-2.5 py-1 rounded-full text-xs font-bold">
                      <span className="material-symbols-outlined text-[14px] text-[#cbbeff]">auto_awesome</span>
                      <span>AI-ASSISTED MATCH INSIGHT</span>
                    </div>
                    <span className="font-mono text-xs text-[#7b8495]">08:42 AM</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Evaluation Ready: Marcus Vance
                  </h3>
                  <p className="text-xs sm:text-sm text-[#bec7d9] mt-1.5 leading-relaxed">
                    Candidate matches 3 of 4 core rubric criteria for Senior Platform Engineer. Verified Kubernetes, Go, and eBPF skills with 11y experience. Recruiter review recommended before advancing.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#7b8495]">Job Match:</span>
                    <span className="text-xs text-[#e7deff] font-bold">94/100 (Req-204)</span>
                  </div>
                  <button
                    onClick={() => {
                      setReviewCandidate({
                        name: "Marcus Vance",
                        role: "Senior Platform Engineer",
                        req: "Req-204",
                      });
                      setIsReviewModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#6137e0] text-white hover:bg-[#7a55fa] transition-colors text-xs font-semibold cursor-pointer"
                    type="button"
                  >
                    Review Application
                  </button>
                </div>
              </div>

              {/* Match Distribution Metric Visualization */}
              <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#171c25]">Skill Match Spectrum</h4>
                    <span className="text-xs text-[#45474c] font-semibold">Target: Sr Platform</span>
                  </div>
                  <p className="text-xs text-[#45474c]">
                    412 candidates distributed against required rubric competencies
                  </p>

                  {/* Inline Metric Bars */}
                  <div className="mt-4 flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#171c25] font-medium">High Match (&gt;85%)</span>
                        <span className="text-[#6137e0] font-bold">42 candidates (10.2%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#eaeefb] overflow-hidden">
                        <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "10.2%" }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#171c25] font-medium">Medium Match (65-84%)</span>
                        <span className="text-[#45474c] font-semibold">188 candidates (45.6%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#eaeefb] overflow-hidden">
                        <div className="h-full bg-[#497cff] rounded-full" style={{ width: "45.6%" }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#171c25] font-medium">Low / Review Needed (&lt;65%)</span>
                        <span className="text-[#45474c] font-semibold">182 candidates (44.2%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#eaeefb] overflow-hidden">
                        <div className="h-full bg-[#c5c6cc] rounded-full" style={{ width: "44.2%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-xs text-[#45474c] border-t border-[#dee2ef]/50">
                  <span>Average role ramp rate: 3.2 wks</span>
                  <button
                    onClick={() => showToast("Weights config: Architecture (35%), Coding (35%), System Design (30%)")}
                    className="text-[#6137e0] hover:underline font-semibold cursor-pointer"
                  >
                    Configure weights →
                  </button>
                </div>
              </div>

              {/* Active Inbound / Scout Stream */}
              <div className="bg-white p-6 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-[#171c25]">Autonomous Ingest Activity</h4>
                    <span className="w-2 h-2 rounded-full bg-[#6137e0] animate-pulse"></span>
                  </div>
                  <p className="text-xs text-[#45474c]">Real-time candidate extraction and enrichment feed</p>

                  <div className="mt-3 flex flex-col gap-2.5">
                    {recentSyncItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#f0f3ff] border border-[#dee2ef]/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`material-symbols-outlined ${item.color} text-[18px]`}>
                            {item.icon}
                          </span>
                          <span className="text-xs text-[#171c25] font-medium truncate">{item.title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#75777c] shrink-0">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-xs border-t border-[#dee2ef]/50">
                  <span className="text-[#45474c]">Next automated scrape: 12:00</span>
                  <button
                    onClick={handleTriggerInstantSync}
                    disabled={isSyncing}
                    className="text-[#6137e0] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    type="button"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <span>Trigger instant sync</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CoreFooter />

      {/* Candidate Review Modal */}
      <CandidateReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        candidateName={reviewCandidate.name}
        roleTitle={reviewCandidate.role}
        reqCode={reviewCandidate.req}
      />

      {/* Add Candidate Dialog */}
      <Dialog open={isAddCandidateOpen} onOpenChange={setIsAddCandidateOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 border border-[#dee2ef]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#171c25]">
              Add Candidate to Talent Roster
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div>
              <label className="font-bold text-[#171c25] block mb-1">Full Name</label>
              <Input
                value={newCandName}
                onChange={(e) => setNewCandName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="bg-[#f0f3ff] border-none text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-[#171c25] block mb-1">Current Title & Headline</label>
              <Input
                value={newCandTitle}
                onChange={(e) => setNewCandTitle(e.target.value)}
                placeholder="e.g. Lead SRE · Cloud Infrastructure"
                className="bg-[#f0f3ff] border-none text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-[#171c25] block mb-1">Key Skills (comma separated)</label>
              <Input
                value={newCandSkills}
                onChange={(e) => setNewCandSkills(e.target.value)}
                placeholder="e.g. Go, Kubernetes, Terraform, AWS"
                className="bg-[#f0f3ff] border-none text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#171c25] block mb-1">Years of Exp</label>
                <Input
                  type="number"
                  value={newCandExp}
                  onChange={(e) => setNewCandExp(Number(e.target.value))}
                  className="bg-[#f0f3ff] border-none text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-[#171c25] block mb-1">Location</label>
                <Input
                  value={newCandLocation}
                  onChange={(e) => setNewCandLocation(e.target.value)}
                  className="bg-[#f0f3ff] border-none text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsAddCandidateOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCandidate}
              className="bg-[#6137e0] text-white hover:bg-[#7a55fa] text-xs font-semibold"
            >
              Add Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
