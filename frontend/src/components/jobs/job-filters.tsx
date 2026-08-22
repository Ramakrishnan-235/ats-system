"use client";

import React from "react";
import { Search, ChevronDown, SlidersHorizontal } from "lucide-react";

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
          placeholder="Search by title, department, or skill..."
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
            className="h-10 pl-3 pr-8 rounded-xl bg-zinc-50/80 border border-zinc-200/70 text-xs font-semibold text-zinc-700 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-950 cursor-pointer"
          >
            <option value="ALL">Department: All</option>
            <option value="Engineering">Engineering</option>
            <option value="Data">Data</option>
            <option value="Design">Design</option>
            <option value="Product">Product</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Sliders Toggle Icon */}
        <button
          title="Advanced Filters"
          className="h-10 w-10 rounded-xl bg-zinc-50/80 border border-zinc-200/70 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
