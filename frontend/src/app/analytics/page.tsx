"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Bell,
  User,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState("Last 30 days");
  const [selectedJob, setSelectedJob] = useState("Job: All");
  const [hoveredDot, setHoveredDot] = useState<string | null>("priya");

  const exportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,Stage,Count,Conversion Rate\nApplied,1247,100%\nScreened,340,27%\nInterview,89,26%\nOffer,12,13%\nHired,3,25%";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ats_analytics_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>ATS</span>
            <span>›</span>
            <span className="text-zinc-900">CANDIDATES</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 text-zinc-900"
              />
            </div>

            <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center cursor-pointer">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-[1300px] w-full mx-auto space-y-6">
          {/* Title & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
              Analytics
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-xs font-semibold bg-white border-zinc-200 rounded-full gap-1.5 shadow-none hover:bg-zinc-50"
                  >
                    <span>{selectedRange}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white rounded-xl">
                  {["Last 7 days", "Last 30 days", "Last 90 days", "All Time"].map(
                    (r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => setSelectedRange(r)}
                        className="text-xs cursor-pointer"
                      >
                        {r}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Job Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-xs font-semibold bg-white border-zinc-200 rounded-full gap-1.5 shadow-none hover:bg-zinc-50"
                  >
                    <span>{selectedJob}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white rounded-xl">
                  {[
                    "Job: All",
                    "Senior Backend Engineer",
                    "Data Platform Architect",
                    "Lead UX Researcher",
                  ].map((j) => (
                    <DropdownMenuItem
                      key={j}
                      onClick={() => setSelectedJob(j)}
                      className="text-xs cursor-pointer"
                    >
                      {j}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Export CSV */}
              <Button
                onClick={exportCSV}
                size="sm"
                className="h-9 px-4 text-xs font-semibold bg-black hover:bg-zinc-800 text-white hover:text-zinc-300 rounded-full gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>

          {/* 2x2 Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Hiring Funnel Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col justify-between shadow-xs min-h-[340px]">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">
                      Hiring Funnel
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Conversion rates across pipeline
                    </p>
                  </div>
                  <Filter className="w-4 h-4 text-zinc-400" />
                </div>

                <div className="mt-6 space-y-3">
                  {/* Applied */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-zinc-950 mb-1.5">
                      <span className="tracking-wider text-[11px] text-zinc-500">
                        APPLIED
                      </span>
                      <span>1,247</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-full rounded-full" />
                    </div>
                  </div>

                  {/* Conversion Step 1 */}
                  <div className="pl-3 text-[11px] font-medium text-zinc-400 flex items-center gap-2">
                    <span className="w-px h-3 bg-zinc-300 inline-block" />
                    <span>27% conv.</span>
                  </div>

                  {/* Screened */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-zinc-950 mb-1.5">
                      <span className="tracking-wider text-[11px] text-zinc-500">
                        SCREENED
                      </span>
                      <span>340</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[27%] rounded-full" />
                    </div>
                  </div>

                  {/* Conversion Step 2 */}
                  <div className="pl-3 text-[11px] font-medium text-zinc-400 flex items-center gap-2">
                    <span className="w-px h-3 bg-zinc-300 inline-block" />
                    <span>26% conv.</span>
                  </div>

                  {/* Interview */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-zinc-950 mb-1.5">
                      <span className="tracking-wider text-[11px] text-zinc-500">
                        INTERVIEW
                      </span>
                      <span>89</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[7%] rounded-full" />
                    </div>
                  </div>

                  {/* Conversion Step 3 */}
                  <div className="pl-3 text-[11px] font-medium text-zinc-400 flex items-center gap-2">
                    <span className="w-px h-3 bg-zinc-300 inline-block" />
                    <span>13% conv.</span>
                  </div>

                  {/* Bottom: Offer & Hired */}
                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-zinc-950 mb-1">
                        <span className="tracking-wider text-[11px] text-zinc-500">
                          OFFER
                        </span>
                        <span>12</span>
                      </div>
                      <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-black h-full w-[25%] rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-zinc-950 mb-1">
                        <span className="tracking-wider text-[11px] text-zinc-500">
                          HIRED
                        </span>
                        <span>3</span>
                      </div>
                      <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-black h-full w-[25%] rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Time-to-Hire Trend Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col justify-between shadow-xs min-h-[340px]">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">
                      Time-to-Hire Trend
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Average days from application to offer
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-100 px-3 py-1 rounded-full text-xs font-semibold text-zinc-800">
                    <span className="w-2 h-2 rounded-full bg-black" />
                    <span>18 days avg</span>
                  </div>
                </div>

                {/* SVG Area Chart */}
                <div className="relative mt-8 h-48 w-full">
                  <svg
                    viewBox="0 0 400 160"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient
                        id="areaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#d4d4d8" stopOpacity="0.5" />
                        <stop
                          offset="100%"
                          stopColor="#f4f4f5"
                          stopOpacity="0.05"
                        />
                      </linearGradient>
                    </defs>

                    {/* Benchmark Dashed Line */}
                    <line
                      x1="0"
                      y1="60"
                      x2="400"
                      y2="60"
                      stroke="#d4d4d8"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x="350"
                      y="55"
                      fill="#a1a1aa"
                      fontSize="11"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      Benchmark (21d)
                    </text>

                    {/* Gradient Area Fill */}
                    <path
                      d="M 0 130 Q 80 120, 140 75 T 260 90 T 360 40 L 360 160 L 0 160 Z"
                      fill="url(#areaGradient)"
                    />

                    {/* Smooth Trend Curve Line */}
                    <path
                      d="M 0 130 Q 80 120, 140 75 T 260 90 T 360 40"
                      fill="none"
                      stroke="#3f3f46"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Key Point Circles */}
                    <circle cx="140" cy="75" r="4.5" fill="#27272a" />
                    <circle
                      cx="360"
                      cy="40"
                      r="6"
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth="3.5"
                    />
                  </svg>

                  {/* X Axis Labels */}
                  <div className="flex justify-between text-[11px] text-zinc-400 font-medium pt-3 px-1">
                    <span>Oct 1</span>
                    <span>Oct 15</span>
                    <span>Nov 1</span>
                    <span className="font-semibold text-zinc-700">Today</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Source Effectiveness Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col justify-between shadow-xs min-h-[300px]">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">
                      Source Effectiveness
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Top channels by volume
                    </p>
                  </div>
                  <button className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 underline underline-offset-4 cursor-pointer">
                    View All
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {/* LinkedIn */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-950 w-8">
                          42%
                        </span>
                        <span className="font-bold text-[11px] tracking-wider text-zinc-600 uppercase">
                          LINKEDIN
                        </span>
                      </div>
                      <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] px-2 py-0.5 rounded-md">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>4.2%</span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[42%] rounded-full" />
                    </div>
                  </div>

                  {/* Referral */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-950 w-8">
                          28%
                        </span>
                        <span className="font-bold text-[11px] tracking-wider text-zinc-600 uppercase">
                          REFERRAL
                        </span>
                      </div>
                      <span className="flex items-center gap-0.5 bg-red-50 text-red-700 font-bold text-[11px] px-2 py-0.5 rounded-md">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>1.1%</span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[28%] rounded-full" />
                    </div>
                  </div>

                  {/* Job Board */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-950 w-8">
                          18%
                        </span>
                        <span className="font-bold text-[11px] tracking-wider text-zinc-600 uppercase">
                          JOB BOARD
                        </span>
                      </div>
                      <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] px-2 py-0.5 rounded-md">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>2.4%</span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[18%] rounded-full" />
                    </div>
                  </div>

                  {/* Other */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-950 w-8">
                          12%
                        </span>
                        <span className="font-bold text-[11px] tracking-wider text-zinc-600 uppercase">
                          OTHER
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-black h-full w-[12%] rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. AI Score vs. Outcome Scatter Plot */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col justify-between shadow-xs min-h-[300px]">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950">
                      AI Score vs. Outcome
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Correlation of automated screening
                    </p>
                  </div>
                  <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
                </div>

                {/* Scatter Plot */}
                <div className="relative mt-6 h-48 w-full flex items-center justify-center">
                  <div className="relative w-full h-full flex">
                    {/* Y-Axis Labels */}
                    <div className="flex flex-col justify-between text-[10px] font-mono text-zinc-400 py-2 pr-2 text-right w-12">
                      <span>Screen</span>
                      <span>Int.</span>
                      <span>Offer</span>
                      <span className="font-bold text-zinc-900">Hired</span>
                    </div>

                    {/* Chart Body */}
                    <div className="relative flex-1 border-l border-b border-zinc-200">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                        <div className="border-b border-dashed border-zinc-200 w-full" />
                        <div className="border-b border-dashed border-zinc-200 w-full" />
                        <div className="border-b border-dashed border-zinc-200 w-full" />
                      </div>

                      {/* Scatter Dots */}
                      <div
                        className="absolute bottom-6 left-12 w-2.5 h-2.5 rounded-full bg-zinc-400"
                        title="Candidate 55 Score -> Screen"
                      />
                      <div
                        className="absolute bottom-8 left-16 w-3 h-3 rounded-full bg-zinc-500"
                        title="Candidate 62 Score -> Screen"
                      />
                      <div
                        className="absolute bottom-16 left-32 w-3.5 h-3.5 rounded-full bg-zinc-600"
                        title="Candidate 72 Score -> Interview"
                      />
                      <div
                        className="absolute bottom-20 left-44 w-4 h-4 rounded-full bg-zinc-700"
                        title="Candidate 78 Score -> Interview"
                      />
                      <div
                        className="absolute bottom-14 left-48 w-3 h-3 rounded-full bg-zinc-500"
                        title="Candidate 80 Score -> Interview"
                      />
                      <div
                        className="absolute top-12 right-24 w-3.5 h-3.5 rounded-full bg-zinc-800"
                        title="Candidate 89 Score -> Offer"
                      />
                      <div
                        className="absolute top-16 right-16 w-2.5 h-2.5 rounded-full bg-zinc-700"
                        title="Candidate 91 Score -> Offer"
                      />

                      {/* Highlighted Top-Right Dot (Priya Sharma: 95 -> Hired) */}
                      <div
                        className="absolute top-6 right-8 group cursor-pointer z-10"
                        onMouseEnter={() => setHoveredDot("priya")}
                      >
                        <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center animate-pulse">
                          <div className="w-2 h-2 rounded-full bg-black" />
                        </div>

                        {/* Tooltip */}
                        <div
                          className={cn(
                            "absolute -top-8 right-0 bg-black text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap transition-all duration-150",
                            hoveredDot === "priya"
                              ? "opacity-100 scale-100"
                              : "opacity-0 scale-95 pointer-events-none"
                          )}
                        >
                          <span>Priya S. 95 → Hired</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* X Axis Label */}
                <div className="flex justify-between text-[10px] font-mono text-zinc-400 pl-14 pt-1">
                  <span>50</span>
                  <span className="tracking-widest uppercase text-zinc-500 font-bold">
                    LLM EVALUATOR CALIBRATION
                  </span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
