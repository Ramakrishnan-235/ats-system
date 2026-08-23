"use client";

import React from "react";
import { Search, ChevronDown, SlidersHorizontal } from "lucide-react";

export const DEPARTMENTS = [
  { id: "ALL", label: "All Departments" },
  { id: "AI & Intelligent Systems", label: "AI, Machine Learning & Systems" },
  { id: "Cloud & Infrastructure", label: "Cloud, DevOps & Infrastructure" },
  { id: "Data Science & Analytics", label: "Data Science, Analytics & Big Data" },
  { id: "Cybersecurity & Risk", label: "Cybersecurity & Risk Management" },
  { id: "Software Engineering", label: "Software Engineering & Digital Design" },
  { id: "Quality Assurance & Support", label: "QA, Automation & IT Support" },
  { id: "Tech Leadership & Strategy", label: "Tech Leadership, Product & Strategy" },
  { id: "Specialized & Emerging Domains", label: "Specialized & Emerging Domains" },
];

interface JobFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  department: string;
  onDepartmentChange: (val: string) => void;
}

export function JobFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  department,
  onDepartmentChange,
}: JobFiltersProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-3 shadow-xs flex flex-col md:flex-row items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 w-full">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by job title, department, or required skills (e.g. LLMs, Python, AWS)..."
          className="w-full h-10 pl-10 pr-4 text-xs bg-zinc-50/70 rounded-xl border border-transparent focus:border-zinc-300 focus:bg-white focus:outline-none transition-all placeholder:text-zinc-400"
        />
      </div>

      {/* Filter Dropdowns & Controls */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl bg-zinc-50/80 border border-zinc-200/70 text-xs font-semibold text-zinc-700 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-950 cursor-pointer"
          >
            <option value="ALL">Status: All</option>
            <option value="OPEN">Status: Open</option>
            <option value="PAUSED">Status: Paused</option>
            <option value="CLOSED">Status: Closed</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Department Dropdown */}
        <div className="relative">
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl bg-zinc-50/80 border border-zinc-200/70 text-xs font-semibold text-zinc-700 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-950 cursor-pointer max-w-[200px] truncate"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Clear Filters Button if any active */}
        {(search || status !== "ALL" || department !== "ALL") && (
          <button
            onClick={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onDepartmentChange("ALL");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold px-2 py-1 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
