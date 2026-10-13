"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, MapPin, Calendar, ArrowRight, Plus } from "lucide-react";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { useSession } from "@/components/layout/api-session";
import { fetchJobs, getErrorMessage } from "@/lib/api";
import type { JobRequisition } from "@/types/ats";

export default function JobsPage() {
  const { session } = useSession();
  return <JobDirectory key={session?.user.tenant_id || "disconnected"} />;
}

function JobDirectory() {
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    fetchJobs().then(value => {
      if (active) { setJobs(value); setError(""); }
    }).catch(reason => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const departments = Array.from(new Set(jobs.map(job => job.department).filter(Boolean))).sort();
  const filteredJobs = jobs.filter(job =>
    (status === "ALL" || job.status === status) &&
    (department === "ALL" || job.department === department) &&
    [job.title, job.department, job.location, ...job.required_skills].join(" ").toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <>
      <CoreHeader />
      <main className="w-full pt-16 bg-[#f9f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wider text-[#6137e0] mb-1">Recruitment workspace</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171c25]">Jobs</h1>
              <p className="text-sm text-[#45474c] mt-1">Open a job to view its details, applicants, and hiring pipeline.</p>
            </div>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="h-10 px-4 rounded-lg bg-[#131c29] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#263247]">
              <Plus className="w-4 h-4" /> Create job
            </button>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#dee2ef]/70 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-[#75777c]" />
                <input aria-label="Search jobs" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search jobs by title, location, or skills…" className="w-full h-10 pl-10 pr-3 rounded-lg bg-[#f0f3ff] text-sm outline-none focus:ring-2 focus:ring-[#6137e0]/40" />
              </div>
              <select aria-label="Filter jobs by department" value={department} onChange={event => setDepartment(event.target.value)} className="h-10 px-3 rounded-lg border border-[#dee2ef] text-sm bg-white">
                <option value="ALL">All departments</option>
                {departments.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {[["ALL", "All"], ["OPEN", "Open"], ["PAUSED", "Paused"], ["CLOSED", "Closed"]].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === value ? "bg-[#131c29] text-white" : "bg-[#f0f3ff] text-[#45474c] hover:bg-[#eaeefb]"}`}>
                  {label} <span className="ml-1 opacity-75">{value === "ALL" ? jobs.length : jobs.filter(job => job.status === value).length}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? <p role="status" className="text-sm text-[#45474c]">Loading jobs…</p> : error ? (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-5 text-sm text-red-800">
              <p>{error}</p>
              <button type="button" onClick={() => { setLoading(true); setRefresh(value => value + 1); }} className="mt-3 font-semibold underline">Try again</button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#dee2ef]/70 text-center p-12">
              <Briefcase className="w-8 h-8 mx-auto text-[#75777c] mb-3" />
              <h2 className="font-semibold text-[#171c25]">No jobs found</h2>
              <p className="mt-1 text-sm text-[#45474c]">{jobs.length ? "Try a different search or filter." : "Create a job to start hiring."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredJobs.map(job => (
                <Link key={job.id} href={`/jobs/${encodeURIComponent(job.id)}`} className="group bg-white p-5 rounded-xl border border-[#dee2ef]/70 shadow-sm hover:border-[#6137e0]/60 hover:shadow-md transition-all focus-visible:outline-2 focus-visible:outline-[#6137e0] flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 bg-[#e7deff] text-[#6137e0] rounded-xl flex items-center justify-center"><Briefcase className="w-5 h-5" /></div>
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${job.status === "OPEN" ? "bg-emerald-50 text-emerald-700" : "bg-[#f0f3ff] text-[#45474c]"}`}>{job.status}</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-[#171c25] group-hover:text-[#6137e0]">{job.title}</h2>
                    <p className="text-xs text-[#45474c] mt-1">{job.department || "Department not specified"}</p>
                  </div>
                  <div className="text-xs text-[#45474c] space-y-2">
                    <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{job.location || "Location not specified"}</p>
                    {job.posted_date && <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Posted {job.posted_date}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.required_skills.slice(0, 4).map(skill => <span key={skill} className="px-2 py-1 rounded-md bg-[#f0f3ff] text-[#45474c] text-[11px]">{skill}</span>)}
                    {job.required_skills.length > 4 && <span className="text-[11px] text-[#75777c] py-1">+{job.required_skills.length - 4} skills</span>}
                  </div>
                  <div className="mt-auto pt-3 border-t border-[#dee2ef]/60 flex items-center justify-between text-xs font-semibold text-[#6137e0]">View job <ArrowRight className="w-4 h-4" /></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <CoreFooter />
      <CreateJobModal open={isCreateOpen} onOpenChange={setIsCreateOpen} onJobCreated={job => setJobs(prev => [job, ...prev.filter(value => value.id !== job.id)])} />
    </>
  );
}
