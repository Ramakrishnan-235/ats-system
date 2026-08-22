"use client";

import React from "react";
import { AIMatchRate } from "@/types/ats";
import { Calendar } from "lucide-react";

interface MatchRateDonutProps {
  data: AIMatchRate;
  processingCount: number;
  todayEvaluations: number;
}

export function MatchRateDonut({
  data,
  processingCount,
  todayEvaluations,
}: MatchRateDonutProps) {
  const radius = 56;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (data.rate / 100) * circumference;

  return (
    <div className="flex flex-col gap-4 font-sans h-full justify-between">
      {/* Donut Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/70 p-6 flex flex-col justify-between shadow-xs relative overflow-hidden flex-1 min-h-[250px]">
        {/* Title */}
        <div>
          <h3 className="font-bold text-base text-zinc-900">AI Match Rate</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{data.precision_label}</p>
        </div>

        {/* Donut & Legend Container */}
        <div className="flex items-center justify-between gap-4 my-auto py-2">
          {/* Legend */}
          <div className="space-y-3 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
              <span className="text-xs font-medium text-zinc-800">
                Matched ({data.matched_percent}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 shrink-0" />
              <span className="text-xs font-normal text-zinc-600">
                Not Matched ({data.not_matched_percent}%)
              </span>
            </div>
          </div>

          {/* SVG Donut Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center z-10 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              {/* Background Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-[#ede9e2]"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-black transition-all duration-1000 ease-out"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            {/* Center Percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-zinc-950">
                {data.rate}%
              </span>
            </div>
          </div>
        </div>

        {/* Faint Background Watermark "68" as in reference design */}
        <div className="absolute right-4 -bottom-6 text-[110px] font-bold text-zinc-100/70 select-none pointer-events-none tracking-tighter leading-none">
          {data.rate}
        </div>
      </div>

      {/* Bottom 2 Mini Metric Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Processing */}
        <div className="bg-white rounded-2xl border border-zinc-200/70 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-900" />
            <span>PROCESSING</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-zinc-950">
              {processingCount} Resumes
            </span>
          </div>
        </div>

        {/* Today */}
        <div className="bg-white rounded-2xl border border-zinc-200/70 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold tracking-wider uppercase">
            <Calendar className="w-3 h-3 text-zinc-600 stroke-[2]" />
            <span>TODAY</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-zinc-950">
              {todayEvaluations} Evaluations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
