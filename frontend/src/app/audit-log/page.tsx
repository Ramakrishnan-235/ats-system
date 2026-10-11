"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Download,
  Calendar,
  Users,
  Filter,
  Search,
  Eye,
  Bot,
  Timer,
  Clock,
  Building2,
  Cloud,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Copy,
  Check,
  FileCheck2,
  Share2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  History,
  TrendingDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AuditEvent {
  id: string;
  txId: string;
  time: string;
  actorName: string;
  actorRole: string;
  actorInitials: string;
  actorIsBot?: boolean;
  actionTitle: string;
  actionIcon: "key" | "scan" | "review" | "shield" | "forward";
  actionColor: string;
  candidateName: string;
  candidateSub: string;
  complianceReason: string;
  ip: string;
  location: string;
  locationIcon: "office" | "cloud" | "vpn" | "gateway";
  status: "Authorized" | "Completed" | "Signed" | "Protected" | "Recorded";
  statusColor: string;
  hash: string;
  priorValue: string;
  newValue: string;
  authMethod: string;
  userAgent: string;
  systemReason: string;
  policyId: string;
  authTier: string;
  gdprDays: number;
}

const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "1",
    txId: "#TX-99081-A",
    time: "Today 10:14",
    actorName: "Elena Varga",
    actorRole: "Lead Recruiter",
    actorInitials: "EV",
    actionTitle: "Contact Info Revealed",
    actionIcon: "key",
    actionColor: "bg-[#e7deff] text-[#1e0060]",
    candidateName: "Marcus Vance",
    candidateSub: "Req-204",
    complianceReason: "Stage gate unlocked: Phone Screen scheduled",
    ip: "194.72.18.2",
    location: "London Office",
    locationIcon: "office",
    status: "Authorized",
    statusColor: "bg-emerald-50 text-emerald-700",
    hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    priorValue: "PII_STATE: MASKED\nPHONE: +44 •••• ••••\nEMAIL: m••••@vance.io",
    newValue: "PII_STATE: REVEALED\nPHONE: +44 7911 123456\nEMAIL: m.vance@vance.io",
    authMethod: "FIDO2 / Hardware Key",
    userAgent: "Chrome 130 / macOS",
    systemReason:
      "Stage gate unlocked: Phone Screen scheduled with Hiring Manager Tomas Novak. Recruiter granted 48h temporal access to candidate contact info.",
    policyId: "PII-G4-REQ204",
    authTier: "RBAC-Tier-1",
    gdprDays: 178,
  },
  {
    id: "2",
    txId: "#TX-99074-E",
    time: "Today 09:22",
    actorName: "System Daemon",
    actorRole: "Parsing Ingestion",
    actorInitials: "SD",
    actorIsBot: true,
    actionTitle: "Resume Parsed & Structured",
    actionIcon: "scan",
    actionColor: "bg-[#eff4ff] text-[#45474c]",
    candidateName: "Sarah Lin",
    candidateSub: "Req-204",
    complianceReason: "Automated batch ingestion (Run #882)",
    ip: "Worker 04-East",
    location: "Internal VPC",
    locationIcon: "cloud",
    status: "Completed",
    statusColor: "bg-[#eff4ff] text-[#141c27]",
    hash: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    priorValue: "RAW_INGEST: 1 PDF (3.2MB)\nSTATE: UNPROCESSED\nCANDIDATE_ID: UNASSIGNED",
    newValue: "DOC_VECTORS: EMBEDDED\nSTATE: STRUCTURED\nCANDIDATE_ID: CAN-44910",
    authMethod: "Worker mTLS Auth Token",
    userAgent: "CORE Parser v4.2 Engine",
    systemReason:
      "Automated batch ingestion (Run #882). Skills vectorization computed with 12 ontology tags extracted.",
    policyId: "INGEST-BATCH-882",
    authTier: "SYSTEM-DAEMON-SYS",
    gdprDays: 180,
  },
  {
    id: "3",
    txId: "#TX-98920-F",
    time: "Yesterday 16:45",
    actorName: "Chris Miller",
    actorRole: "Staff SWE",
    actorInitials: "CM",
    actionTitle: "Scorecard Submitted",
    actionIcon: "review",
    actionColor: "bg-[#e7deff] text-[#1e0060]",
    candidateName: "David K.",
    candidateSub: "Req-204",
    complianceReason: "Completed Technical Screening (Passed: 86/100)",
    ip: "185.22.44.1",
    location: "Secured VPN",
    locationIcon: "vpn",
    status: "Signed",
    statusColor: "bg-emerald-50 text-emerald-700",
    hash: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    priorValue: "TECHNICAL_SCORE: PENDING\nDECISION: NONE\nRUBRIC_VERSION: V2.4",
    newValue: "TECHNICAL_SCORE: 86/100\nDECISION: ADVANCE\nRUBRIC_SIGNATURE: VERIFIED",
    authMethod: "Okta Verify Push (MFA)",
    userAgent: "Firefox 131 / Linux",
    systemReason:
      "Completed Technical Screening. Candidate demonstrated strong distributed systems proficiency with Golang.",
    policyId: "SC-SCORE-ENG204",
    authTier: "EVAL-PANEL-T2",
    gdprDays: 177,
  },
  {
    id: "4",
    txId: "#TX-98894-C",
    time: "Yesterday 15:10",
    actorName: "Elena Varga",
    actorRole: "Lead Recruiter",
    actorInitials: "EV",
    actionTitle: "Candidate Masking Applied",
    actionIcon: "shield",
    actionColor: "bg-[#e7deff] text-[#1e0060]",
    candidateName: "David K.",
    candidateSub: "Sub #8812",
    complianceReason: "Agency portal syndication to Halden Financial",
    ip: "194.72.18.2",
    location: "London Office",
    locationIcon: "office",
    status: "Protected",
    statusColor: "bg-[#e7deff] text-[#4b12cb]",
    hash: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
    priorValue: "PORTAL_VIEW: FULL_PII\nCLIENT_ACCESS: UNRESTRICTED\nEMPLOYER: VISIBLE",
    newValue: "PORTAL_VIEW: REDACTED_BLIND\nCLIENT_ACCESS: SYN-PORTAL-8812\nEMPLOYER: [ANON TIER-1]",
    authMethod: "FIDO2 / Hardware Key",
    userAgent: "Chrome 130 / macOS",
    systemReason:
      "Agency portal syndication to Halden Financial. Fair hiring anonymization filter actively applied prior to executive review.",
    policyId: "PORTAL-MASK-8812",
    authTier: "RBAC-Tier-1",
    gdprDays: 176,
  },
  {
    id: "5",
    txId: "#TX-97510-B",
    time: "Oct 4 11:30",
    actorName: "Tomas Novak",
    actorRole: "Dir. Eng",
    actorInitials: "TN",
    actionTitle: "Stage Advanced",
    actionIcon: "forward",
    actionColor: "bg-[#dbe3f2] text-[#141c27]",
    candidateName: "Priya Sharma",
    candidateSub: "Req-188",
    complianceReason: "Moved from Screening to Final Partner Review",
    ip: "82.165.197.1",
    location: "Zurich Gateway",
    locationIcon: "gateway",
    status: "Recorded",
    statusColor: "bg-[#eff4ff] text-[#141c27]",
    hash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    priorValue: "STAGE: Screening\nSLOT: Req-188\nNEXT_ROUND: TBD",
    newValue: "STAGE: Final Partner Review\nSLOT: Req-188\nNEXT_ROUND: Scheduled Oct 12",
    authMethod: "YubiKey 5C NFC",
    userAgent: "Safari 18.0 / macOS",
    systemReason:
      "Moved from Screening to Final Partner Review based on scorecard evaluation and architecture system test result.",
    policyId: "STAGE-ADV-188",
    authTier: "LEAD-DIR-T1",
    gdprDays: 174,
  },
];

export default function AuditLogPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("1");
  const [dateFilter, setDateFilter] = useState<string>("Last 7 Days (Oct 1 – Oct 6, 2026)");
  const [userFilter, setUserFilter] = useState<string>("All Users (Elena, Chris, Tomas, Daemon)");
  const [actionFilter, setActionFilter] = useState<string>("All Events (PII, Stage, Notes, Client)");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedEvent = AUDIT_EVENTS.find((e) => e.id === selectedEventId) || AUDIT_EVENTS[0];

  const handleDownloadCsv = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast("Compliance audit CSV generated & downloaded (480 KB).");
    }, 1100);
  };

  const handleFreezeSnapshot = () => {
    showToast("Cryptographic ledger snapshot sealed and anchored to WORM archive.");
  };

  const filteredEvents = AUDIT_EVENTS.filter((e) => {
    const matchSearch =
      !searchQuery ||
      e.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.candidateSub.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.txId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          
          {/* Top Operational Banner & Meta Bar */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[11px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" />
                  WORM Ledger 4.19
                </span>
                <span className="font-mono text-xs text-[#75777c] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#069669]" />
                  Chain Head: #8F992B...E04
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                Audit Log &amp; Compliance Trail
              </h1>
              <p className="text-sm text-[#45474c] mt-0.5">
                Immutable record of candidate data access, stage transitions, PII reveals, and recruiter decisions.
              </p>
            </div>

            {/* Quick Ledger Telemetry & Export */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl shadow-xs border border-[#dee2ef]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#069669] animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c] leading-none">
                    Live Ingestion
                  </span>
                  <span className="text-xs font-bold text-[#141c27] leading-tight mt-0.5">
                    14,291 events sealed
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={isExporting}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-[#eff4ff] text-[#141c27] text-xs font-semibold shadow-xs border border-[#dee2ef] transition-all cursor-pointer"
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#6137e0]" />
                ) : (
                  <Download className="w-4 h-4 text-[#45474c]" />
                )}
                <span>{isExporting ? "Compiling..." : "Download Compliance Audit (CSV)"}</span>
              </button>

              <button
                type="button"
                onClick={handleFreezeSnapshot}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#131c29] text-white text-xs font-semibold shadow-md hover:bg-[#202d3f] transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4 text-white" />
                <span>Freeze Ledger Snapshot</span>
              </button>
            </div>
          </div>

          {/* Security Integrity Metrics Ribbon (4 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: PII Access Velocity */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  PII Access Velocity
                </span>
                <Eye className="w-4 h-4 text-[#6137e0]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">18</span>
                <span className="text-xs font-semibold text-[#069669] flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" /> -12% vs last wk
                </span>
              </div>
              <p className="text-[11px] text-[#75777c] mt-1">
                Gated reveals requiring dual confirmation
              </p>
              <div className="mt-3 h-1.5 w-full bg-[#dee2ef] rounded-full overflow-hidden">
                <div className="h-full bg-[#6137e0] rounded-full" style={{ width: "32%" }} />
              </div>
            </div>

            {/* Card 2: Automated Ingestions */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Automated Ingestions
                </span>
                <Bot className="w-4 h-4 text-[#069669]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">882</span>
                <span className="text-xs text-[#75777c]">Parsed resumes</span>
              </div>
              <p className="text-[11px] text-[#75777c] mt-1">
                System worker queue 04-East operational
              </p>
              <div className="mt-3 h-1.5 w-full bg-[#dee2ef] rounded-full overflow-hidden">
                <div className="h-full bg-[#069669] rounded-full" style={{ width: "98%" }} />
              </div>
            </div>

            {/* Card 3: Cryptographic Proofs */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Cryptographic Proofs
                </span>
                <ShieldCheck className="w-4 h-4 text-[#141c27]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">100%</span>
                <span className="text-xs font-bold text-[#069669]">Zero Hash Drift</span>
              </div>
              <p className="text-[11px] text-[#75777c] mt-1">
                SHA-256 merkle roots checked every 15m
              </p>
              <div className="mt-3 h-1.5 w-full bg-[#dee2ef] rounded-full overflow-hidden">
                <div className="h-full bg-[#131c29] rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Card 4: GDPR Retention Anchor */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#75777c]">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  GDPR Retention Anchor
                </span>
                <Timer className="w-4 h-4 text-[#6137e0]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#141c27]">180d</span>
                <span className="text-xs text-[#75777c]">Strict Halden Policy</span>
              </div>
              <p className="text-[11px] text-[#75777c] mt-1">
                Automatic redaction scheduled for Q1 2027
              </p>
              <div className="mt-3 h-1.5 w-full bg-[#dee2ef] rounded-full overflow-hidden">
                <div className="h-full bg-[#7a55fa] rounded-full" style={{ width: "44%" }} />
              </div>
            </div>
          </div>

          {/* Filter & Command Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 text-xs">
              {/* Date Filter */}
              <div className="inline-flex items-center bg-[#eff4ff] rounded-xl px-3.5 py-2 text-[#141c27] gap-2 cursor-pointer hover:bg-[#dee2ef]/70 transition-colors border border-[#dee2ef]/40">
                <Calendar className="w-4 h-4 text-[#75777c]" />
                <span className="font-medium select-none">{dateFilter}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>

              {/* Actor Filter */}
              <div className="inline-flex items-center bg-[#eff4ff] rounded-xl px-3.5 py-2 text-[#141c27] gap-2 cursor-pointer hover:bg-[#dee2ef]/70 transition-colors border border-[#dee2ef]/40">
                <Users className="w-4 h-4 text-[#75777c]" />
                <span className="font-medium select-none">{userFilter}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>

              {/* Action Type Filter */}
              <div className="inline-flex items-center bg-[#eff4ff] rounded-xl px-3.5 py-2 text-[#141c27] gap-2 cursor-pointer hover:bg-[#dee2ef]/70 transition-colors border border-[#dee2ef]/40">
                <Filter className="w-4 h-4 text-[#75777c]" />
                <span className="font-medium select-none">{actionFilter}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#75777c]" />
              </div>
            </div>

            {/* Candidate / Req Search */}
            <div className="relative w-full xl:w-96 flex items-center">
              <Search className="w-4 h-4 text-[#75777c] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Candidate ID or Req ID..."
                className="h-10 pl-10 pr-9 w-full bg-[#f8f9ff] text-[#141c27] placeholder:text-[#75777c] rounded-xl text-xs border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0] transition-all"
              />
              <span className="absolute right-3 font-mono text-[11px] text-[#75777c] bg-[#eff4ff] px-1.5 py-0.5 rounded">
                ⌘F
              </span>
            </div>
          </div>

          {/* Main Canvas: Split Master Table (8 cols) & Side Inspector (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Master Table (8 cols) */}
            <div className="lg:col-span-8 flex flex-col bg-white rounded-2xl shadow-xs border border-[#dee2ef]/70 overflow-hidden">
              
              {/* Heading Strip */}
              <div className="px-6 py-4 bg-[#eff4ff]/60 border-b border-[#dee2ef]/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#6137e0]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#141c27]">
                    Ledger Stream
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#dee2ef] text-[#141c27] font-mono text-[11px] font-semibold">
                    {filteredEvents.length} of 14,291
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#75777c]">
                  <span>Sorted by Sequence (Desc)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#f8f9ff] text-[#75777c] font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-6">Timestamp / Sequence</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action &amp; Target</th>
                      <th className="py-3 px-4 hidden xl:table-cell">Compliance Reason</th>
                      <th className="py-3 px-4">Location / Node</th>
                      <th className="py-3 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff]">
                    {filteredEvents.map((evt) => {
                      const isSelected = evt.id === selectedEvent.id;
                      return (
                        <tr
                          key={evt.id}
                          onClick={() => setSelectedEventId(evt.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#e7deff]/25 hover:bg-[#e7deff]/35"
                              : "hover:bg-[#f8f9ff]"
                          }`}
                        >
                          <td className="py-4 px-6 align-top">
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-[#141c27]">{evt.time}</span>
                              <span className="font-mono text-[11px] text-[#75777c]">{evt.txId}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 align-top">
                            <div className="flex items-center gap-2.5">
                              {evt.actorIsBot ? (
                                <div className="w-7 h-7 rounded-full bg-[#eff4ff] text-[#141c27] flex items-center justify-center">
                                  <Bot className="w-4 h-4 text-[#6137e0]" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#131c29] text-white flex items-center justify-center font-bold text-[11px]">
                                  {evt.actorInitials}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-semibold text-xs text-[#141c27]">{evt.actorName}</span>
                                <span className="text-[11px] text-[#75777c]">{evt.actorRole}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col gap-1">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] font-bold w-fit">
                                <Lock className="w-3 h-3" />
                                <span>{evt.actionTitle}</span>
                              </div>
                              <div className="flex items-center gap-1.5 font-medium text-xs text-[#141c27]">
                                <span>{evt.candidateName}</span>
                                <span className="px-1.5 py-0.2 rounded bg-[#eff4ff] font-mono text-[10px] text-[#75777c] border border-[#dee2ef]/40">
                                  {evt.candidateSub}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 align-top hidden xl:table-cell">
                            <p className="text-[11px] text-[#75777c] max-w-xs leading-snug">
                              {evt.complianceReason}
                            </p>
                          </td>

                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col">
                              <span className="font-mono text-[11px] text-[#141c27] font-medium">{evt.ip}</span>
                              <span className="text-[11px] text-[#75777c] flex items-center gap-1">
                                {evt.locationIcon === "cloud" ? (
                                  <Cloud className="w-3.5 h-3.5" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5" />
                                )}
                                <span>{evt.location}</span>
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-6 align-top text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${evt.statusColor}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span>{evt.status}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 bg-[#eff4ff]/60 border-t border-[#dee2ef]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#75777c]">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Append-only storage. Local nodes verify signatures against root ledger hash every 900 seconds.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled className="px-2.5 py-1 rounded-lg bg-white border border-[#dee2ef] text-[#75777c] disabled:opacity-40">
                    Previous
                  </button>
                  <span className="font-semibold text-[#141c27]">Page 1 of 286</span>
                  <button type="button" className="px-2.5 py-1 rounded-lg bg-white border border-[#dee2ef] text-[#141c27] hover:bg-[#dee2ef]/40">
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Side Panel: Forensic Inspector Drawer (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 sticky top-24">
              
              <div className="bg-white p-6 rounded-2xl shadow-md border border-[#dee2ef]/80 flex flex-col gap-5">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2.5">
                    <Fingerprint className="w-6 h-6 text-[#6137e0]" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#141c27]">Event Inspector</span>
                      <span className="font-mono text-[11px] text-[#75777c]">
                        {selectedEvent.txId} • SHA-256 Verified
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[10px] font-bold uppercase tracking-wider">
                    Gated Event
                  </span>
                </div>

                {/* Raw Cryptographic Audit Hash */}
                <div className="flex flex-col gap-1.5 bg-[#eff4ff] p-3.5 rounded-xl border border-[#dee2ef]/50">
                  <div className="flex items-center justify-between text-[#75777c] text-[10px] font-bold uppercase tracking-wider">
                    <span>Cryptographic Audit Hash</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedEvent.hash);
                        showToast("SHA-256 hash copied to clipboard.");
                      }}
                      className="hover:text-[#141c27]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-[#141c27] break-all leading-relaxed select-all">
                    {selectedEvent.hash}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#069669] mt-0.5 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Ledger block consensus reached across 3 cluster nodes</span>
                  </div>
                </div>

                {/* State Transition Differential */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">
                    State Transition Differential
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {/* Prior Value */}
                    <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#dee2ef]/50 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-[#ba1a1a] flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" /> Prior Value
                      </span>
                      <div className="text-[11px] text-[#75777c] whitespace-pre-line leading-relaxed">
                        {selectedEvent.priorValue}
                      </div>
                    </div>

                    {/* New Value */}
                    <div className="bg-[#e7deff]/30 p-3 rounded-xl border border-[#6137e0]/20 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-[#6137e0] flex items-center gap-1 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6137e0]" /> New Value
                      </span>
                      <div className="text-[11px] text-[#141c27] whitespace-pre-line leading-relaxed font-semibold">
                        {selectedEvent.newValue}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actor Session Metadata */}
                <div className="flex flex-col gap-2 bg-[#f8f9ff] p-3.5 rounded-xl border border-[#dee2ef]/50 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#75777c]">
                    Actor Session Context
                  </span>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                    <span className="text-[#75777c]">Authenticated User:</span>
                    <span className="text-[#141c27] font-semibold text-right">{selectedEvent.actorName} ({selectedEvent.actorRole})</span>
                    
                    <span className="text-[#75777c]">MFA Protocol:</span>
                    <span className="font-mono text-[#141c27] font-medium text-right">{selectedEvent.authMethod}</span>
                    
                    <span className="text-[#75777c]">IP Address:</span>
                    <span className="font-mono text-[#141c27] font-medium text-right">{selectedEvent.ip}</span>
                    
                    <span className="text-[#75777c]">Client User-Agent:</span>
                    <span className="font-mono text-[#141c27] text-right truncate" title={selectedEvent.userAgent}>
                      {selectedEvent.userAgent}
                    </span>
                  </div>
                </div>

                {/* System Reasoning & Policy Stamp */}
                <div className="bg-[#e7deff]/25 p-4 rounded-xl border border-[#6137e0]/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[#6137e0] text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-wider">System Reasoning &amp; Policy Stamp</span>
                  </div>
                  <p className="text-xs text-[#141c27] leading-relaxed">
                    {selectedEvent.systemReason}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white text-[#6137e0] font-mono text-[10px] font-bold shadow-2xs">
                      Policy ID: {selectedEvent.policyId}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white text-[#6137e0] font-mono text-[10px] font-bold shadow-2xs">
                      Auth: {selectedEvent.authTier}
                    </span>
                  </div>
                </div>

                {/* GDPR Art. 30 Compliance Stamp */}
                <div className="bg-[#eff4ff] p-3.5 rounded-xl border border-[#dee2ef]/60 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#069669] shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#069669]">
                      GDPR Art. 30 Compliance Stamp
                    </span>
                    <p className="text-[11px] text-[#45474c] leading-relaxed">
                      Lawful Basis: Legitimate interest / Pre-contractual diligence. Candidate data retention expires in <strong className="text-[#141c27] font-bold">{selectedEvent.gdprDays} days</strong> unless active consent renewed.
                    </p>
                  </div>
                </div>

                {/* Deep Dive Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsTimelineModalOpen(true)}
                    className="flex-1 h-9 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Full Timeline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast("Proof package exported to compliance vault.")}
                    className="h-9 px-3 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#75777c] hover:text-[#141c27] transition-colors cursor-pointer"
                    title="Export Ledger Proof"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Mandatory Compliance Disclaimer Footer */}
          <div className="w-full bg-white p-6 rounded-2xl shadow-xs border border-[#dee2ef]/70 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#75777c] shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#6137e0]" />
              </div>
              <p className="text-xs text-[#45474c]">
                <strong className="text-[#141c27] font-semibold">Compliance Trail:</strong> All recruiter decisions and candidate PII disclosures are logged for enterprise auditing. Records are cryptographically signed, immutable, and preserved under SOC2 Type II, ISO 27001, and EU GDPR statutory mandates.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs font-medium">
              <span className="font-mono text-[#75777c]">Sync Node: ldn-edge-09</span>
              <span className="w-2 h-2 rounded-full bg-[#069669]" />
              <span className="text-[#069669] font-bold">Ledger Healthy</span>
            </div>
          </div>

        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Full Timeline Modal */}
      <Dialog open={isTimelineModalOpen} onOpenChange={setIsTimelineModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27] flex items-center gap-2">
              <History className="w-4 h-4 text-[#6137e0]" />
              <span>Candidate Compliance Timeline: {selectedEvent.candidateName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Complete chronological audit trail for {selectedEvent.candidateSub}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3">
            <div className="border-l-2 border-[#6137e0] pl-4 space-y-4 text-xs">
              <div>
                <span className="font-mono text-[10px] text-[#75777c]">Oct 1, 09:12 • TX-91102-X</span>
                <div className="font-bold text-[#141c27]">Application Ingested via Careers Portal</div>
                <div className="text-[11px] text-[#75777c]">Candidate submitted resume &amp; self-reported skills</div>
              </div>
              <div>
                <span className="font-mono text-[10px] text-[#75777c]">Oct 2, 14:05 • TX-92441-A</span>
                <div className="font-bold text-[#141c27]">Parsed into Vector Taxonomy (CAN-44910)</div>
                <div className="text-[11px] text-[#75777c]">14 technical skills matched with 0 manual overrides</div>
              </div>
              <div>
                <span className="font-mono text-[10px] text-[#75777c]">Today 10:14 • TX-99081-A</span>
                <div className="font-bold text-[#6137e0]">Contact Info Revealed by Elena Varga</div>
                <div className="text-[11px] text-[#75777c]">Stage gate phone screen scheduled with Tomas Novak</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CoreFooter />
    </div>
  );
}
