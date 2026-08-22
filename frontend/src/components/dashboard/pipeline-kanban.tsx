"use client";

import React from "react";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineCandidateItem } from "@/types/ats";
import { cn } from "@/lib/utils";

interface PipelineKanbanProps {
  pipeline: Record<string, PipelineCandidateItem[]>;
  onAddCandidate?: () => void;
}

export function PipelineKanban({ pipeline, onAddCandidate }: PipelineKanbanProps) {
  const stages = [
    { key: "Contacted", label: "Contacted" },
    { key: "Interview", label: "Interview" },
    { key: "Negotiation", label: "Negotiation" },
  ];

  return (
    <div className="mt-8 font-sans">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 rounded-full bg-black shrink-0" />
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            Pipeline Overview
          </h2>
        </div>
        <Button
          onClick={onAddCandidate}
          size="sm"
          className="gap-1.5 text-xs font-semibold px-4 h-9 bg-black hover:bg-zinc-800 text-white rounded-full transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Candidate</span>
        </Button>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stages.map(({ key, label }) => {
          const items = pipeline[key] || [];

          return (
            <div
              key={key}
              className="bg-[#f6f5f1] rounded-2xl p-4 flex flex-col gap-3 min-h-[360px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="font-bold text-xs text-zinc-800">{label}</span>
                <span className="w-5 h-5 rounded-full bg-[#eae7df] text-zinc-700 font-bold text-[11px] flex items-center justify-center">
                  {items.length}
                </span>
              </div>

              {/* Candidate Cards */}
              <div className="flex flex-col gap-3">
                {items.map((candidate) => {
                  const isNegotiation = key === "Negotiation";
                  const isMarcus = candidate.name === "Marcus Adebayo";

                  return (
                    <Link
                      key={candidate.id}
                      href={`/candidates/${candidate.id}`}
                      className="block group"
                    >
                      <div
                        className={cn(
                          "bg-white rounded-xl p-4 shadow-xs hover:border-zinc-400 hover:shadow-md transition-all duration-200 flex flex-col gap-3 relative overflow-hidden",
                          isMarcus
                            ? "border border-zinc-400/80 ring-1 ring-zinc-400/20"
                            : "border border-zinc-200/80"
                        )}
                      >
                        {/* Top Row: Avatar + Name + Score Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            {candidate.avatar.startsWith("http") ? (
                              <img
                                src={candidate.avatar}
                                alt={candidate.name}
                                className="w-10 h-10 rounded-full object-cover border border-zinc-200/80 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#eae7df] text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {candidate.avatar}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-zinc-950 group-hover:text-black">
                                {candidate.name}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-medium leading-tight">
                                {candidate.role}
                              </span>
                            </div>
                          </div>

                          {/* Match Score Badge */}
                          <div
                            className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 relative",
                              isNegotiation
                                ? "bg-black text-white"
                                : "bg-zinc-50 border border-zinc-200 text-zinc-900"
                            )}
                          >
                            <Target
                              className={cn(
                                "w-3 h-3 stroke-[2]",
                                isNegotiation ? "text-white" : "text-zinc-700"
                              )}
                            />
                            <span>{candidate.match_score}</span>
                          </div>
                        </div>

                        {/* Summary / screening note */}
                        <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                          {candidate.summary}
                        </p>

                        {/* Probability bar for Negotiation */}
                        {candidate.probability !== null &&
                          candidate.probability !== undefined && (
                            <div className="flex items-center gap-3 pt-2">
                              <div className="flex-1 bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${candidate.probability}%` }}
                                  className="h-full bg-black rounded-full"
                                />
                              </div>
                              <span className="text-[11px] font-medium text-zinc-500 shrink-0">
                                {candidate.probability}% prob
                              </span>
                            </div>
                          )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
