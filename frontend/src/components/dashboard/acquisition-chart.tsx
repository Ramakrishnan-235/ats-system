"use client";

import React, { useState } from "react";
import { WeeklyData } from "@/types/ats";
import { cn } from "@/lib/utils";

interface AcquisitionChartProps {
  data: WeeklyData[];
}

export function AcquisitionChart({ data }: AcquisitionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxCount = Math.max(...data.map((d) => d.count), 135);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/70 p-6 flex flex-col justify-between shadow-xs font-sans h-full min-h-[360px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-base text-zinc-900">New Candidates</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Rolling 8-week acquisition pipeline
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#efede7] px-3 py-1 rounded-full text-[11px] font-semibold text-zinc-800">
          <span className="w-2 h-2 rounded-full bg-black" />
          <span>Weekly Volume</span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="mt-8 relative h-64 flex flex-col justify-end">
        {/* Horizontal Dashed Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 pb-6">
          <div className="border-b border-dashed border-zinc-300 w-full" />
          <div className="border-b border-dashed border-zinc-300 w-full" />
          <div className="border-b border-dashed border-zinc-300 w-full" />
        </div>

        {/* Bars Container */}
        <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-4 px-2 h-56">
          {data.map((item, index) => {
            const heightPercent = (item.count / maxCount) * 100;
            const isHovered = hoveredIdx === index;

            return (
              <div
                key={item.week}
                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(index)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on Hover */}
                <div
                  className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-950 text-white transition-all duration-150 shadow-md",
                    isHovered
                      ? "opacity-100 -translate-y-1"
                      : "opacity-0 translate-y-1 pointer-events-none"
                  )}
                >
                  {item.count}
                </div>

                {/* Bar */}
                <div className="w-full max-w-[36px] flex items-end h-44">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={cn(
                      "w-full rounded-t-md transition-all duration-300",
                      item.is_peak
                        ? "bg-black group-hover:bg-zinc-800"
                        : "bg-[#595856] group-hover:bg-[#434241]"
                    )}
                  />
                </div>

                {/* Week Label */}
                <span
                  className={cn(
                    "text-xs transition-colors",
                    item.is_peak
                      ? "font-bold text-zinc-950"
                      : "text-zinc-500 font-normal group-hover:text-zinc-800"
                  )}
                >
                  {item.week}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
