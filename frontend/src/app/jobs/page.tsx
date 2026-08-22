"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilters } from "@/components/jobs/job-filters";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus } from "lucide-react";
import { fetchJobs } from "@/lib/api";
import { JobRequisition } from "@/types/ats";
import { MOCK_JOBS } from "@/lib/mock-data";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRequisition[]>(MOCK_JOBS);
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
      setJobs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [statusFilter, departmentFilter, search]);

  const handleJobCreated = (newJob: JobRequisition) => {
    setJobs([newJob, ...jobs]);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search platform..." />

        <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Header Banner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                  Jobs
                </h1>
                <p className="text-xs text-zinc-500 font-medium">
                  Manage active and paused requisitions
                </p>
              </div>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              variant="pill"
              className="gap-2 px-5 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>New Job</span>
            </Button>
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

          {/* Job List */}
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}

            {jobs.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
                <p className="text-sm font-semibold text-zinc-700">
                  No requisitions match your filter criteria.
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Try clearing your search or status filters.
                </p>
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
