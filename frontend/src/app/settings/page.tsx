"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Bell,
  User,
  Sliders,
  Users,
  Cpu,
  Shield,
  Zap,
  ArrowRight,
  UserPlus,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Recruiter" | "Viewer";
  avatar: string;
  piiAccess: boolean;
  isPending?: boolean;
  status: "Active" | "Invited";
}

const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: "mem-1",
    name: "Elena Chen",
    email: "elena.c@acmecorp.com",
    role: "Admin",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
    piiAccess: true,
    status: "Active",
  },
  {
    id: "mem-2",
    name: "Marcus Johnson",
    email: "mjohnson@acmecorp.com",
    role: "Recruiter",
    avatar: "MJ",
    piiAccess: true,
    status: "Active",
  },
  {
    id: "mem-3",
    name: "Dr. Simon K.",
    email: "simon@acmecorp.com",
    role: "Viewer",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    piiAccess: false,
    status: "Active",
  },
  {
    id: "mem-4",
    name: "Sarah Ramirez",
    email: "sarah.r@acmecorp.com",
    role: "Recruiter",
    avatar: "SR",
    piiAccess: false,
    isPending: true,
    status: "Invited",
  },
];

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState("Team");
  const [members, setMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [searchMember, setSearchMember] = useState("");
  const [piiRevelationLog, setPiiRevelationLog] = useState(true);
  const [autoRedactBeforeLLM, setAutoRedactBeforeLLM] = useState(true);

  const togglePiiAccess = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, piiAccess: !m.piiAccess } : m))
    );
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.email.toLowerCase().includes(searchMember.toLowerCase())
  );

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

        {/* Main 2-Column Settings Layout */}
        <main className="flex-1 p-8 max-w-[1300px] w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Sub-Sidebar (3 cols) */}
            <aside className="lg:col-span-3 space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-3">
                  SETTINGS
                </span>
                <nav className="space-y-1 pt-2">
                  {[
                    { label: "General", icon: Sliders },
                    { label: "Team", icon: Users },
                    { label: "AI Models", icon: Cpu },
                    { label: "Privacy", icon: Shield },
                  ].map((item) => {
                    const isActive = activeCategory === item.label;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => setActiveCategory(item.label)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                          isActive
                            ? "bg-black text-white shadow-xs"
                            : "text-zinc-600 hover:text-zinc-950 hover:bg-[#ede9de]"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Enterprise Plan Card */}
              <div className="bg-[#f2efe6] rounded-2xl p-5 border border-zinc-200/80 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-xs text-zinc-950 pt-1">
                  Enterprise Plan
                </h4>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Unlimited AI parsing, 24/7 support.
                </p>
                <button className="flex items-center gap-1 text-[11px] font-bold text-zinc-950 hover:underline pt-2 cursor-pointer">
                  <span>Manage Billing</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </aside>

            {/* Right Main Settings Pane (9 cols) */}
            <section className="lg:col-span-9 space-y-6">
              {/* Breadcrumb & Title */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                  <span>System Settings</span>
                  <span>›</span>
                  <span className="text-zinc-900 font-semibold">Team</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                  Team Members
                </h2>
                <p className="text-xs text-zinc-500 font-medium">
                  Manage access controls, AI auditing permissions, and data
                  visibility for your organization.
                </p>
              </div>

              {/* Members Table Card */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                {/* Search & Invite Action Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchMember}
                      onChange={(e) => setSearchMember(e.target.value)}
                      placeholder="Search members..."
                      className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 rounded-full border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 text-zinc-900"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full sm:w-auto h-9 px-4 bg-black hover:bg-zinc-800 text-white rounded-full text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite Member</span>
                  </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="pb-3 pl-2">MEMBER</th>
                        <th className="pb-3 text-center">ROLE</th>
                        <th className="pb-3 text-center">PII ACCESS</th>
                        <th className="pb-3 text-right pr-2">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-zinc-50/50">
                          {/* Member avatar and email */}
                          <td className="py-4 pl-2">
                            <div className="flex items-center gap-3">
                              {member.avatar.startsWith("http") ? (
                                <img
                                  src={member.avatar}
                                  alt={member.name}
                                  className="w-9 h-9 rounded-full object-cover border border-zinc-200 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                                  {member.avatar}
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-zinc-950">
                                  {member.name}
                                </h4>
                                <p className="text-zinc-400 text-[11px]">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-4 text-center">
                            <span className="bg-zinc-100 text-zinc-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-zinc-200">
                              {member.role}
                            </span>
                          </td>

                          {/* PII Access Toggle */}
                          <td className="py-4 text-center">
                            {member.isPending ? (
                              <span className="italic text-zinc-400 text-[11px]">
                                Pending
                              </span>
                            ) : (
                              <div className="flex justify-center">
                                <Switch
                                  checked={member.piiAccess}
                                  onCheckedChange={() =>
                                    togglePiiAccess(member.id)
                                  }
                                />
                              </div>
                            )}
                          </td>

                          {/* Status Indicator */}
                          <td className="py-4 text-right pr-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-semibold",
                                member.status === "Active"
                                  ? "text-emerald-700"
                                  : "text-zinc-400"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  member.status === "Active"
                                    ? "bg-emerald-600"
                                    : "bg-zinc-400"
                                )}
                              />
                              <span>{member.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Privacy & Auditing Card */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-950">
                      Data Privacy & Auditing
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Configure systemic data handling before processing through
                      LLMs.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-2 divide-y divide-zinc-100">
                  {/* Setting 1 */}
                  <div className="flex items-center justify-between gap-6 pt-3 first:pt-0">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-zinc-900">
                        Global PII Revelation Log
                      </h4>
                      <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                        Require users with PII access to submit a reason before
                        un-redacting candidate names and contact info. All events
                        logged to audit trail.
                      </p>
                    </div>
                    <Switch
                      checked={piiRevelationLog}
                      onCheckedChange={setPiiRevelationLog}
                    />
                  </div>

                  {/* Setting 2 */}
                  <div className="flex items-center justify-between gap-6 pt-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-zinc-900">
                          Auto-Redact before LLM
                        </h4>
                        <Lock className="w-3 h-3 text-zinc-500" />
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                        All resumes are processed through Microsoft Presidio
                        anonymizer before being sent to external AI models.
                        Enforced system-wide.
                      </p>
                    </div>
                    <Switch
                      checked={autoRedactBeforeLLM}
                      onCheckedChange={setAutoRedactBeforeLLM}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
