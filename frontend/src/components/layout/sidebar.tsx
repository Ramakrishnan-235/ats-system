"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ShoppingBag,
  Users,
  FileUp,
  BarChart2,
  RotateCcw,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "Jobs", href: "/jobs", icon: ShoppingBag },
  { label: "Candidates", href: "/candidates", icon: Users },
  { label: "Upload Resumes", href: "/upload", icon: FileUp },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Audit Log", href: "/audit-log", icon: RotateCcw },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-[#fbfbfa] border-r border-[#e8e6df] flex flex-col justify-between h-screen sticky top-0 select-none z-30 font-sans">
      {/* Top Header & Brand */}
      <div>
        <div className="p-6 pb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-900 leading-none">
            ATS Core
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1 mt-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150",
                  isActive
                    ? "bg-[#e5e0d3] text-zinc-950 font-semibold"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-[#ede9de] font-medium"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors shrink-0",
                    isActive ? "text-zinc-950 stroke-[2.2]" : "text-zinc-500 stroke-[1.8]"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-[#e8e6df]/70 bg-[#fbfbfa]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-900 leading-tight">
                Recruiter Admin
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">v1.2.4</span>
            </div>
          </div>
          <button
            title="Sign out"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-[#eae6db] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
