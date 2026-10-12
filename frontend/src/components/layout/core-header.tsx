"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronDown,
  Layers,
  RotateCcw,
  Settings,
  Users,
  Sparkles,
  Command,
  Check,
  LogOut,
  Building2,
  FileText,
  Briefcase,
  X,
  Menu
} from "lucide-react";
import { useSession } from "./api-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CoreHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, disconnect } = useSession();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeWorkspace = session?.workspaces?.find(
    (w) => w.id === session?.user?.tenant_id
  ) || session?.workspaces?.[0];

  const workspaceName = activeWorkspace?.name || "Halden Financial · Corporate Recruitment";

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchResults = [
    { type: "Inbox", title: "Recruiter Inbox (9 Pending Items)", href: "/inbox" },
    { type: "Studio", title: "New Job Requisition (Draft REQ-208)", href: "/jobs/new" },
    { type: "Job", title: "Senior Platform Engineer (Req-204)", href: "/jobs" },
    { type: "Job", title: "Lead Product Designer", href: "/jobs" },
    { type: "Candidate", title: "Candidate Directory & Talent Pool", href: "/candidates" },
    { type: "Agency", title: "Agency Clients & Submissions Roster", href: "/clients" },
    { type: "Tool", title: "Candidate Imports & Parsing Pipeline", href: "/upload" },
    { type: "Tool", title: "Skills Library & Taxonomy", href: "/taxonomy" },
    { type: "Tool", title: "Compliance Audit Log", href: "/audit-log" },
  ].filter(item => 
    !searchQuery || 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-[#f9f9ff]/90 backdrop-blur-xl border-b border-[#dee2ef]/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left Brand & Workspace Switcher */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" aria-label="CORE ATS home" className="flex shrink-0 items-center gap-2.5 group">
              <img
                src="/core-ats-logo.png"
                alt="CORE ATS Logo"
                className="h-8 w-8 object-contain group-hover:scale-105 transition-transform"
                onError={(e) => {
                  // Fallback if image fails to render
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="hidden sm:inline font-semibold text-lg text-[#171c25] tracking-tight whitespace-nowrap">
                CORE ATS
              </span>
            </Link>

            {/* Workspace Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-[#f0f3ff] hover:bg-[#e4e8f5] transition-colors text-[#171c25] cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-[#75777c]" />
                  <span className="text-xs font-medium truncate max-w-[120px] sm:max-w-[190px]">
                    {workspaceName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#75777c]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-white rounded-xl shadow-lg border border-[#dee2ef] p-1.5">
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-[#75777c] px-2 py-1">
                  Active Workspace
                </DropdownMenuLabel>
                <DropdownMenuItem className="flex items-center justify-between text-xs font-medium px-2 py-2 rounded-lg bg-[#f0f3ff] text-[#171c25]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#6137e0]" />
                    <span>{workspaceName}</span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-[#6137e0]" />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-[#dee2ef]" />
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="text-xs text-[#45474c] hover:text-[#171c25] px-2 py-1.5 cursor-pointer rounded-lg hover:bg-[#f0f3ff]"
                >
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Workspace Settings & Team Governance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Center Navigation Pill Bar */}
          <div className="hidden xl:flex items-center justify-center shrink-0">
            <nav className="flex items-center gap-1 bg-[#131c29] p-1 rounded-full text-[#7b8495]">
              {/* Overview */}
              <Link
                href="/"
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  pathname === "/"
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Overview
              </Link>

              {/* Inbox */}
              <Link
                href="/inbox"
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  pathname.startsWith("/inbox")
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Inbox
                <span className="px-1.5 py-0.2 bg-[#6137e0] text-white rounded-full text-[10px] font-bold">
                  9
                </span>
              </Link>

              {/* Jobs */}
              <Link
                href="/jobs"
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  pathname.startsWith("/jobs")
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Jobs
                <span className="px-1.5 py-0.2 bg-[#dee2ef] text-[#171c25] rounded-full text-[10px] font-bold">
                  14
                </span>
              </Link>

              {/* Candidates */}
              <Link
                href="/candidates"
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  pathname.startsWith("/candidates")
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Candidates
              </Link>

              {/* Clients */}
              <Link
                href="/clients"
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  pathname.startsWith("/clients")
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Clients
              </Link>

              {/* Reports */}
              <Link
                href="/analytics"
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  pathname.startsWith("/analytics")
                    ? "bg-white text-[#171c25] shadow-xs"
                    : "text-[#bec7d9] hover:text-white"
                }`}
              >
                Reports
              </Link>

              {/* More Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all hover:text-white flex items-center gap-1 text-[#bec7d9] cursor-pointer"
                  >
                    More
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-white rounded-xl shadow-lg border border-[#dee2ef] p-1.5">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] px-2 py-1">
                    Featured Screens (5-Page Suite)
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push("/onboarding")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Building2 className="w-4 h-4 text-[#6137e0]" />
                    <span>1. Workspace Architecture (/onboarding)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/interviews")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <FileText className="w-4 h-4 text-[#6137e0]" />
                    <span>2. Panel Evaluations (/interviews)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/offers")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Briefcase className="w-4 h-4 text-[#6137e0]" />
                    <span>3. Offers & Comp Studio (/offers)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/workspace")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Layers className="w-4 h-4 text-[#6137e0]" />
                    <span>4. Recruiter Workspace (/workspace)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/candidates")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Sparkles className="w-4 h-4 text-[#6137e0]" />
                    <span>5. Candidates Directory (/candidates)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-[#dee2ef]" />
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] px-2 py-1">
                    System Modules
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push("/jobs/new")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Briefcase className="w-4 h-4 text-[#75777c]" />
                    <span>Requisition Studio (/jobs/new)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/upload")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <FileText className="w-4 h-4 text-[#75777c]" />
                    <span>Candidate Imports & Parsing</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-[#dee2ef]" />
                  <DropdownMenuItem
                    onClick={() => router.push("/taxonomy")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-[#6137e0]" />
                    <span>Skills Library & Taxonomy</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/audit-log")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 text-[#75777c]" />
                    <span>Audit Log & Compliance</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/clients")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <Users className="w-4 h-4 text-[#75777c]" />
                    <span>Agency Clients & Submissions</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-[#dee2ef]" />
                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2.5 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-[#75777c]" />
                    <span>Settings & Governance</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          {/* Right Controls: Search, Notifications, Profile */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Open navigation" className="xl:hidden rounded-lg p-2 hover:bg-[#e4e8f5]">
                  <Menu className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[calc(100dvh-80px)] overflow-y-auto">
                {[
                  ["Overview", "/"], ["Inbox", "/inbox"], ["Jobs", "/jobs"],
                  ["Candidates", "/candidates"], ["Clients", "/clients"],
                  ["Reports", "/analytics"], ["Create job", "/jobs/new"],
                  ["Imports", "/imports"], ["Skills Library", "/taxonomy"],
                  ["Audit Log", "/audit-log"], ["Interviews", "/interviews"],
                  ["Offers", "/offers"], ["Settings", "/settings"],
                ].map(([label, href]) => (
                  <DropdownMenuItem key={href} asChild><Link href={href}>{label}</Link></DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => setIsSearchOpen(true)}>Search</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Ask CORE ATS Search Trigger */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden min-[1536px]:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#f0f3ff] transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.04)] border border-[#dee2ef]/60 text-[#45474c] cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#75777c]" />
              <span className="text-xs text-[#45474c]">Ask CORE ATS</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#eaeefb] text-[10px] font-mono text-[#75777c]">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Button */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative p-2 rounded-full hover:bg-[#e4e8f5] transition-colors text-[#45474c] hover:text-[#171c25] cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6137e0] ring-2 ring-[#f9f9ff]"></span>
            </button>

            {/* User Profile Avatar with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account menu" className="relative flex h-8 w-8 items-center cursor-pointer group">
                  <img
                    alt="Elena Profile"
                    className="absolute inset-0 z-10 w-8 h-8 rounded-full object-cover ring-2 ring-[#dee2ef] group-hover:ring-[#6137e0] transition-all"
                    src="/elena-avatar.png"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="w-8 h-8 rounded-full bg-[#131c29] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#dee2ef]">
                    {session?.user?.name ? session.user.name.charAt(0) : "E"}
                  </div>
                  <span className="absolute z-20 bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#7a55fa] ring-2 ring-[#f9f9ff]"></span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white rounded-xl shadow-lg border border-[#dee2ef] p-1.5">
                <DropdownMenuLabel className="px-2 py-1.5">
                  <p className="text-xs font-bold text-[#171c25]">
                    {session?.user?.name || "Elena Vance"}
                  </p>
                  <p className="text-[11px] text-[#75777c]">
                    {session?.user?.role || "Corporate Recruiter Lead"}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 bg-[#dee2ef]" />
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="text-xs text-[#171c25] hover:bg-[#f0f3ff] px-2 py-1.5 cursor-pointer rounded-lg"
                >
                  <Settings className="w-3.5 h-3.5 mr-2 text-[#75777c]" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 cursor-pointer rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      {/* ⌘K Command Palette Dialog */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-lg p-0 bg-white border border-[#dee2ef] rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="p-4 border-b border-[#dee2ef] flex flex-row items-center gap-3 space-y-0">
            <Search className="w-5 h-5 text-[#6137e0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask CORE ATS or search jobs, candidates, rubrics..."
              className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-[#171c25] placeholder-[#75777c]"
              autoFocus
            />
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1 rounded-md text-[#75777c] hover:bg-[#f0f3ff]"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          <div className="p-2 max-h-80 overflow-y-auto space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#75777c]">
              Quick Navigation & Insights
            </div>
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsSearchOpen(false);
                  router.push(item.href);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#f0f3ff] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {item.type === "Job" && <Briefcase className="w-4 h-4 text-[#6137e0]" />}
                  {item.type === "Candidate" && <Users className="w-4 h-4 text-[#497cff]" />}
                  {item.type === "Tool" && <Sparkles className="w-4 h-4 text-[#7a55fa]" />}
                  <span className="text-xs font-medium text-[#171c25] group-hover:text-[#6137e0]">
                    {item.title}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#eaeefb] text-[#75777c]">
                  {item.type}
                </span>
              </button>
            ))}
          </div>
          <div className="p-3 bg-[#f9f9ff] border-t border-[#dee2ef] flex items-center justify-between text-[11px] text-[#75777c]">
            <span>Navigate with arrows · Press Enter to open</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#dee2ef] rounded font-mono text-[10px]">
              ESC to close
            </kbd>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
