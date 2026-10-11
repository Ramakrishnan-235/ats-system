"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Building2,
  Users,
  GitFork,
  Cpu,
  CreditCard,
  Shield,
  ShieldCheck,
  Check,
  Copy,
  Lock,
  UserPlus,
  Filter,
  MoreVertical,
  CheckCircle2,
  FileText,
  Code2,
  Mic,
  Clock,
  Gavel,
  RefreshCw,
  Globe,
  SlidersHorizontal,
  FolderLock,
  Palette,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TeamMember {
  id: string;
  name: string;
  isYou?: boolean;
  email: string;
  role: string;
  authority: string;
  fence: string;
  fenceReqs?: string[];
  fenceIcon: "public" | "reqs" | "palette" | "calendar";
  status: "Active" | "Pending";
  avatar: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>("general");
  const [operatingModel, setOperatingModel] = useState<"corporate" | "agency">("corporate");
  const [isStrictRubricChecked, setIsStrictRubricChecked] = useState<boolean>(true);
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>("");
  const [roleScopeFilter, setRoleScopeFilter] = useState<string>("All Governance Roles");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast(`Copied to clipboard: ${text}`);
  };

  const members: TeamMember[] = [
    {
      id: "ev",
      name: "Elena Varga",
      isYou: true,
      email: "elena.varga@halden.com",
      role: "Lead Recruiter & Admin",
      authority: "Full Tenant Master Controls",
      fence: "All Requisitions (Universal)",
      fenceIcon: "public",
      status: "Active",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDtqJFJrZcfrEz_Ztsm9wuF0MkV9I8iEAz8DTfmT3TbtKgEKGeMorELLfULMaodPU3JAOXFMVoDO3mxi6TF4kl_N2oIt-qBYziNOeK1JYSMLuIPZNOfNZtqo6vsTU4XSQEZlFV5D1KoaDc3CCkavhgfC_QhTwPh_jcGjeBbkDKo90v4cfGoThPGDUZuGNyvAgemiWCqE70hPUeES4qKF99HeJThmE8IFVheUcwvikcpTf4GoALsQT2pkQ",
    },
    {
      id: "cm",
      name: "Chris Miller",
      email: "c.miller@halden.com",
      role: "Hiring Manager (Engineering)",
      authority: "Scorecard Reviewer & Offer Author",
      fence: "Platform & Infra",
      fenceReqs: ["Req-204", "Req-208"],
      fenceIcon: "reqs",
      status: "Active",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBK7iDHS7qaV9gJxYLA4L2NIKwgytH-8smT8mxYWKdhOFQHZKqV50JzEYozpOa9RGrZneYFlEG1Rxdv6VrLUcP8yWXTtj1SrmqWaL1fh8HfX5uxWz67sB8prvNdb6Qpdl0hjrjvZi_m93jIMiRVDn2_bEg6cwTD5YpvqIWfADsbL-0xhw4RwA60B8yTzO2WEBp8Knm0KcyDEUspoLTCBIV_pWqWXv4osmm2q2lFcEHt_UPIEJsH-Z71Bg",
    },
    {
      id: "tn",
      name: "Tomas Novak",
      email: "t.novak@halden.com",
      role: "Interviewer",
      authority: "Portfolio & Critique Evaluator",
      fence: "Product Design",
      fenceIcon: "palette",
      status: "Active",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDEnmAgu0zrbZH5LhJeHSsQFrT49OLr3WPhW2W2Ltu77t-MZRm4jVHLjz02n_whNi2LXLYVSmwKd8fQ8UGwWhB1ZedoCcjBtpYFmdLGPocTrE7uTesqrYBjNHQPYMBZBupNbh5CH-Jr19BuogX_zWagYZOst1oMH_2uNY7IDBE8I5a3iACaNHr5Z72wk_MddDYHfjE0mYYkjbGzbIWGxN8_iUX-YvF4_K1GzkSoHe9M6RczNXe9DnwKOg",
    },
    {
      id: "sj",
      name: "Sarah Jenkins",
      email: "s.jenkins@halden.com",
      role: "Recruiting Coordinator",
      authority: "Logistics & Candidate Journey",
      fence: "Scheduling & Ingestion",
      fenceIcon: "calendar",
      status: "Active",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBGiZ1bcmqhr7BxQ6AnF0xLFgj0Lzk7dC58jQ_3rr2assWYspp3RaDPO71duLET0cMiy9a9piMT8CElv9SnPdX5d8WRAxpZZ_ZrApBC1yei5kqQglAQv_daO_F7Luh-J5eRGBof8MAOdx0wpiFJ1-ckNGw4UP4iYm4UyBbsdQZOSxgXOwjKnZQ2wf1SszsGqVCv9OJryL3nq3SFeWQf-xEHMSepW_dJDDrrk_jGt1zxt1z1lGDT9K2wTw",
    },
  ];

  const filteredMembers = members.filter((m) => {
    const matchSearch =
      !searchMemberQuery ||
      m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchMemberQuery.toLowerCase());

    const matchRole =
      roleScopeFilter === "All Governance Roles" ||
      (roleScopeFilter === "Lead Recruiter & Admin" && m.role.includes("Lead Recruiter")) ||
      (roleScopeFilter === "Hiring Manager" && m.role.includes("Hiring Manager")) ||
      (roleScopeFilter === "Interviewer" && m.role.includes("Interviewer")) ||
      (roleScopeFilter === "Coordinator" && m.role.includes("Coordinator"));

    return matchSearch && matchRole;
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          
          {/* Header & Meta Bar */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col max-w-3xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                  <span className="text-[11px] font-bold text-[#6137e0] uppercase tracking-wider">
                    Enterprise Administration
                  </span>
                  <span className="text-[#dee2ef] font-mono text-xs">/</span>
                  <span className="font-mono text-xs text-[#75777c]">TENANT_ID: HALDEN-9021</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                  Workspace Settings &amp; Team Governance
                </h1>
                <p className="text-sm text-[#45474c] mt-1">
                  Configure organizational hierarchy, agency permissions, ATS stage gates, and hiring rubrics.
                </p>
              </div>

              {/* Quick Status Badges */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] flex items-center gap-2.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#069669] animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-[#75777c] uppercase leading-none">
                      Security Baseline
                    </span>
                    <span className="text-xs font-bold text-[#141c27] leading-tight mt-0.5">
                      ISO-27001 · SOC2 Type II
                    </span>
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-white border border-[#dee2ef] flex items-center gap-2.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-[#6137e0]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-[#75777c] uppercase leading-none">
                      AI Governance Mode
                    </span>
                    <span className="text-xs font-bold text-[#6137e0] leading-tight mt-0.5">
                      Human-in-the-Loop
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interior Setting Tabs Bar */}
            <div className="p-1 bg-[#eff4ff] rounded-xl border border-[#dee2ef]/60 flex items-center gap-1 overflow-x-auto shadow-2xs">
              {[
                { id: "general", label: "General & Organization", icon: Building2 },
                { id: "team", label: "Team & Role Access", icon: Users, badge: "4" },
                { id: "stages", label: "Pipeline Stages & Gates", icon: GitFork },
                { id: "integrations", label: "Integrations & API", icon: Cpu },
                { id: "billing", label: "Billing & Subscription", icon: CreditCard },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-[#141c27] shadow-xs"
                        : "text-[#45474c] hover:text-[#141c27] hover:bg-[#dee2ef]/40"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#141c27]" : "text-[#75777c]"}`} />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#dee2ef] text-[#141c27] text-[10px] font-bold">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bento Grid Layout (5 cols left, 7 cols right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Workspace Profile & AI Governance (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Section 1: Workspace Profile */}
              <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#eff4ff] text-[#141c27] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#6137e0]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#141c27]">Workspace Profile</h2>
                      <p className="text-[11px] text-[#75777c]">Primary organization tenant properties</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#e7deff] text-[#1e0060] text-[11px] font-semibold">
                    Primary HQ
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-xs font-semibold text-[#141c27]">
                    Workspace Legal Entity &amp; Division
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      defaultValue="Halden Financial · Corporate Recruitment"
                      className="w-full h-10 px-3.5 bg-[#f8f9ff] text-[#141c27] text-xs font-medium rounded-xl border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                    />
                    <Building2 className="w-4 h-4 text-[#75777c] absolute right-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Operating Model */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#141c27]">Operating Model</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#eff4ff] rounded-xl border border-[#dee2ef]/60">
                    <button
                      type="button"
                      onClick={() => setOperatingModel("corporate")}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        operatingModel === "corporate"
                          ? "bg-white text-[#141c27] shadow-xs"
                          : "text-[#75777c] hover:text-[#141c27]"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#6137e0]" />
                      <span>Corporate Employer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperatingModel("agency")}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        operatingModel === "agency"
                          ? "bg-white text-[#141c27] shadow-xs"
                          : "text-[#75777c] hover:text-[#141c27]"
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#75777c]" />
                      <span>Recruitment Agency</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#75777c] mt-0.5">
                    Corporate mode enables intra-entity hiring manager scorecards and confidential requisition fencing.
                  </p>
                </div>

                {/* Subdomain */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#141c27]">
                    Internal System Subdomain
                  </label>
                  <div className="flex items-center">
                    <input
                      readOnly
                      value="halden.coreats.internal"
                      className="flex-1 h-10 px-3 bg-[#f8f9ff] text-[#141c27] font-mono text-xs rounded-l-xl border border-r-0 border-[#dee2ef] select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard("halden.coreats.internal")}
                      className="h-10 px-4 bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold rounded-r-xl border border-[#dee2ef] transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#45474c]" />
                      <span>Copy DNS</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-[#75777c]">
                    SSO redirect URI bound to this hostname via Okta Enterprise SAML 2.0.
                  </span>
                </div>

                {/* Micro Storage Meter */}
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#141c27]">Requisition Vault Capacity</span>
                    <span className="font-mono text-[#75777c]">14 / 50 Active Openings</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#dee2ef] overflow-hidden">
                    <div className="h-full bg-[#131c29] rounded-full" style={{ width: "28%" }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#75777c] pt-0.5">
                    <span>2.8 GB Dossiers Parsed</span>
                    <span className="text-[#6137e0] font-semibold">Tier: Corporate Dedicated</span>
                  </div>
                </div>
              </section>

              {/* Section 2: AI Synthesis & Governance */}
              <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#e7deff] text-[#1e0060] flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-[#6137e0]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#141c27]">AI Synthesis &amp; Governance</h2>
                      <p className="text-[11px] text-[#75777c]">Algorithmic safety and human override constraints</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#6137e0] font-mono text-xs font-bold">
                    CORE-V4.2
                  </span>
                </div>

                {/* Directive Banner */}
                <div className="p-4 rounded-xl bg-[#e7deff]/35 border border-[#6137e0]/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[#6137e0]">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold">Human-First Charter Bound</span>
                  </div>
                  <p className="text-xs text-[#45474c] leading-relaxed">
                    Probabilistic scoring badges (e.g. &quot;92% Fit&quot;) are permanently deactivated. CORE generates verifiable textual extraction trails with line citations only.
                  </p>
                </div>

                {/* Toggle Item 1: Human-in-the-Loop Enforced (Locked ON) */}
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#141c27]">
                        Human-in-the-Loop Enforced
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Mandatory
                      </span>
                    </div>
                    <p className="text-[11px] text-[#75777c] leading-snug">
                      The AI engine is constitutionally restricted from auto-rejecting, auto-advancing, or auto-tagging candidates without explicit recruiter affirmation.
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <div
                      className="w-11 h-6 bg-[#131c29] rounded-full relative p-0.5 cursor-not-allowed opacity-90 shadow-2xs"
                      title="Policy locked by Corporate Governance"
                    >
                      <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-xs flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-[#131c29]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle Item 2: Strict Rubric Citations Required */}
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#141c27]">
                        Strict Rubric Citations Required
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#dee2ef] text-[#141c27] text-[10px] font-semibold">
                        Active Policy
                      </span>
                    </div>
                    <p className="text-[11px] text-[#75777c] leading-snug">
                      Every rubric synthesis point must anchor to a concrete source snippet (e.g.{" "}
                      <span className="font-mono text-[10px] text-[#6137e0] bg-[#e7deff]/70 px-1 py-0.5 rounded">
                        CV: P.2 Line 42
                      </span>{" "}
                      or verified code pull request).
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsStrictRubricChecked(!isStrictRubricChecked)}
                      className={`w-11 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer ${
                        isStrictRubricChecked ? "bg-[#6137e0]" : "bg-[#dbe3f2]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                          isStrictRubricChecked ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Permitted Audit Citations */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#75777c] uppercase tracking-wider">
                    Permitted Audit Citations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] font-mono text-[11px] flex items-center gap-1.5 border border-[#dee2ef]/40">
                      <FileText className="w-3.5 h-3.5 text-[#6137e0]" />
                      <span>Resume: PDF/P.1-4</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] font-mono text-[11px] flex items-center gap-1.5 border border-[#dee2ef]/40">
                      <Code2 className="w-3.5 h-3.5 text-[#6137e0]" />
                      <span>GitHub Pull Request</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] font-mono text-[11px] flex items-center gap-1.5 border border-[#dee2ef]/40">
                      <Mic className="w-3.5 h-3.5 text-[#6137e0]" />
                      <span>Interview Transcript Segment</span>
                    </span>
                  </div>
                </div>
              </section>

            </div>

            {/* RIGHT COLUMN: Team Members & Governance (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                
                {/* Header & Invite Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#141c27]">
                        Team Members &amp; Governance
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#141c27] text-xs font-semibold">
                        4 Seats Assigned
                      </span>
                    </div>
                    <p className="text-xs text-[#75777c] mt-0.5">
                      Manage seat delegation, candidate visibility fences, and interviewing sign-offs.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(true)}
                    className="h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold shadow-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-white" />
                    <span>Invite Team Member</span>
                  </button>
                </div>

                {/* Filter / Quick Scope Row */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/50">
                  <div className="flex items-center gap-2 flex-1">
                    <Filter className="w-4 h-4 text-[#75777c]" />
                    <input
                      type="text"
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Search members, roles, or requisition handles..."
                      className="bg-transparent text-xs text-[#141c27] placeholder:text-[#75777c] focus:outline-none w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[#75777c] shrink-0 text-xs">
                    <span className="text-[11px] font-semibold">Role Scope:</span>
                    <select
                      value={roleScopeFilter}
                      onChange={(e) => setRoleScopeFilter(e.target.value)}
                      className="bg-white text-[#141c27] rounded-lg text-xs py-1 px-2.5 border border-[#dee2ef] focus:outline-none shadow-2xs cursor-pointer"
                    >
                      <option>All Governance Roles</option>
                      <option>Lead Recruiter &amp; Admin</option>
                      <option>Hiring Manager</option>
                      <option>Interviewer</option>
                      <option>Coordinator</option>
                    </select>
                  </div>
                </div>

                {/* Members Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f8f9ff] text-[#75777c] font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 rounded-l-lg">Collaborator</th>
                        <th className="py-3 px-4">Role &amp; Seat Authority</th>
                        <th className="py-3 px-4">Requisition Access Fence</th>
                        <th className="py-3 px-4">State</th>
                        <th className="py-3 px-4 rounded-r-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff]">
                      {filteredMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-[#f8f9ff]/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={m.avatar}
                                alt={m.name}
                                className="w-10 h-10 rounded-full object-cover shadow-2xs ring-2 ring-white"
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm text-[#141c27]">{m.name}</span>
                                  {m.isYou && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#dee2ef] text-[#141c27] text-[10px] font-bold">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[11px] text-[#75777c]">{m.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-[#141c27]">{m.role}</span>
                              <span className={`text-[11px] ${m.isYou ? "text-[#6137e0] font-medium" : "text-[#75777c]"}`}>
                                {m.authority}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {m.fenceIcon === "public" ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] text-[11px] inline-flex items-center gap-1.5 font-medium border border-[#dee2ef]/40">
                                <Globe className="w-3.5 h-3.5 text-[#069669]" />
                                <span>{m.fence}</span>
                              </span>
                            ) : m.fenceIcon === "palette" ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] text-[11px] inline-flex items-center gap-1.5 font-medium border border-[#dee2ef]/40">
                                <Palette className="w-3.5 h-3.5 text-[#6137e0]" />
                                <span>{m.fence}</span>
                              </span>
                            ) : m.fenceIcon === "calendar" ? (
                              <span className="px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#141c27] text-[11px] inline-flex items-center gap-1.5 font-medium border border-[#dee2ef]/40">
                                <Calendar className="w-3.5 h-3.5 text-[#75777c]" />
                                <span>{m.fence}</span>
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-[#141c27]">{m.fence}</span>
                                <div className="flex items-center gap-1">
                                  {m.fenceReqs?.map((req, i) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.5 rounded bg-[#eff4ff] text-[#141c27] font-mono text-[10px] border border-[#dee2ef]/50"
                                    >
                                      {req}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              <span>{m.status}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => showToast(`Governance options for ${m.name}`)}
                              className="p-1 rounded-lg text-[#75777c] hover:text-[#141c27] hover:bg-[#eff4ff] transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Role Authority Reference Strip */}
                <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#131c29]" /> Recruiter
                    </span>
                    <span className="text-[11px] text-[#75777c] mt-0.5 leading-snug">
                      Pipeline manipulation, stage advancing, candidate messaging.
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" /> Hiring Mgr
                    </span>
                    <span className="text-[11px] text-[#75777c] mt-0.5 leading-snug">
                      Assigned requisition access, scorecard creation, offer generation.
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#75777c]" /> Panel Reviewer
                    </span>
                    <span className="text-[11px] text-[#75777c] mt-0.5 leading-snug">
                      Blind scorecard submission, feedback view post-submission only.
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#069669]" /> Client Viewer
                    </span>
                    <span className="text-[11px] text-[#75777c] mt-0.5 leading-snug">
                      External redacted profile reviews for agency client accounts.
                    </span>
                  </div>
                </div>
              </section>

              {/* Section: Recent Governance Actions */}
              <section className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#75777c]" />
                    <h3 className="text-sm font-bold text-[#141c27]">Recent Governance Actions</h3>
                  </div>
                  <Link
                    href="/audit-log"
                    className="text-xs font-semibold text-[#6137e0] hover:underline"
                  >
                    View Full Tenant Audit Log →
                  </Link>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#6137e0]" />
                      <span>
                        <strong className="font-semibold text-[#141c27]">Elena Varga</strong> approved Human-in-the-Loop policy enforcement
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#75777c]">Today, 14:22 CET</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-[#75777c]" />
                      <span>
                        <strong className="font-semibold text-[#141c27]">Sarah Jenkins</strong> modified interview availability window
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#75777c]">Yesterday, 17:05 CET</span>
                  </div>
                </div>
              </section>

            </div>
          </div>

          {/* Sticky Bottom Global Command Bar with Save Actions */}
          <div className="sticky bottom-6 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#dee2ef] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#e7deff] text-[#1e0060] flex items-center justify-center shrink-0">
                <Gavel className="w-4 h-4 text-[#6137e0]" />
              </div>
              <p className="text-xs text-[#45474c] max-w-xl">
                <strong className="text-[#141c27] font-semibold">Configuration:</strong> Governs team permissions and guarantees human recruiter decision-making across all pipelines.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => showToast("Configuration reset to enterprise default.")}
                className="h-10 px-4 rounded-xl bg-[#eff4ff] text-[#141c27] hover:bg-[#dee2ef] text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset to Defaults
              </button>
              <button
                type="button"
                onClick={() => showToast("Workspace settings updated across tenant.")}
                className="h-10 px-5 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
                <span>Save Workspace Changes</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#131c29] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Invite Member Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Delegate hiring manager, recruiter, or interviewer seat access.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsInviteModalOpen(false);
              showToast("Invitation dispatched via Okta Enterprise SSO.");
            }}
            className="flex flex-col gap-3 mt-3 text-xs"
          >
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Full Name</label>
              <input
                required
                placeholder="e.g. Rachel Sterling"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Work Email</label>
              <input
                required
                type="email"
                placeholder="r.sterling@halden.com"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Seat Role &amp; Authority</label>
              <select className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27]">
                <option>Hiring Manager (Assigned Requisitions)</option>
                <option>Panel Reviewer / Interviewer</option>
                <option>Recruiting Coordinator</option>
                <option>Lead Recruiter &amp; Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl hover:bg-[#202d3f] transition-colors"
            >
              Send Invitation
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <CoreFooter />
    </div>
  );
}
