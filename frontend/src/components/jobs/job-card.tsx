"use client";

import React from "react";
import Link from "next/link";
import {
  Code2,
  Database,
  Palette,
  Briefcase,
  Sparkles,
  PauseCircle,
  MoreVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobRequisition } from "@/types/ats";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  code: Code2,
  database: Database,
  design: Palette,
  product: Briefcase,
};

interface JobCardProps {
  job: JobRequisition;
  onViewPipeline?: (job: JobRequisition) => void;
}

export function JobCard({ job, onViewPipeline }: JobCardProps) {
  const IconComponent = ICON_MAP[job.icon_type] || Code2;
  const isOpen = job.status === "OPEN";

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs hover:border-zinc-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
      {/* Left Area: Icon + Job Info */}
      <div className="flex items-start md:items-center gap-4 flex-1">
        {/* Job Type Icon */}
        <div className="w-12 h-12 rounded-xl bg-zinc-100/90 border border-zinc-200/60 flex items-center justify-center text-zinc-700 shrink-0">
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Title, Department, Location, Posted Date */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-bold text-sm text-zinc-950 hover:text-black transition-colors">
              {job.title}
            </h3>
            <Badge
              variant={isOpen ? "statusOpen" : "statusPaused"}
              className="text-[10px] px-2 py-0.5"
            >
              {job.status}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
            <span>{job.department}</span>
            <span>•</span>
            <span>{job.location}</span>
            <span>•</span>
            <span className="text-zinc-400">Posted {job.posted_date}</span>
          </div>
        </div>
      </div>

      {/* Center Area: Candidate Pile */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex -space-x-2 overflow-hidden">
          {job.avatars.slice(0, 3).map((avatarUrl, i) => (
            <img
              key={i}
              className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
              src={avatarUrl}
              alt="Candidate"
            />
          ))}
          {job.candidates_count > 3 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white text-[10px] font-bold text-zinc-600">
              +{job.candidates_count - 3}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-zinc-700">
          {job.candidates_count} candidates
        </span>
      </div>

      {/* Right Area: AI Match Status + Action CTA */}
      <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100">
        {/* Match Metric */}
        <div className="text-right min-w-[130px]">
          {isOpen && job.top_match.score > 0 ? (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-xs font-bold text-zinc-950">
                <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
                <span>{job.top_match.label}</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">
                Last run: {job.top_match.last_run}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-xs font-semibold text-zinc-500">
                <PauseCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Analysis Paused</span>
              </div>
              <span className="text-[11px] text-zinc-400">-</span>
            </div>
          )}
        </div>

        {/* View Pipeline Button & Menu */}
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button
              variant="pillOutline"
              size="sm"
              className="h-8 text-xs font-semibold px-4 rounded-full border-zinc-300 hover:bg-zinc-100"
            >
              View Pipeline
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
  );
}
