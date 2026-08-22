"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Bell,
  ArrowLeft,
  MapPin,
  ChevronDown,
  Sparkles,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TalentCandidate {
  id: string;
  name: string;
  role: string;
  location: string;
  matchScore: number;
  skills: string[];
  avatar: string;
  experienceYears: number;
  status: "Active" | "Placed";
}

const TALENT_POOL: TalentCandidate[] = [
  {
    id: "cand-001",
    name: "Marcus Chen",
    role: "Senior Software Engineer",
    location: "San Francisco, CA",
    matchScore: 96,
    skills: ["Python", "AWS", "React", "PostgreSQL"],
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80",
    experienceYears: 4,
    status: "Active",
  },
  {
    id: "cand-002",
    name: "Elena Rostova",
    role: "Lead Data Engineer",
    location: "New York, NY",
    matchScore: 91,
    skills: ["Python", "Kubernetes", "Spark", "Docker"],
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80",
    experienceYears: 7,
    status: "Active",
  },
  {
    id: "cand-003",
    name: "David Ross",
    role: "Backend Developer",
    location: "Austin, TX",
    matchScore: 88,
    skills: ["Go", "Kubernetes", "GCP"],
    avatar: "DR",
    experienceYears: 4,
    status: "Active",
  },
  {
    id: "cand-004",
    name: "James Wilson",
    role: "DevOps Specialist",
    location: "Seattle, WA",
    matchScore: 82,
    skills: ["Python", "Ansible", "Terraform"],
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80",
    experienceYears: 5,
    status: "Active",
  },
  {
    id: "cand-005",
    name: "Priya Sharma",
    role: "Staff Backend Engineer",
    location: "San Francisco, CA",
    matchScore: 95,
    skills: ["Python", "FastAPI", "Kubernetes", "PostgreSQL"],
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
    experienceYears: 8,
    status: "Active",
  },
  {
    id: "cand-006",
    name: "Robert Vance",
    role: "VP of Engineering",
    location: "Austin, TX",
    matchScore: 98,
    skills: ["Leadership", "Distributed Systems", "Cloud"],
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&auto=format&fit=crop&q=80",
    experienceYears: 15,
    status: "Placed",
  },
];

export default function CandidatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"Hybrid" | "Semantic" | "Keyword">("Hybrid");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["Python", "Kubernetes"]);
  const [selectedExp, setSelectedExp] = useState<string>("3-5");
  const [selectedStatus, setSelectedStatus] = useState<string[]>(["Active"]);
  const [sortBy, setSortBy] = useState("Relevance");
  const [addedJobs, setAddedJobs] = useState<Record<string, string>>({});

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleStatus = (st: string) => {
    setSelectedStatus((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const clearFilters = () => {
    setSelectedSkills([]);
    setSelectedExp("");
    setSelectedStatus([]);
    setSearchQuery("");
  };

  const filteredCandidates = TALENT_POOL.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      selectedStatus.length === 0 || selectedStatus.includes(c.status);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
            <Link
              href="/jobs"
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/jobs" className="hover:text-zinc-900">
              Jobs
            </Link>
            <span>›</span>
            <span className="text-zinc-900 font-semibold">
              Senior Interface Designer
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

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-[1300px] w-full mx-auto space-y-8">
          {/* Central Search Bar & Mode Selector */}
          <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto pt-2">
            <div className="relative w-full shadow-sm">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by skills, titles, companies..."
                className="w-full h-12 pl-11 pr-4 text-sm bg-white rounded-full border border-zinc-200/80 shadow-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900"
              />
            </div>

            {/* Mode Pills */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 bg-[#f0eee9] p-1 rounded-full text-xs font-semibold">
                {(["Hybrid", "Semantic", "Keyword"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={cn(
                      "px-4 py-1.5 rounded-full transition-all cursor-pointer",
                      searchMode === mode
                        ? "bg-black text-white shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <span className="text-[10px] tracking-wider text-zinc-400 font-bold uppercase">
                DENSE + BM25 + RECIPROCAL RANK FUSION
              </span>
            </div>
          </div>

          {/* Main Layout: Left Filters + Right Results */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
            {/* Left Filter Sidebar */}
            <aside className="lg:col-span-3 space-y-6 bg-white/70 backdrop-blur-xs p-6 rounded-2xl border border-zinc-200/70 h-fit">
              {/* Skills */}
              <div className="space-y-3">
                <span className="text-xs font-bold tracking-wider text-zinc-900 uppercase">
                  SKILLS
                </span>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Python", count: 42 },
                    { label: "Kubernetes", count: 18 },
                    { label: "Go", count: 9 },
                    { label: "Rust", count: 4 },
                  ].map(({ label, count }) => {
                    const isChecked = selectedSkills.includes(label);
                    return (
                      <label
                        key={label}
                        className="flex items-center justify-between cursor-pointer group select-none"
                        onClick={() => toggleSkill(label)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-4 h-4 rounded flex items-center justify-center transition-colors",
                              isChecked
                                ? "bg-black text-white"
                                : "border border-zinc-300 group-hover:border-zinc-400 bg-white"
                            )}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span
                            className={cn(
                              "font-medium",
                              isChecked ? "text-zinc-950" : "text-zinc-600"
                            )}
                          >
                            {label}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">{count}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Experience */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <span className="text-xs font-bold tracking-wider text-zinc-900 uppercase">
                  EXPERIENCE
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {["0–2", "3–5", "6–10", "10+"].map((exp) => (
                    <button
                      key={exp}
                      onClick={() =>
                        setSelectedExp(selectedExp === exp ? "" : exp)
                      }
                      className={cn(
                        "py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer",
                        selectedExp === exp
                          ? "bg-black text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      )}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <span className="text-xs font-bold tracking-wider text-zinc-900 uppercase">
                  STATUS
                </span>
                <div className="space-y-2 text-xs">
                  {["Active", "Placed"].map((st) => {
                    const isChecked = selectedStatus.includes(st);
                    return (
                      <label
                        key={st}
                        className="flex items-center gap-2.5 cursor-pointer group select-none"
                        onClick={() => toggleStatus(st)}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded flex items-center justify-center transition-colors",
                            isChecked
                              ? "bg-black text-white"
                              : "border border-zinc-300 group-hover:border-zinc-400 bg-white"
                          )}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className={cn(
                            "font-medium",
                            isChecked ? "text-zinc-950" : "text-zinc-600"
                          )}
                        >
                          {st}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Clear filters */}
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-zinc-950 font-medium underline underline-offset-4 cursor-pointer pt-2 block"
              >
                Clear filters
              </button>
            </aside>

            {/* Right Candidates Results Grid */}
            <div className="lg:col-span-9 space-y-5">
              {/* Results count & Sort */}
              <div className="flex items-center justify-between text-xs text-zinc-500 font-bold uppercase tracking-wider px-1">
                <span>89 RESULTS · 24MS</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-zinc-700 font-semibold cursor-pointer hover:text-zinc-950">
                      <span>Sort by: {sortBy}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white rounded-xl">
                    {["Relevance", "Highest Match", "Experience", "Newest"].map(
                      (opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => setSortBy(opt)}
                          className="text-xs cursor-pointer"
                        >
                          {opt}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* 2x2 Grid of Candidate Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs hover:border-zinc-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[220px]"
                  >
                    <div>
                      {/* Top: Avatar, Name, Location, Match % */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {cand.avatar.startsWith("http") ? (
                            <img
                              src={cand.avatar}
                              alt={cand.name}
                              className="w-12 h-12 rounded-full object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-sm flex items-center justify-center shrink-0">
                              {cand.avatar}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-sm text-zinc-950">
                              {cand.name}
                            </h3>
                            <p className="text-xs text-zinc-500 font-medium leading-tight">
                              {cand.role}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1">
                              <MapPin className="w-3 h-3 text-zinc-400" />
                              <span>{cand.location}</span>
                            </div>
                          </div>
                        </div>

                        {/* Match Score */}
                        <div className="flex flex-col items-end">
                          <span className="text-xl font-bold tracking-tight text-zinc-950 leading-none">
                            {cand.matchScore}%
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            MATCH
                          </span>
                        </div>
                      </div>

                      {/* Skill Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {cand.skills.map((skill) => (
                          <span
                            key={skill}
                            className="bg-[#f4f3ee] text-zinc-800 text-[11px] font-medium px-2.5 py-0.5 rounded-lg border border-zinc-200/60"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-2.5 mt-5 pt-3 border-t border-zinc-100">
                      <Link
                        href={`/candidates/${cand.id}`}
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-semibold rounded-full h-8.5 border-zinc-200 hover:bg-zinc-50"
                        >
                          View
                        </Button>
                      </Link>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            className="flex-1 bg-black hover:bg-zinc-800 text-white text-xs font-semibold rounded-full h-8.5 gap-1 shadow-none cursor-pointer"
                          >
                            <span>
                              {addedJobs[cand.id]
                                ? addedJobs[cand.id]
                                : "Add to Job"}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white rounded-xl p-1 min-w-[200px]"
                        >
                          {[
                            "Senior Backend Engineer",
                            "Data Platform Architect",
                            "Lead UX Researcher",
                          ].map((job) => (
                            <DropdownMenuItem
                              key={job}
                              onClick={() =>
                                setAddedJobs((prev) => ({
                                  ...prev,
                                  [cand.id]: "Added ✓",
                                }))
                              }
                              className="text-xs cursor-pointer py-2"
                            >
                              {job}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-6 text-xs font-semibold border-zinc-300 hover:bg-zinc-100 text-zinc-700 shadow-none"
                >
                  Load More Results
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
