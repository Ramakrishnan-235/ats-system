"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Building2,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
  Plus,
  Send,
  Sparkles,
  Info,
  Clock,
  Layers,
  ChevronDown,
  Briefcase,
  HelpCircle,
  EyeOff,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  // Architecture Model Selection
  const [architectureModel, setArchitectureModel] = useState<"corporate" | "agency">("corporate");

  // Masking Toggle
  const [strictMasking, setStrictMasking] = useState(true);

  // New Invite Form
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState("Recruiter");

  // Team Table Data
  const [teamMembers, setTeamMembers] = useState([
    {
      name: "Elena Varga (You)",
      email: "elena.varga@halden.com",
      initials: "EV",
      assignedAuthority: "Primary Admin",
      functionalScope: "Full Architectural Control",
      status: "Root Owner",
      statusColor: "text-emerald-700 bg-emerald-50",
      dotColor: "bg-emerald-600",
      isOwner: true,
    },
    {
      name: "Chris Miller",
      email: "c.miller@halden.com",
      initials: "CM",
      assignedAuthority: "Hiring Manager",
      functionalScope: "Engineering & Platform Org",
      status: "Pending Invite",
      statusColor: "text-purple-700 bg-purple-50",
      dotColor: "bg-purple-600",
      isOwner: false,
    },
    {
      name: "Tomas Novak",
      email: "t.novak@halden.com",
      initials: "TN",
      assignedAuthority: "Panel Reviewer",
      functionalScope: "Quantitative Alpha & Risk",
      status: "Pending Invite",
      statusColor: "text-purple-700 bg-purple-50",
      dotColor: "bg-purple-600",
      isOwner: false,
    },
  ]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail) return;

    setTeamMembers((prev) => [
      ...prev,
      {
        name: newInviteEmail.split("@")[0].replace(".", " "),
        email: newInviteEmail,
        initials: newInviteEmail.slice(0, 2).toUpperCase(),
        assignedAuthority: newInviteRole,
        functionalScope: "General Corporate Intake",
        status: "Pending Invite",
        statusColor: "text-purple-700 bg-purple-50",
        dotColor: "bg-purple-600",
        isOwner: false,
      },
    ]);

    showToast(`Invitation dispatched to ${newInviteEmail}`);
    setNewInviteEmail("");
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-6">
          
          {/* Top Setup Stepper Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#dee2ef]/60">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] font-bold text-[10px] uppercase tracking-wider">
                Setup Suite
              </span>
              <span className="text-[#75777c]">CORE ATS Onboarding</span>
              <span className="text-[#dee2ef]">•</span>
              <span className="text-[#141c27] font-bold">Step 2 of 4: Organization Architecture</span>
            </div>

            {/* Stepper Progress */}
            <div className="flex items-center gap-4 text-xs font-semibold text-[#75777c]">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">
                  ✓
                </span>
                <span>Verified</span>
              </div>
              <span className="w-8 h-px bg-[#dee2ef]" />
              <div className="flex items-center gap-1.5 text-[#141c27]">
                <span className="w-5 h-5 rounded-full bg-[#131c29] text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                <span className="font-bold">Workspace Architecture</span>
              </div>
              <span className="w-8 h-px bg-[#dee2ef]" />
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="w-5 h-5 rounded-full bg-[#dee2ef] text-[#75777c] flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Team Governance</span>
              </div>
              <span className="w-8 h-px bg-[#dee2ef]" />
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="w-5 h-5 rounded-full bg-[#dee2ef] text-[#75777c] flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>Ready</span>
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-3xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6137e0]">
                Architecture Provisioning
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                Configure Halden Financial Workspace
              </h1>
              <p className="text-sm text-[#45474c] mt-0.5">
                Establish the foundational data perimeter, requisition hierarchies, and role segregation for your talent operations.
              </p>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#dee2ef] shadow-2xs self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-[#069669]" />
              <span className="text-xs font-semibold text-[#141c27]">Domain Pre-Verified</span>
              <span className="text-[11px] text-[#75777c]">DKIM / SPF Bound (halden.com)</span>
            </div>
          </div>

          {/* Main 2-Column Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Main Config Column (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Card 1: Entity Identity & Tenant Subdomain (Step 2.1) */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-5">
                <div className="flex items-center justify-between pb-1 border-b border-[#eff4ff]">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-5 h-5 text-[#6137e0]" />
                    <h2 className="text-base font-bold text-[#141c27]">
                      Entity Identity &amp; Tenant Subdomain
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#75777c] font-mono text-[11px] font-semibold">
                    Step 2.1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Legal Org Name */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-[#141c27]">Legal Organization Name</label>
                      <span className="text-[11px] text-[#75777c] font-mono">Immutable</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        readOnly
                        value="Halden Financial"
                        className="w-full h-10 px-3.5 bg-[#f8f9ff] text-[#141c27] text-xs font-bold rounded-xl border border-[#dee2ef] focus:outline-none"
                      />
                      <CheckCircle2 className="w-4 h-4 text-[#069669] absolute right-3 pointer-events-none" />
                    </div>
                    <span className="text-[11px] text-[#75777c]">Validated against Dun &amp; Bradstreet / SEC filings</span>
                  </div>

                  {/* Tenant Workspace URI */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-[#141c27]">Tenant Workspace URI</label>
                      <span className="text-[11px] text-[#069669] font-bold">Available</span>
                    </div>
                    <div className="flex items-center">
                      <input
                        readOnly
                        value="halden"
                        className="flex-1 h-10 px-3.5 bg-[#f8f9ff] text-[#141c27] text-xs font-mono font-semibold rounded-l-xl border border-r-0 border-[#dee2ef]"
                      />
                      <span className="h-10 px-3 bg-[#eff4ff] text-[#75777c] font-mono text-xs rounded-r-xl border border-[#dee2ef] flex items-center">
                        .coreats.internal
                      </span>
                    </div>
                    <span className="text-[11px] text-[#75777c]">Enterprise single sign-on redirect endpoint target</span>
                  </div>
                </div>

                {/* Operating Architecture Model */}
                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-xs font-bold text-[#141c27]">Operating Architecture Model</label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: Corporate In-House Team */}
                    <div
                      onClick={() => setArchitectureModel("corporate")}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-4 relative ${
                        architectureModel === "corporate"
                          ? "border-[#6137e0] bg-[#e7deff]/20 shadow-xs"
                          : "border-[#dee2ef] bg-white hover:border-[#cbbeff]"
                      }`}
                    >
                      {architectureModel === "corporate" && (
                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#6137e0] text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      )}
                      <div>
                        <Building2 className="w-6 h-6 text-[#6137e0] mb-2" />
                        <h3 className="text-sm font-bold text-[#141c27]">Corporate In-House Team</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6137e0] block mt-0.5">
                          Single-Tenant Requisition Model
                        </span>
                        <p className="text-xs text-[#45474c] mt-2 leading-relaxed">
                          Single-tenant requisition governance, internal hiring manager scorecards, unified candidate talent pool, and centralized salary bands.
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[#dee2ef]/40 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-[#75777c]">Internal Requisitions</span>
                        <span className="text-[#6137e0]">Strict Audit Trail</span>
                      </div>
                    </div>

                    {/* Option 2: Executive Search & Agency */}
                    <div
                      onClick={() => setArchitectureModel("agency")}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-4 relative ${
                        architectureModel === "agency"
                          ? "border-[#6137e0] bg-[#e7deff]/20 shadow-xs"
                          : "border-[#dee2ef] bg-white hover:border-[#cbbeff]"
                      }`}
                    >
                      {architectureModel === "agency" && (
                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#6137e0] text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      )}
                      <div>
                        <Users className="w-6 h-6 text-[#75777c] mb-2" />
                        <h3 className="text-sm font-bold text-[#141c27]">Executive Search &amp; Agency</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] block mt-0.5">
                          Multi-Client Portal Model
                        </span>
                        <p className="text-xs text-[#45474c] mt-2 leading-relaxed">
                          Multi-client isolated workspaces, contingent placement tracking, client-masked PII sharing, fee splits, and external hiring reviews.
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[#dee2ef]/40 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-[#75777c]">B2B Portals &amp; Retainers</span>
                        <span className="text-[#75777c]">PII Sandboxed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Initial Seed Invitations & Role Governance (Step 2.2) */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#eff4ff]">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-[#6137e0]" />
                    <h2 className="text-base font-bold text-[#141c27]">
                      Initial Seed Invitations &amp; Role Governance
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#75777c] font-mono text-[11px] font-semibold self-start sm:self-auto">
                    Step 2.2
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#45474c]">
                    Seat allocation: <strong className="text-[#141c27]">{teamMembers.length} of 25 Enterprise Seats</strong> utilized in setup phase
                  </span>
                  <button
                    type="button"
                    onClick={() => showToast("Seat capacity upgraded to Enterprise Plus.")}
                    className="text-xs font-semibold text-[#6137e0] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Recruiter Seat</span>
                  </button>
                </div>

                {/* Team Roster Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#f8f9ff] text-[#75777c] font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3 rounded-l-lg">Team Member</th>
                        <th className="py-2.5 px-3">Assigned Authority</th>
                        <th className="py-2.5 px-3">Functional Scope</th>
                        <th className="py-2.5 px-3 rounded-r-lg text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff]">
                      {teamMembers.map((m, idx) => (
                        <tr key={idx} className="hover:bg-[#f8f9ff]/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-[10px]">
                                {m.initials}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-[#141c27]">{m.name}</span>
                                <span className="font-mono text-[11px] text-[#75777c]">{m.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {m.isOwner ? (
                              <span className="px-2 py-0.5 rounded bg-[#e7deff] text-[#1e0060] font-bold text-[10px]">
                                {m.assignedAuthority}
                              </span>
                            ) : (
                              <select
                                defaultValue={m.assignedAuthority}
                                className="bg-[#eff4ff] text-[#141c27] text-xs font-semibold px-2 py-1 rounded-lg border border-[#dee2ef] focus:outline-none"
                              >
                                <option>Hiring Manager</option>
                                <option>Panel Reviewer</option>
                                <option>Recruiter</option>
                              </select>
                            )}
                          </td>

                          <td className="py-3 px-3 font-medium text-[#45474c]">
                            {m.functionalScope}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.statusColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.dotColor}`} />
                              <span>{m.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invite Box */}
                <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <input
                    type="email"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    placeholder="colleague.email@halden.com"
                    className="flex-1 h-10 px-3.5 bg-[#f8f9ff] text-[#141c27] placeholder:text-[#75777c] text-xs rounded-xl border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0]"
                  />
                  <select
                    value={newInviteRole}
                    onChange={(e) => setNewInviteRole(e.target.value)}
                    className="h-10 px-3 bg-[#f8f9ff] text-[#141c27] text-xs font-semibold rounded-xl border border-[#dee2ef] focus:outline-none"
                  >
                    <option>Recruiter</option>
                    <option>Hiring Manager</option>
                    <option>Panel Reviewer</option>
                  </select>
                  <button
                    type="submit"
                    className="h-10 px-4 bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </button>
                </form>

                {/* Enforce Strict PII Masking Box */}
                <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/60 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#141c27]">
                        Enforce Strict Candidate PII Masking
                      </span>
                      <span className="px-2 py-0.2 rounded-full bg-[#e7deff] text-[#1e0060] font-bold text-[10px]">
                        EEOC COMPLIANT
                      </span>
                    </div>
                    <p className="text-[11px] text-[#45474c] leading-relaxed">
                      Automatically anonymize applicant candidate names, gender pronouns, graduation years, and physical addresses from stage scorecards until candidates advance past the primary screening phone call.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStrictMasking(!strictMasking)}
                    className={`w-11 h-6 rounded-full relative p-0.5 transition-colors shrink-0 cursor-pointer ${
                      strictMasking ? "bg-[#6137e0]" : "bg-[#dbe3f2]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                        strictMasking ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

              </div>
            </div>

            {/* Right Sidebar Column (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-5 sticky top-24">
              
              {/* Workspace Administrator Lead */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">
                  Workspace Administrator Lead
                </span>

                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-sm">
                    EV
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-[#141c27]">Elena Varga</span>
                    <span className="text-xs text-[#6137e0] font-semibold">Lead Recruiter &amp; System Admin</span>
                    <span className="font-mono text-[10px] text-[#75777c]">ID: REC-HLDN-0081</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#eff4ff] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#75777c]">SSO Handshake:</span>
                    <span className="text-[#069669] font-semibold">Okta SAML 2.0 Synced</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#75777c]">Requisition Limit:</span>
                    <span className="text-[#141c27] font-semibold">Uncapped (Tier-1 Enterprise)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#75777c]">Audit Encryption:</span>
                    <span className="font-mono text-[#141c27]">AES-256 GCM Keyring</span>
                  </div>
                </div>
              </div>

              {/* CORE Intelligence Guardrails */}
              <div className="bg-[#e7deff]/30 p-5 rounded-2xl shadow-xs border border-[#6137e0]/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#6137e0] text-xs font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>CORE Intelligence Guardrails</span>
                </div>

                <p className="text-xs text-[#45474c] leading-relaxed">
                  When enabled, candidate evaluations cite inspectable source artifacts (e.g. GitHub PRs, authored SEC 10-K disclosures, portfolio repos) without opaque probabilistic scoring.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2.5 py-1 rounded-full bg-white text-[#6137e0] font-semibold text-[10px] shadow-2xs">
                    Reasoning Logs: Enabled
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white text-[#6137e0] font-semibold text-[10px] shadow-2xs">
                    Blackbox Match %: Disabled
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white text-[#6137e0] font-semibold text-[10px] shadow-2xs">
                    Source Citations: Mandatory
                  </span>
                </div>
              </div>

              {/* Provisioning Verification Checklist */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col gap-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">
                  Provisioning Verification
                </span>

                <div className="space-y-2 text-[#141c27]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#069669]" />
                    <span className="font-medium">SOC-2 Type II Data Isolation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#069669]" />
                    <span className="font-medium">Candidate Talent Pool Partitioning</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#069669]" />
                    <span className="font-medium">Automated GDPR Article 17 Purge Hook</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-60">
                    <span className="w-4 h-4 rounded-full border border-[#75777c]" />
                    <span>Syndication to LinkedIn &amp; Indeed Recruiter</span>
                  </div>
                </div>
              </div>

              {/* Designer Annotation Box */}
              <div className="p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef]/60 flex items-start gap-2.5 text-xs text-[#45474c]">
                <HelpCircle className="w-4 h-4 text-[#6137e0] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#141c27] block font-semibold">DESIGNER ANNOTATION</strong>
                  <span className="text-[11px] leading-relaxed block mt-0.5">
                    Proposed prototype scope: Organizations can toggle agency client syndication anytime in Workspace Settings without data re-indexing or pipeline migration.
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Sticky Bottom Bar */}
          <div className="sticky bottom-6 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#dee2ef] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => showToast("Navigated back to verification step.")}
              className="h-10 px-4 rounded-xl bg-[#eff4ff] text-[#141c27] hover:bg-[#dee2ef] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Verification</span>
            </button>

            <span className="text-xs text-[#75777c] text-center">
              All changes are auto-cached locally. Re-entering will resume here.
            </span>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => showToast("Onboarding workspace draft saved.")}
                className="h-10 px-4 rounded-xl bg-white border border-[#dee2ef] text-[#141c27] hover:bg-[#f8f9ff] text-xs font-semibold transition-colors cursor-pointer"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast("Halden Financial Workspace provisioned successfully!");
                  setTimeout(() => router.push("/settings"), 1000);
                }}
                className="h-10 px-5 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>Create &amp; Launch Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#131c29] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <CoreFooter />
    </div>
  );
}
