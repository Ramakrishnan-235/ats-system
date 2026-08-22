"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { Users, Search, Sparkles, ArrowRight, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CANDIDATES_LIST = [
  {
    id: "cand-001",
    name: "Priya Sharma",
    role: "Senior Backend Engineer",
    location: "San Francisco, CA",
    experience: "8 years",
    score: 95,
    match_tier: "Exceptional Match",
    skills: ["Python", "FastAPI", "Kubernetes", "PostgreSQL", "AWS"],
    stage: "Interviewing",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
  },
  {
    id: "cand-002",
    name: "David Chen",
    role: "Product Manager",
    location: "New York, NY",
    experience: "6 years",
    score: 88,
    match_tier: "Strong Match",
    skills: ["Product Strategy", "User Stories", "Roadmapping", "SQL"],
    stage: "Contacted",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
  },
  {
    id: "cand-004",
    name: "Marcus Adebayo",
    role: "Lead UX Researcher",
    location: "London, UK",
    experience: "9 years",
    score: 95,
    match_tier: "Exceptional Match",
    skills: ["User Research", "Figma", "Design Systems", "Usability"],
    stage: "Interview",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
  },
  {
    id: "cand-005",
    name: "Elena Jimenez",
    role: "Data Scientist",
    location: "Austin, TX",
    experience: "5 years",
    score: 84,
    match_tier: "Strong Match",
    skills: ["Python", "PyTorch", "SQL", "Machine Learning"],
    stage: "Interview",
    avatar: "EJ",
  },
  {
    id: "cand-006",
    name: "Robert Vance",
    role: "VP of Engineering",
    location: "Austin, TX",
    experience: "15 years",
    score: 98,
    match_tier: "Exceptional Match",
    skills: ["Leadership", "Distributed Systems", "Cloud Architecture"],
    stage: "Negotiation",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
  },
];

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");

  const filtered = CANDIDATES_LIST.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(search.toLowerCase()) ||
      cand.role.toLowerCase().includes(search.toLowerCase()) ||
      cand.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesStage =
      stageFilter === "ALL" ||
      cand.stage.toLowerCase() === stageFilter.toLowerCase();

    return matchesSearch && matchesStage;
  });

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search candidates..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                  Candidates
                </h1>
                <p className="text-xs text-zinc-500 font-medium">
                  {filtered.length} candidates in evaluation pipeline
                </p>
              </div>
            </div>

            <Link href="/upload">
              <Button variant="pill" className="text-xs px-5 font-semibold">
                Upload New Resumes
              </Button>
            </Link>
          </div>

          {/* Search & Filter */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-3 shadow-xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates by name, role, or skill..."
                className="w-full h-10 pl-10 pr-4 text-xs bg-zinc-50/70 rounded-xl border border-transparent focus:border-zinc-300 focus:bg-white focus:outline-none transition-all placeholder:text-zinc-400"
              />
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-10 px-3 pr-8 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="ALL">All Stages</option>
              <option value="Contacted">Contacted</option>
              <option value="Interview">Interview</option>
              <option value="Negotiation">Negotiation</option>
            </select>
          </div>

          {/* Candidate Card List */}
          <div className="space-y-3">
            {filtered.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs hover:border-zinc-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Profile Details */}
                <div className="flex items-center gap-4">
                  {cand.avatar.startsWith("http") ? (
                    <img
                      src={cand.avatar}
                      alt={cand.name}
                      className="w-12 h-12 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-sm flex items-center justify-center">
                      {cand.avatar}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm text-zinc-950">
                        {cand.name}
                      </h3>
                      <span className="bg-zinc-100 text-zinc-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-zinc-200">
                        {cand.stage}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">
                      {cand.role} • {cand.location} • {cand.experience}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cand.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="bg-zinc-50 text-zinc-600 text-[10px] px-2 py-0.5 rounded-md border border-zinc-100 font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score & Action */}
                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100">
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl">
                    <Sparkles className="w-4 h-4 text-zinc-700" />
                    <div>
                      <span className="text-sm font-bold text-zinc-950">
                        {cand.score}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-semibold ml-1">
                        / 100
                      </span>
                    </div>
                  </div>

                  <Link href={`/candidates/${cand.id}`}>
                    <Button
                      variant="pill"
                      size="sm"
                      className="h-8 text-xs font-semibold px-4 gap-1"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
