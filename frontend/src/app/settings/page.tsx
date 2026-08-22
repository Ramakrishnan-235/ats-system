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
  Building,
  Upload,
  Plus,
  Check,
  Server,
  Cloud,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const [activeCategory, setActiveCategory] = useState<
    "General" | "Team" | "AI Models" | "Privacy"
  >("General");

  // General Settings State
  const [orgName, setOrgName] = useState("ATS Core");
  const [domain, setDomain] = useState("atscore.ai");
  const [timezone, setTimezone] = useState("UTC (Coordinated Universal Time)");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [aiAssistedSourcing, setAiAssistedSourcing] = useState(true);
  const [defaultSemanticSearch, setDefaultSemanticSearch] = useState(false);

  // Team State
  const [members, setMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [searchMember, setSearchMember] = useState("");
  const [piiRevelationLog, setPiiRevelationLog] = useState(true);
  const [autoRedactBeforeLLM, setAutoRedactBeforeLLM] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Recruiter" | "Viewer">("Recruiter");

  // AI Models State
  const [activeProviders, setActiveProviders] = useState([
    {
      id: "ollama",
      name: "Local (Ollama)",
      isPrimary: true,
      endpoint: "http://localhost:11434",
      status: "Connected",
      icon: Server,
    },
    {
      id: "openai",
      name: "OpenAI",
      isPrimary: false,
      endpoint: "API Key Valid",
      status: "Connected",
      icon: Cloud,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      isPrimary: false,
      endpoint: "API Key Valid",
      status: "Connected",
      icon: Sparkles,
    },
  ]);

  const [modelMapping, setModelMapping] = useState([
    {
      feature: "Candidate Matching",
      primaryModel: "gemma2:9b",
      fallbackModel: "gemma2:2b",
      latencyTarget: "Low",
      latencyColor: "bg-emerald-50 text-emerald-700",
    },
    {
      feature: "Resume Parsing",
      primaryModel: "Claude 3.5 Sonnet",
      fallbackModel: "GPT-4o mini",
      latencyTarget: "Medium",
      latencyColor: "bg-amber-50 text-amber-700",
    },
    {
      feature: "Coaching Insights",
      primaryModel: "GPT-4o",
      fallbackModel: "Claude 3 Opus",
      latencyTarget: "High",
      latencyColor: "bg-red-50 text-red-700",
    },
  ]);

  // Provider config modal
  const [selectedProviderToConfig, setSelectedProviderToConfig] = useState<string | null>(null);

  const togglePiiAccess = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, piiAccess: !m.piiAccess } : m))
    );
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    const newMember: TeamMember = {
      id: `mem-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      avatar: inviteName.slice(0, 2).toUpperCase(),
      piiAccess: false,
      isPending: true,
      status: "Invited",
    };

    setMembers([...members, newMember]);
    setIsInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
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
                    { label: "General" as const, icon: Sliders },
                    { label: "Team" as const, icon: Users },
                    { label: "AI Models" as const, icon: Cpu },
                    { label: "Privacy" as const, icon: Shield },
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
              {/* ============================================================ */}
              {/* 1. GENERAL SETTINGS TAB */}
              {/* ============================================================ */}
              {activeCategory === "General" && (
                <div className="space-y-6 animate-in fade-in-50 duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                      <span>System Settings</span>
                      <span>›</span>
                      <span className="text-zinc-900 font-semibold">General</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      General Settings
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">
                      Manage your organization&apos;s core identity, regional
                      preferences, and global system behavior.
                    </p>
                  </div>

                  {/* Organization Profile Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Organization Profile
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                          Organization Name
                        </label>
                        <Input
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="h-10 text-xs rounded-xl bg-zinc-50/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                          Domain
                        </label>
                        <Input
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          className="h-10 text-xs rounded-xl bg-zinc-50/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                        <Building className="w-5 h-5" />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs font-semibold h-9 px-4 border-zinc-200 hover:bg-zinc-50 shadow-none"
                      >
                        Change Logo
                      </Button>
                    </div>
                  </div>

                  {/* Regional Settings Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Regional Settings
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                          Timezone
                        </label>
                        <Input
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="h-10 text-xs rounded-xl bg-zinc-50/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                          Date Format
                        </label>
                        <Input
                          value={dateFormat}
                          onChange={(e) => setDateFormat(e.target.value)}
                          className="h-10 text-xs rounded-xl bg-zinc-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Global Preferences Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Global Preferences
                    </h3>

                    <div className="space-y-4 divide-y divide-zinc-100">
                      {/* Preference 1 */}
                      <div className="flex items-center justify-between gap-6 pt-3 first:pt-0">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-zinc-900">
                            Enable AI-Assisted Sourcing
                          </h4>
                          <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                            Automatically suggest candidates based on job
                            descriptions.
                          </p>
                        </div>
                        <Switch
                          checked={aiAssistedSourcing}
                          onCheckedChange={setAiAssistedSourcing}
                        />
                      </div>

                      {/* Preference 2 */}
                      <div className="flex items-center justify-between gap-6 pt-4">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-zinc-900">
                            Default to Semantic Search
                          </h4>
                          <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                            Use natural language understanding for all candidate
                            queries.
                          </p>
                        </div>
                        <Switch
                          checked={defaultSemanticSearch}
                          onCheckedChange={setDefaultSemanticSearch}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* 2. TEAM MEMBERS TAB */}
              {/* ============================================================ */}
              {activeCategory === "Team" && (
                <div className="space-y-6 animate-in fade-in-50 duration-150">
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
                        onClick={() => setIsInviteOpen(true)}
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

                              <td className="py-4 text-center">
                                <span className="bg-zinc-100 text-zinc-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-zinc-200">
                                  {member.role}
                                </span>
                              </td>

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
                          Configure systemic data handling before processing
                          through LLMs.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2 divide-y divide-zinc-100">
                      <div className="flex items-center justify-between gap-6 pt-3 first:pt-0">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-zinc-900">
                            Global PII Revelation Log
                          </h4>
                          <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                            Require users with PII access to submit a reason
                            before un-redacting candidate names and contact info.
                            All events logged to audit trail.
                          </p>
                        </div>
                        <Switch
                          checked={piiRevelationLog}
                          onCheckedChange={setPiiRevelationLog}
                        />
                      </div>

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
                </div>
              )}

              {/* ============================================================ */}
              {/* 3. AI MODELS TAB */}
              {/* ============================================================ */}
              {activeCategory === "AI Models" && (
                <div className="space-y-6 animate-in fade-in-50 duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                      <span>System Settings</span>
                      <span>›</span>
                      <span className="text-zinc-900 font-semibold">
                        AI Models
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      AI Models
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">
                      Manage LLM providers, model selection, and inference
                      parameters for AI scoring and analysis.
                    </p>
                  </div>

                  {/* Active Providers Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <h3 className="font-bold text-sm text-zinc-950">
                        Active Providers
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs font-semibold h-8 gap-1 border-zinc-200 hover:bg-zinc-50 shadow-none cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Provider</span>
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {activeProviders.map((provider) => {
                        const Icon = provider.icon;
                        return (
                          <div
                            key={provider.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/70 hover:bg-zinc-50 transition-colors"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-800 shrink-0">
                                <Icon className="w-5 h-5 stroke-[1.8]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-xs text-zinc-950">
                                    {provider.name}
                                  </h4>
                                  {provider.isPrimary && (
                                    <span className="bg-[#eae7df] text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                  • {provider.status} • {provider.endpoint}
                                </p>
                              </div>
                            </div>

                            <Button
                              onClick={() =>
                                setSelectedProviderToConfig(provider.id)
                              }
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs font-semibold h-8 px-4 border-zinc-200 hover:bg-white shadow-none"
                            >
                              Configure
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Model Selection Table Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Model Selection
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            <th className="pb-3 pl-1">FEATURE</th>
                            <th className="pb-3">PRIMARY MODEL</th>
                            <th className="pb-3">FALLBACK MODEL</th>
                            <th className="pb-3 text-right pr-2">
                              LATENCY TARGET
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {modelMapping.map((row) => (
                            <tr key={row.feature} className="hover:bg-zinc-50/50">
                              <td className="py-4 pl-1 font-semibold text-zinc-950">
                                {row.feature}
                              </td>

                              <td className="py-4">
                                <span className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-800 font-mono text-[11px] px-3 py-1 rounded-lg border border-zinc-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-black" />
                                  <span>{row.primaryModel}</span>
                                </span>
                              </td>

                              <td className="py-4 font-mono text-zinc-600 text-[11px]">
                                {row.fallbackModel}
                              </td>

                              <td className="py-4 text-right pr-2">
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-md",
                                    row.latencyColor
                                  )}
                                >
                                  {row.latencyTarget}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Global Inference Limits Card */}
                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Global Inference Limits
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-zinc-700 block">
                          Context Window Limit
                        </label>
                        <Input
                          defaultValue="32,768 tokens"
                          className="h-10 text-xs rounded-xl bg-zinc-50/50 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-semibold text-zinc-700 block">
                          Max Tokens per Request
                        </label>
                        <Input
                          defaultValue="4,096 tokens"
                          className="h-10 text-xs rounded-xl bg-zinc-50/50 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-semibold text-zinc-700 block">
                          Temperature
                        </label>
                        <Input
                          defaultValue="0.1 (Strict & Deterministic)"
                          className="h-10 text-xs rounded-xl bg-zinc-50/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* 4. PRIVACY TAB */}
              {/* ============================================================ */}
              {activeCategory === "Privacy" && (
                <div className="space-y-6 animate-in fade-in-50 duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                      <span>System Settings</span>
                      <span>›</span>
                      <span className="text-zinc-900 font-semibold">
                        Privacy
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      Privacy & PII Governance
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">
                      Audit logs, redaction rules, anonymization parameters, and
                      data retention policies.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                    <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-100 pb-3">
                      Anonymization Rules (Presidio)
                    </h3>

                    <div className="space-y-3 text-xs">
                      {[
                        {
                          name: "Candidate Full Names",
                          desc: "Replaces real identities with hash tokens (e.g. Candidate #7712)",
                          enabled: true,
                        },
                        {
                          name: "Email Addresses & Phone Numbers",
                          desc: "Masks contact details prior to passing context to third-party LLMs",
                          enabled: true,
                        },
                        {
                          name: "Home Addresses & Postal Codes",
                          desc: "Retains state/region while wiping specific street addresses",
                          enabled: true,
                        },
                        {
                          name: "Education Institution & Graduation Dates",
                          desc: "Reduces demographic bias during initial screening stage",
                          enabled: false,
                        },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/80 border border-zinc-100"
                        >
                          <div>
                            <h4 className="font-bold text-zinc-900">
                              {item.name}
                            </h4>
                            <p className="text-zinc-500 text-[11px] mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                          <Switch defaultChecked={item.enabled} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Invite Member Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-950">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Grant permissions and roles to recruiters, interviewers, or admins.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">
                Full Name
              </label>
              <Input
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Jordan Miller"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">
                Email Address
              </label>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jordan@acmecorp.com"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "Admin" | "Recruiter" | "Viewer"
                  )
                }
                className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none"
              >
                <option value="Recruiter">Recruiter</option>
                <option value="Admin">Admin</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-black hover:bg-zinc-800 text-white rounded-xl text-xs px-4"
              >
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
