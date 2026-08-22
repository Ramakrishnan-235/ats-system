"use client";

import React from "react";
import {
  ShoppingBag,
  Users,
  Timer,
  Award,
  TrendingUp,
  TrendingDown,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatMetric } from "@/types/ats";

const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: ShoppingBag,
  shoppingBag: ShoppingBag,
  users: Users,
  clock: Timer,
  timer: Timer,
  award: Ticket,
  ticket: Ticket,
};

export function StatCard({ metric }: { metric: StatMetric }) {
  const Icon = ICON_MAP[metric.icon] || ShoppingBag;
  const isDark = metric.style === "highlighted_dark";

  return (
    <div
      className={cn(
        "rounded-2xl p-6 transition-all duration-200 shadow-xs relative flex flex-col justify-between min-h-[155px] font-sans",
        isDark
          ? "bg-black text-white"
          : "bg-white text-zinc-950 border border-zinc-200/70"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "text-[11px] font-bold tracking-wider uppercase leading-tight",
            isDark ? "text-zinc-400" : "text-zinc-500",
            metric.id === "avg_time_to_hire" && "max-w-[100px]"
          )}
        >
          {metric.id === "avg_time_to_hire" ? (
            <>
              AVG TIME-TO-
              <br />
              HIRE
            </>
          ) : (
            metric.label
          )}
        </span>
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            isDark ? "bg-zinc-800 text-zinc-300" : "bg-[#f2ece1] text-zinc-700"
          )}
        >
          <Icon className="w-4 h-4 stroke-[1.8]" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight">{metric.value}</span>
        {metric.unit && (
          <span
            className={cn(
              "text-sm font-medium",
              isDark ? "text-zinc-400" : "text-zinc-900"
            )}
          >
            {metric.unit}
          </span>
        )}
      </div>

      {/* Trend / Subtext */}
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {metric.trend === "positive" && (
          <TrendingUp
            className={cn(
              "w-3.5 h-3.5 stroke-[2]",
              isDark ? "text-emerald-400" : "text-zinc-700"
            )}
          />
        )}
        {metric.trend === "negative" && (
          <TrendingDown className="w-3.5 h-3.5 text-zinc-700 stroke-[2]" />
        )}
        <span
          className={cn(
            "font-medium",
            isDark ? "text-zinc-300 text-xs" : "text-zinc-600 text-xs"
          )}
        >
          {metric.change}
        </span>
      </div>
    </div>
  );
}
