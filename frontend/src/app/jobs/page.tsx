"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/job-filters";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Plus,
  Sparkles,
  Layers,
  Users,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { fetchJobs } from "@/lib/api";
import { JobRequisition } from "@/types/ats";
import { MOCK_JOBS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const DOMAIN_TABS = [
  { id: "ALL", label: "All Roles" },
  { id: "AI & Intelligent Systems", label: "AI & ML", fullLabel: "AI, Machine Learning & Systems" },
  { id: "Cloud & Infrastructure", label: "Cloud & DevOps", fullLabel: "Cloud, DevOps & Infrastructure" },
  { id: "Data Science & Analytics", label: "Data & Big Data", fullLabel: "Data Science, Analytics & Big Data" },
  { id: "Cybersecurity & Risk", label: "Cybersecurity", fullLabel: "Cybersecurity & Risk Management" },
  { id: "Software Engineering", label: "Software & Design", fullLabel: "Software Engineering & Digital Design" },
  { id: "Quality Assurance & Support", label: "QA & Support", fullLabel: "Quality Assurance, Automation & Support" },
  { id: "Tech Leadership & Strategy", label: "Leadership & Product", fullLabel: "Tech Leadership, Product & Strategy" },
  { id: "Specialized & Emerging Domains", label: "Emerging & IoT", fullLabel: "Specialized & Emerging Domains" },
];

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState<JobRequisition[]>(MOCK_JOBS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchJobs({
        status: statusFilter,
        department: departmentFilter,
        search,
      });
      if (data && data.length > 0) {
        setAllJobs(data);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter, departmentFilter, search]);

  const handleJobCreated = (newJob: JobRequisition) => {
    setAllJobs([newJob, ...allJobs]);
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    let result = [...allJobs];

    if (departmentFilter && departmentFilter !== "ALL") {
      const d = departmentFilter.toLowerCase();
      result = result.filter(
        (j) => j.department.toLowerCase().includes(d) || d.includes(j.department.toLowerCase())
      );
    }

    if (statusFilter && statusFilter !== "ALL") {
      result = result.filter((j) => j.status.toUpperCase() === statusFilter.toUpperCase());
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(s) ||
          j.department.toLowerCase().includes(s) ||
          j.location.toLowerCase().includes(s) ||
          j.job_description.toLowerCase().includes(s) ||
          j.required_skills.some((skill) => skill.toLowerCase().includes(s))
      );
    }

    return result;
  }, [allJobs, departmentFilter, statusFilter, search]);

  // Counts per department
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allJobs.length };
    for (const tab of DOMAIN_TABS) {
      if (tab.id !== "ALL") {
        const d = tab.id.toLowerCase();
        counts[tab.id] = allJobs.filter(
          (j) => j.department.toLowerCase().includes(d) || d.includes(j.department.toLowerCase())
        ).length;
      }
    }
    return counts;
  }, [allJobs]);

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search platform..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                    Job Requisitions & Roles
                  </h1>
                  <span className="bg-zinc-100 border border-zinc-200/80 text-zinc-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {allJobs.length} Positions
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Explore 50 curated tech roles across 8 domain categories with automated candidate scoring
                </p>
              </div>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              variant="pill"
              className="gap-2 px-5 text-xs font-semibold self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Job</span>
            </Button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-zinc-200/70 p-3 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 font-medium">Departments</div>
                <div className="text-sm font-bold text-zinc-950">8 Domains</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200/70 p-3 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 font-medium">Active Requisitions</div>
                <div className="text-sm font-bold text-zinc-950">50 Open</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200/70 p-3 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 font-medium">Candidate Pool</div>
                <div className="text-sm font-bold text-zinc-950">1,247 Profiles</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200/70 p-3 flex items-center gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 font-medium">AI Top Match Rate</div>
                <div className="text-sm font-bold text-zinc-950">95% High Fit</div>
              </div>
            </div>
          </div>

          {/* Domain Quick-Filter Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {DOMAIN_TABS.map((tab) => {
              const isActive = departmentFilter === tab.id;
              const count = domainCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setDepartmentFilter(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border",
                    isActive
                      ? "bg-zinc-950 text-white border-zinc-950 shadow-2xs"
                      : "bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:text-zinc-950"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      isActive ? "bg-zinc-800 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters Bar */}
          <JobFilters
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            department={departmentFilter}
            onDepartmentChange={setDepartmentFilter}
          />

          {/* Showing Results Summary */}
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span>
              Showing <strong className="text-zinc-900">{filteredJobs.length}</strong> of {allJobs.length} job requisitions
              {departmentFilter !== "ALL" && ` in ${departmentFilter}`}
            </span>
            {search && (
              <span>
                Filtered by keyword: &ldquo;<strong className="text-zinc-800">{search}</strong>&rdquo;
              </span>
            )}
          </div>

          {/* Job List */}
          <div className="space-y-3.5">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}

            {filteredJobs.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center space-y-3">
                <p className="text-sm font-semibold text-zinc-800">
                  No job requisitions match your filter criteria.
                </p>
                <p className="text-xs text-zinc-400">
                  Try searching for a different keyword or resetting domain and status filters.
                </p>
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setDepartmentFilter("ALL");
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-semibold cursor-pointer"
                >
                  Reset All Filters
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create New Job Modal Dialog */}
      <CreateJobModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onJobCreated={handleJobCreated}
      />
    </div>
  );
}
