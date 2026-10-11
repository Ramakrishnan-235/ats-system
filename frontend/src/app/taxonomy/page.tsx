"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  Search,
  Plus,
  Upload,
  Download,
  SlidersHorizontal,
  History,
  Copy,
  Edit,
  Trash2,
  CheckCircle2,
  BadgeAlert,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  Code2,
  ShieldCheck,
  FolderGit2,
  Check,
  X,
  FileText,
  Briefcase,
  AlertCircle,
  Archive,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CompetencyDetail {
  id: string;
  name: string;
  category: string;
  reqCount: number;
  levelingSpan: string;
  verificationModel: string;
  activeReqs: string;
  uuid: string;
  reviewerCouncil: string;
  rubricLevels: {
    level: string;
    label: string;
    span: string;
    description: string;
    isHighlighted?: boolean;
  }[];
  keywords: string[];
  verificationPrompt: string;
  promptSource: string;
  activeRequisitionsList: string;
}

const COMPETENCIES: CompetencyDetail[] = [
  {
    id: "k8s",
    name: "Kubernetes Cluster Orchestration",
    category: "Infrastructure",
    reqCount: 4,
    levelingSpan: "Junior → Staff",
    verificationModel: "Public Repo / Walkthrough",
    activeReqs: "Req-204, Req-208, Req-212",
    uuid: "tax_k8s_9924a",
    reviewerCouncil: "Platform Hiring Council",
    rubricLevels: [
      {
        level: "Level 1 (Proficient)",
        label: "Level 1",
        span: "Junior → Mid",
        description:
          "Deploys basic manifests, troubleshoots pod restarts, configures ingress controllers, and inspects event streams via standard tooling.",
      },
      {
        level: "Level 2 (Advanced)",
        label: "Level 2",
        span: "Senior",
        description:
          "Authors custom Helm charts, debugs CNI networking issues, configures horizontal pod autoscalers (HPA/KEDA), and implements pod security standards.",
      },
      {
        level: "Level 3 (Staff / Expert)",
        label: "Level 3",
        span: "Staff → Principal",
        description:
          "Authors Kubernetes Operators & Custom Resource Definitions (CRDs), tunes multi-node etcd clusters, and designs multi-region active-active cluster architectures.",
        isHighlighted: true,
      },
    ],
    keywords: ["k8s", "kubectl", "helm", "operator-sdk", "etcd", "cilium", "istio", "crd", "flux-cd"],
    verificationPrompt:
      "“Ask candidate to describe an incident where a control plane split-brain occurred and how they recovered state without data loss.”",
    promptSource: "Incident Debrief Rubric",
    activeRequisitionsList: "Principal Cloud Platform, Staff SRE, K8s Core",
  },
  {
    id: "golang",
    name: "Golang Microservices & gRPC",
    category: "Backend Systems",
    reqCount: 3,
    levelingSpan: "Mid → Principal",
    verificationModel: "Code Audit & Architecture",
    activeReqs: "Req-189, Req-202, Req-215",
    uuid: "tax_go_1183b",
    reviewerCouncil: "Distributed Systems Technical Committee",
    rubricLevels: [
      {
        level: "Level 1 (Proficient)",
        label: "Level 1",
        span: "Junior → Mid",
        description:
          "Implements standard HTTP/gRPC handlers, writes unit tests with test tables, and manages basic goroutines with channel synchronization.",
      },
      {
        level: "Level 2 (Advanced)",
        label: "Level 2",
        span: "Senior",
        description:
          "Designs protobuf contracts with backward compatibility, optimizes memory allocs with pprof, and implements distributed context propagation.",
      },
      {
        level: "Level 3 (Staff / Expert)",
        label: "Level 3",
        span: "Staff → Principal",
        description:
          "Builds resilient event loops, tunes Go runtime GC latencies for microsecond SLAs, and authors enterprise service-mesh sidecar interceptors.",
        isHighlighted: true,
      },
    ],
    keywords: ["golang", "grpc", "protobuf", "goroutines", "pprof", "sync.pool", "mutex", "zap"],
    verificationPrompt:
      "“Walk through a scenario where a channel deadlock triggered goroutine leaks in production, and explain your memory-profiling remediation.”",
    promptSource: "Concurrency Profiling Spec",
    activeRequisitionsList: "Staff Backend Engineer, Core Banking Engine Lead",
  },
  {
    id: "design-sys",
    name: "Design System Architecture & Tokens",
    category: "Product Design",
    reqCount: 2,
    levelingSpan: "Senior → Staff",
    verificationModel: "Portfolio Review & Figma Inspect",
    activeReqs: "Req-194, Req-221",
    uuid: "tax_ds_4821c",
    reviewerCouncil: "Design Systems Governance Board",
    rubricLevels: [
      {
        level: "Level 1 (Proficient)",
        label: "Level 1",
        span: "Junior → Mid",
        description:
          "Consumes design tokens, builds component variants in Figma, and ensures WCAG AA color contrast compliance.",
      },
      {
        level: "Level 2 (Advanced)",
        label: "Level 2",
        span: "Senior",
        description:
          "Architects semantic token hierarchy (primitive → semantic → component), maintains npm React library, and enforces layout grids.",
      },
      {
        level: "Level 3 (Staff / Expert)",
        label: "Level 3",
        span: "Staff → Principal",
        description:
          "Standardizes multi-brand token pipelines across web/mobile, designs headless accessibility primitives, and aligns cross-org engineering adoption.",
        isHighlighted: true,
      },
    ],
    keywords: ["tokens", "figma", "storybook", "wcag", "radix-ui", "tailwind", "styled-dictionary"],
    verificationPrompt:
      "“Describe your pipeline for syncing token schema changes between Figma Variables and CSS custom properties without breaking production builds.”",
    promptSource: "UI Architecture Matrix",
    activeRequisitionsList: "Lead Product Designer, Design Systems Engineer",
  },
  {
    id: "kafka",
    name: "Kafka Event Streaming",
    category: "Distributed Systems",
    reqCount: 3,
    levelingSpan: "Mid → Staff",
    verificationModel: "Architecture Deep-dive",
    activeReqs: "Req-177, Req-208, Req-230",
    uuid: "tax_kfk_7731d",
    reviewerCouncil: "Data Infrastructure Governance",
    rubricLevels: [
      {
        level: "Level 1 (Proficient)",
        label: "Level 1",
        span: "Junior → Mid",
        description:
          "Configures producers and consumer groups, tunes fetch.min.bytes, and monitors consumer lag offsets.",
      },
      {
        level: "Level 2 (Advanced)",
        label: "Level 2",
        span: "Senior",
        description:
          "Implements exactly-once semantics (EOS) with transactional producers, manages schema registry evolutions, and partitions for ordered scale.",
      },
      {
        level: "Level 3 (Staff / Expert)",
        label: "Level 3",
        span: "Staff → Principal",
        description:
          "Architects multi-datacenter MirrorMaker 2 replication, designs KRaft quorum topologies, and manages rebalance-free cooperative sticky assigns.",
        isHighlighted: true,
      },
    ],
    keywords: ["kafka", "kraft", "zookeeper", "schema-registry", "mirrormaker", "avro", "consumer-groups"],
    verificationPrompt:
      "“How do you handle a poison-pill payload in an exactly-once streaming topology while preserving deterministic ordering?”",
    promptSource: "Distributed Consensus Spec",
    activeRequisitionsList: "Senior Data Streaming Architect, Real-time Ledger SWE",
  },
  {
    id: "terraform",
    name: "Terraform Multi-Cloud Automation",
    category: "Infrastructure",
    reqCount: 2,
    levelingSpan: "Senior → Staff",
    verificationModel: "GitOps Workflow Screen",
    activeReqs: "Req-204, Req-242",
    uuid: "tax_tf_9012e",
    reviewerCouncil: "Cloud Security & Infra Council",
    rubricLevels: [
      {
        level: "Level 1 (Proficient)",
        label: "Level 1",
        span: "Junior → Mid",
        description:
          "Writes basic HCL modules, defines variable inputs and outputs, and executes terraform plan/apply against isolated state files.",
      },
      {
        level: "Level 2 (Advanced)",
        label: "Level 2",
        span: "Senior",
        description:
          "Structures reusable multi-region modules with remote state locking (S3/DynamoDB), configures Atlantis GitOps, and enforces Sentinel policies.",
      },
      {
        level: "Level 3 (Staff / Expert)",
        label: "Level 3",
        span: "Staff → Principal",
        description:
          "Designs enterprise landing zones, authors custom Terraform providers in Go, and automates zero-downtime VPC peering across hybrid cloud accounts.",
        isHighlighted: true,
      },
    ],
    keywords: ["terraform", "hcl", "atlantis", "gitops", "terragrunt", "sentinel", "s3-backend", "iam"],
    verificationPrompt:
      "“Walk through recovering from a corrupted state lock during a concurrent automated deployment without incurring drift or downtime.”",
    promptSource: "Infrastructure Resilience Rubric",
    activeRequisitionsList: "Staff SRE, Cloud Infrastructure Engineer",
  },
];

export default function TaxonomyPage() {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("k8s");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isNewSkillModalOpen, setIsNewSkillModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportMatrix = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast("Enterprise Competency Matrix exported (CSV / JSON Schema).");
    }, 1000);
  };

  const selectedCompetency = COMPETENCIES.find((c) => c.id === selectedSkillId) || COMPETENCIES[0];

  const filteredCompetencies = COMPETENCIES.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategoryFilter === "All Categories" ||
      (selectedCategoryFilter === "Distributed Systems" && (c.category === "Distributed Systems" || c.category === "Backend Systems")) ||
      (selectedCategoryFilter === "Cloud & Infra" && c.category === "Infrastructure") ||
      (selectedCategoryFilter === "Design Systems" && c.category === "Product Design") ||
      (selectedCategoryFilter === "Data & AI" && c.category === "Distributed Systems") ||
      (selectedCategoryFilter === "Security & GRC" && c.category === "Infrastructure");

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#141c27] flex flex-col font-sans antialiased">
      <CoreHeader />

      <main className="w-full pt-20 bg-[#f8f9ff] flex-1 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          
          {/* Header & Context Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-[11px] font-bold uppercase tracking-wider">
                  Taxonomy Engine
                </span>
                <span className="text-xs text-[#75777c] font-medium">v4.12 Enterprise Registry</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#141c27]">
                Skills &amp; Competency Taxonomy
              </h1>
              <p className="text-sm text-[#45474c] leading-relaxed mt-0.5">
                Standardized technical competencies, verification criteria, and rubric weights across engineering, design, and product roles.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleExportMatrix}
                disabled={isExporting}
                className="h-10 px-4 rounded-xl bg-white text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef] transition-colors text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#45474c]" />
                <span>{isExporting ? "Exporting..." : "Export Matrix"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsNewSkillModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] transition-all text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>New Skill Definition</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-[#75777c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter competencies by name, extraction token, or rubric..."
                  className="w-full h-11 pl-10 pr-12 rounded-xl bg-white text-[#141c27] placeholder:text-[#75777c] text-xs shadow-xs border border-[#dee2ef] focus:outline-none focus:ring-2 focus:ring-[#6137e0] transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-[#75777c] font-mono text-[11px] bg-[#eff4ff] px-2 py-0.5 rounded">
                  <span>⌘K</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[#75777c] text-xs font-medium shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Coverage: 98.4% calibrative alignment</span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { label: "All Categories (218)", filter: "All Categories" },
                { label: "Distributed Systems (34)", filter: "Distributed Systems" },
                { label: "Cloud & Infra (48)", filter: "Cloud & Infra" },
                { label: "Design Systems (22)", filter: "Design Systems" },
                { label: "Data & AI (38)", filter: "Data & AI" },
                { label: "Security & GRC (19)", filter: "Security & GRC" },
              ].map((pill, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(pill.filter)}
                  className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                    selectedCategoryFilter === pill.filter
                      ? "bg-[#131c29] text-white"
                      : "bg-white text-[#45474c] hover:text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef]/60"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Two-Pane Split Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left Pane: Registered Competencies List (7 cols) */}
            <div className="xl:col-span-7 flex flex-col gap-6">
              
              <div className="bg-white rounded-2xl shadow-xs border border-[#dee2ef]/70 overflow-hidden flex flex-col">
                {/* Table Header Context Bar */}
                <div className="px-6 py-4 bg-[#eff4ff]/60 flex items-center justify-between border-b border-[#dee2ef]/40">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-[#141c27]">Registered Competencies</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#dee2ef] text-[#141c27] font-semibold text-[11px]">
                      Showing {filteredCompetencies.length} of 218
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#75777c] text-xs">
                    <span>Sorted by</span>
                    <span className="font-semibold text-[#141c27]">Relevance &amp; Active Roles</span>
                  </div>
                </div>

                {/* Skills Rows List */}
                <div className="divide-y divide-[#eff4ff] flex flex-col">
                  {filteredCompetencies.map((comp) => {
                    const isSelected = comp.id === selectedCompetency.id;
                    return (
                      <div
                        key={comp.id}
                        onClick={() => setSelectedSkillId(comp.id)}
                        className={`p-6 flex flex-col gap-3 relative cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#e7deff]/30 hover:bg-[#e7deff]/40"
                            : "bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#6137e0] rounded-r" />
                        )}

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="px-2 py-0.5 rounded bg-[#dbe3f2] font-semibold text-[11px] text-[#141c27]">
                                {comp.category}
                              </span>
                              <span className="text-[#75777c] text-xs">•</span>
                              <span className="font-mono text-[11px] text-[#75777c]">
                                REQ-LINKED: {comp.reqCount} ACTIVE
                              </span>
                            </div>
                            <h2 className="text-base font-bold text-[#141c27] tracking-tight truncate">
                              {comp.name}
                            </h2>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Active</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[#75777c] text-xs">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-[#141c27]">Leveling Span</span>
                            <span>{comp.levelingSpan}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-[#141c27]">Verification Model</span>
                            <span className="truncate">{comp.verificationModel}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-[#141c27]">Active Requisitions</span>
                            <span className="truncate text-[#6137e0] font-medium">{comp.activeReqs}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Table Footer Pagination */}
                <div className="p-4 bg-[#eff4ff]/60 border-t border-[#dee2ef]/40 flex items-center justify-between text-[#75777c] text-xs font-medium">
                  <span>Displaying page 1 of 44</span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="px-2.5 py-1 rounded bg-white text-[#141c27] font-bold shadow-2xs">1</button>
                    <button type="button" className="px-2.5 py-1 rounded hover:bg-[#dee2ef] text-[#45474c]">2</button>
                    <button type="button" className="px-2.5 py-1 rounded hover:bg-[#dee2ef] text-[#45474c]">3</button>
                    <span className="px-1">...</span>
                    <button type="button" className="px-2.5 py-1 rounded hover:bg-[#dee2ef] text-[#45474c]">44</button>
                  </div>
                </div>
              </div>

              {/* Department Balance Donut Card */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#dee2ef]/70 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#6137e0]" />
                    <span className="text-sm font-bold text-[#141c27]">
                      Competency Balance by Department
                    </span>
                  </div>
                  <span className="text-xs text-[#75777c]">Updated 2h ago</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Donut representation */}
                  <div className="flex items-center gap-4 col-span-2">
                    <svg className="w-24 h-24 shrink-0 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#dbe3f2]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.8"
                      />
                      <path
                        className="text-[#6137e0]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="45, 100"
                        strokeWidth="3.8"
                      />
                      <path
                        className="text-[#7a55fa]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="30, 100"
                        strokeDashoffset="-45"
                        strokeWidth="3.8"
                      />
                      <path
                        className="text-[#141c27]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="25, 100"
                        strokeDashoffset="-75"
                        strokeWidth="3.8"
                      />
                    </svg>

                    <div className="flex flex-col gap-1.5 text-xs text-[#75777c]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#6137e0]" />
                        <span className="text-[#141c27] font-semibold">Core Engineering: 45%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7a55fa]" />
                        <span>Infra &amp; Reliability: 30%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#141c27]" />
                        <span>Product &amp; Systems: 25%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#eff4ff] rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#75777c] uppercase tracking-wider">
                      Calibration Rate
                    </span>
                    <span className="text-2xl font-black text-[#141c27] tracking-tight">
                      96.2%
                    </span>
                    <span className="text-[11px] text-[#75777c]">Inter-rater agreement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Pane: Taxonomy Inspector (5 cols) */}
            <div className="xl:col-span-5 flex flex-col gap-5 sticky top-24">
              
              <div className="bg-white rounded-2xl shadow-md border border-[#dee2ef]/80 p-6 flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#141c27] text-[11px] font-bold tracking-wider">
                      TAXONOMY INSPECTOR
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => showToast("Competency change audit history opened.")}
                        className="p-1.5 rounded-lg hover:bg-[#eff4ff] text-[#75777c] hover:text-[#141c27] transition-colors"
                        title="View Audit Trail"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast("Definition JSON schema copied to clipboard.")}
                        className="p-1.5 rounded-lg hover:bg-[#eff4ff] text-[#75777c] hover:text-[#141c27] transition-colors"
                        title="Clone Definition"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-[#141c27] tracking-tight mt-1">
                    {selectedCompetency.name}
                  </h2>

                  <div className="flex items-center gap-2 text-[#75777c] text-xs">
                    <span>
                      UUID: <span className="font-mono text-[#141c27] font-semibold">{selectedCompetency.uuid}</span>
                    </span>
                    <span>•</span>
                    <span>Last reviewed by {selectedCompetency.reviewerCouncil}</span>
                  </div>
                </div>

                {/* Section 1: Rubric Level Descriptors */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141c27] uppercase tracking-wide">
                      Rubric Level Descriptors
                    </span>
                    <span className="text-[11px] text-[#75777c]">3-Tier Progressive</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedCompetency.rubricLevels.map((lvl, index) => (
                      <div
                        key={index}
                        className={`p-3.5 rounded-xl flex flex-col gap-1 border transition-all ${
                          lvl.isHighlighted
                            ? "bg-[#e7deff]/35 border-[#6137e0]/30"
                            : "bg-[#f8f9ff] border-[#dee2ef]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#141c27] flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                lvl.isHighlighted ? "bg-[#6137e0]" : "bg-[#7a55fa]"
                              }`}
                            />
                            {lvl.level}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              lvl.isHighlighted ? "text-[#6137e0]" : "text-[#75777c]"
                            }`}
                          >
                            {lvl.span}
                          </span>
                        </div>
                        <p className="text-xs text-[#45474c] leading-relaxed mt-0.5">
                          {lvl.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Automated Extraction Keywords */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141c27] uppercase tracking-wide">
                      Automated Extraction Keywords
                    </span>
                    <span className="text-[11px] text-[#75777c]">CV &amp; Artifact Parser</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f8f9ff] border border-[#dee2ef]/50 flex flex-wrap gap-1.5">
                    {selectedCompetency.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-white text-[#141c27] font-mono text-xs shadow-2xs border border-[#dee2ef]/60"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Section 3: Recruiter Verification Prompt */}
                <div className="p-4 rounded-xl bg-[#e7deff]/25 border border-[#6137e0]/20 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#6137e0] text-xs font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Recruiter Verification Prompt</span>
                  </div>

                  <p className="text-xs text-[#141c27] italic leading-relaxed">
                    {selectedCompetency.verificationPrompt}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white text-[#6137e0] text-[10px] font-bold shadow-2xs">
                      Source: {selectedCompetency.promptSource}
                    </span>
                    <span className="text-[11px] text-[#75777c]">Requires qualitative justification</span>
                  </div>
                </div>

                {/* Section 4: Action Controls */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => showToast(`Edit rubric schema for ${selectedCompetency.name}`)}
                    className="w-full sm:flex-1 h-10 px-4 rounded-xl bg-[#131c29] text-white hover:bg-[#202d3f] transition-all text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Competency</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => showToast("Audit change history opened.")}
                    className="w-full sm:w-auto h-10 px-4 rounded-xl bg-white text-[#141c27] hover:bg-[#eff4ff] border border-[#dee2ef] transition-colors text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Audit Change History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => showToast(`Archived competency ${selectedCompetency.uuid}`)}
                    className="w-full sm:w-auto h-10 px-3.5 rounded-xl bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] transition-colors text-xs font-semibold flex items-center justify-center cursor-pointer"
                    title="Archive Competency"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Linked Roles Callout Widget */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#dee2ef]/70 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#131c29]">
                    <Briefcase className="w-5 h-5 text-[#6137e0]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#141c27]">
                      {selectedCompetency.reqCount} Requisitions Active
                    </span>
                    <span className="text-[11px] text-[#75777c]">
                      {selectedCompetency.activeRequisitionsList}
                    </span>
                  </div>
                </div>

                <Link
                  href="/jobs"
                  className="px-3 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-semibold transition-colors shrink-0"
                >
                  View Pipeline
                </Link>
              </div>

            </div>
          </div>

          {/* Operational UX Annotation Banner */}
          <div className="w-full p-4 rounded-2xl bg-[#eff4ff] border border-[#dee2ef] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[#45474c] text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#6137e0] shrink-0" />
              <p>
                <strong className="text-[#141c27] font-semibold">System Assurance:</strong> Standardized skills library prevents role calibration drift across hiring managers and enforces inspectable validation criteria during scorecards.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] shrink-0 font-medium">
              <span className="font-mono text-[#141c27]">HASH: 4b901a8f</span>
              <span className="text-[#069669]">Policy Compliance: Active</span>
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

      {/* New Skill Definition Modal */}
      <Dialog open={isNewSkillModalOpen} onOpenChange={setIsNewSkillModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141c27]">
              New Competency Definition
            </DialogTitle>
            <DialogDescription className="text-xs text-[#75777c]">
              Create a calibrated technical skill with rubric levels and extraction tokens.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsNewSkillModalOpen(false);
              showToast("New skill definition published to Taxonomy registry.");
            }}
            className="flex flex-col gap-3.5 mt-3 text-xs"
          >
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Skill Name</label>
              <input
                required
                placeholder="e.g. Distributed Consensus & Raft Protocol"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Domain Category</label>
              <select className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27]">
                <option>Distributed Systems</option>
                <option>Cloud & Infra</option>
                <option>Product Design</option>
                <option>Data & AI</option>
                <option>Security & GRC</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#141c27]">Extraction Tokens (Comma-separated)</label>
              <input
                defaultValue="raft, paxos, consensus, etcd, split-brain"
                className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dee2ef] text-[#141c27] font-mono text-[11px]"
              />
            </div>
            <button
              type="submit"
              className="mt-2 h-10 bg-[#131c29] text-white font-semibold rounded-xl hover:bg-[#202d3f] transition-colors"
            >
              Publish to Registry
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <CoreFooter />
    </div>
  );
}
