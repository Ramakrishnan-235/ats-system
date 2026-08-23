"use client";

import React from "react";
import Link from "next/link";
import {
  Code2,
  Database,
  Palette,
  Briefcase,
  Sparkles,
  Cloud,
  ShieldCheck,
  CheckCircle2,
  Crown,
  Cpu,
  PauseCircle,
  MoreVertical,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobRequisition } from "@/types/ats";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  ai: Sparkles,
  cloud: Cloud,
  database: Database,
  security: ShieldCheck,
  code: Code2,
  design: Palette,
  qa: CheckCircle2,
  leadership: Crown,
  product: Briefcase,
  emerging: Cpu,
};

const DEPT_STYLE_MAP: Record<string, { bg: string; text: string }> = {
  "AI & Intelligent Systems": { bg: "bg-purple-50 border-purple-200/60", text: "text-purple-700" },
  "Cloud & Infrastructure": { bg: "bg-sky-50 border-sky-200/60", text: "text-sky-700" },
  "Data Science & Analytics": { bg: "bg-emerald-50 border-emerald-200/60", text: "text-emerald-700" },
  "Cybersecurity & Risk": { bg: "bg-rose-50 border-rose-200/60", text: "text-rose-700" },
  "Software Engineering": { bg: "bg-blue-50 border-blue-200/60", text: "text-blue-700" },
  "Quality Assurance & Support": { bg: "bg-amber-50 border-amber-200/60", text: "text-amber-700" },
  "Tech Leadership & Strategy": { bg: "bg-indigo-50 border-indigo-200/60", text: "text-indigo-700" },
  "Specialized & Emerging Domains": { bg: "bg-teal-50 border-teal-200/60", text: "text-teal-700" },
};

interface JobCardProps {
  job: JobRequisition;
  onViewPipeline?: (job: JobRequisition) => void;
}

export function JobCard({ job }: JobCardProps) {
  const IconComponent = ICON_MAP[job.icon_type] || Code2;
  const isOpen = job.status === "OPEN";
  const deptStyle = DEPT_STYLE_MAP[job.department] || { bg: "bg-zinc-100/90 border-zinc-200/60", text: "text-zinc-700" };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-all flex flex-col gap-4">
      {/* Top Main Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Area: Icon + Job Info */}
        <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
          {/* Job Type Icon */}
          <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center shrink-0", deptStyle.bg, deptStyle.text)}>
            <IconComponent className="w-5 h-5" />
          </div>

          {/* Title, Department, Location, Posted Date */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link href={`/jobs/${job.id}`}>
                <h3 className="font-bold text-sm text-zinc-950 hover:text-indigo-600 transition-colors cursor-pointer">
                  {job.title}
                </h3>
              </Link>
              <Badge
                variant={isOpen ? "statusOpen" : "statusPaused"}
                className="text-[10px] px-2 py-0.5"
              >
                {job.status}
              </Badge>
              <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                {job.department}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
              <span>{job.location}</span>
              <span>•</span>
              <span>{job.min_years_experience}y+ exp</span>
              <span>•</span>
              <span className="text-zinc-400">Posted {job.posted_date}</span>
            </div>
          </div>
        </div>

        {/* Center/Right Area: Candidates + AI Match Status + Action CTA */}
        <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100">
          {/* Candidate Avatars */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex -space-x-2 overflow-hidden">
              {(job.avatars || []).slice(0, 3).map((avatarUrl, i) => (
                <img
                  key={i}
                  className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                  src={avatarUrl}
                  alt="Candidate"
                />
              ))}
              {(job.candidates_count || 0) > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white text-[10px] font-bold text-zinc-600">
                  +{(job.candidates_count || 0) - 3}
                </div>
              )}
            </div>
            <span className="text-xs font-semibold text-zinc-700 hidden sm:inline">
              {job.candidates_count || 0}
            </span>
          </div>

          {/* Match Metric */}
          <div className="text-right min-w-[110px]">
            {isOpen && job.top_match && job.top_match.score > 0 ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-xs font-bold text-zinc-950">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{job.top_match.label || "Top Match"}</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {job.top_match.last_run || "Active"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-xs font-semibold text-zinc-500">
                  <PauseCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Paused</span>
                </div>
                <span className="text-[11px] text-zinc-400">-</span>
              </div>
            )}
          </div>

          {/* View Pipeline Button */}
          <div className="flex items-center gap-2">
            <Link href={`/jobs/${job.id}`}>
              <Button
                variant="pillOutline"
                size="sm"
                className="h-8 text-xs font-semibold px-4 rounded-full border-zinc-300 text-zinc-900 bg-white hover:bg-zinc-950 hover:text-white transition-all shadow-none cursor-pointer"
              >
                Pipeline
              </Button>
            </Link>
            <button
              title="Options"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Description Snippet & Required Skills Row */}
      <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <p className="text-zinc-600 line-clamp-1 flex-1 font-normal">
          {job.job_description || "No description provided."}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {(job.required_skills || []).slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-md bg-zinc-100/80 text-zinc-700 text-[10px] font-medium"
            >
              {skill}
            </span>
          ))}
          {(job.required_skills || []).length > 4 && (
            <span className="text-[10px] font-semibold text-zinc-400">
              +{(job.required_skills || []).length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
