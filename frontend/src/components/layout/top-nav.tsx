"use client";

import React, { useState } from "react";
import { Search, Calendar, ChevronDown, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavProps {
  title?: string;
  showDateFilter?: boolean;
  searchPlaceholder?: string;
}

export function TopNav({
  title = "Dashboard",
  showDateFilter = true,
  searchPlaceholder = "Search...",
}: TopNavProps) {
  const [selectedRange, setSelectedRange] = useState("Last 30 Days");
  const [searchQuery, setSearchQuery] = useState("");

  const timeRanges = [
    "Last 7 Days",
    "Last 30 Days",
    "Last 90 Days",
    "Year to Date",
    "All Time",
  ];

  return (
    <header className="h-20 px-8 flex items-center justify-between sticky top-0 z-20 bg-[#faf9f6]/90 backdrop-blur-xs font-sans">
      {/* Title */}
      <div>
        {title && (
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Date Filter Dropdown */}
        {showDateFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs font-medium text-zinc-800 bg-[#efede7] hover:bg-[#e7e4dc] border-0 rounded-xl gap-2 shadow-none cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-zinc-600 stroke-[1.8]" />
                <span>{selectedRange}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 stroke-[1.8]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white rounded-xl border border-zinc-200 shadow-lg p-1 min-w-[140px]"
            >
              {timeRanges.map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setSelectedRange(range)}
                  className="text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between text-zinc-800 hover:bg-zinc-100"
                >
                  <span>{range}</span>
                  {selectedRange === range && (
                    <Check className="w-3.5 h-3.5 text-zinc-900" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Global Search Bar */}
        <div className="relative w-64 md:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-4 text-xs bg-[#efede7] rounded-xl border-0 focus:ring-1 focus:ring-zinc-400 focus:bg-white focus:outline-none transition-all placeholder:text-zinc-400 text-zinc-900"
          />
        </div>

        {/* User Profile Avatar */}
        <div
          title="Recruiter Admin"
          className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-zinc-300 transition-all shrink-0"
        >
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </header>
  );
}
