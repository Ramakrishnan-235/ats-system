"use client";

import { SymbolIcon } from "@/components/ui/symbol-icon";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { createJobRequisition, getErrorMessage } from "@/lib/api";
import {
  ChevronRight,
  Sparkles,
  HelpCircle,
  Terminal,
  MapPin,
  Clock,
  CheckCircle2,
  Check,
  Plus,
  X,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingUp,
  Brain,
  Shield,
  Briefcase,
  FileText,
} from "lucide-react";

export default function RequisitionStudioPage() {
  const router = useRouter();

  // Active step in stepper
  const [activeStep, setActiveStep] = useState<number>(1);

  // Selected Preset
  const [selectedPreset, setSelectedPreset] = useState<
    "Senior Platform Engineer" | "Lead Product Designer" | "Staff Backend Engineer" | "Custom"
  >("Staff Backend Engineer");

  // Form Fields
  const [jobTitle, setJobTitle] = useState("Staff Backend Engineer · High-Throughput Systems");
  const [department, setDepartment] = useState("Platform & Infrastructure");
  const [reqCode, setReqCode] = useState("REQ-208");
  const [hiringManager, setHiringManager] = useState("Chris Miller · Staff SWE");
  const [recruiterOwner, setRecruiterOwner] = useState("Elena Varga · Lead Recruiter");
  const [employmentType, setEmploymentType] = useState("Full-time · Permanent");
  const [locationPolicy, setLocationPolicy] = useState("London, UK · Hybrid (3d on-site)");
  const [salaryRange, setSalaryRange] = useState("£135,000 - £160,000 + Equity");
  const [minYearsExperience, setMinYearsExperience] = useState(0);

  // Description format toggle
  const [descFormat, setDescFormat] = useState<"structured" | "raw">("structured");
  const [missionNarrative, setMissionNarrative] = useState(
    "As a Staff Backend Engineer for High-Throughput Systems, you will architect, orchestrate, and harden Halden's low-latency settlement pipeline processing over 450,000 requests per second. You will directly guide multi-region failover resilience, eliminate distributed lock contentions, and mentor principal ICs across European engineering pods."
  );

  // Preferred skills chips
  const [preferredSkills, setPreferredSkills] = useState<string[]>([
    "eBPF Trace Tooling",
    "Rust (Systems FFI)",
    "Multi-cloud Terraform",
  ]);
  const [newSkillText, setNewSkillText] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  // Rubric weights
  const [techStackWeight, setTechStackWeight] = useState(40);
  const [archDepthWeight, setArchDepthWeight] = useState(30);
  const [leadershipWeight, setLeadershipWeight] = useState(20);
  const [rampWeight, setRampWeight] = useState(10);

  // Toast / Publishing State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Change preset handler
  const handleSelectPreset = (
    preset: "Senior Platform Engineer" | "Lead Product Designer" | "Staff Backend Engineer" | "Custom"
  ) => {
    setSelectedPreset(preset);
    if (preset === "Staff Backend Engineer") {
      setJobTitle("Staff Backend Engineer · High-Throughput Systems");
      setDepartment("Platform & Infrastructure");
      setReqCode("REQ-208");
      setSalaryRange("£135,000 - £160,000 + Equity");
    } else if (preset === "Senior Platform Engineer") {
      setJobTitle("Senior Platform Engineer · Core Cloud Infras");
      setDepartment("Platform Core");
      setReqCode("REQ-204");
      setSalaryRange("£120,000 - £145,000 + Equity");
    } else if (preset === "Lead Product Designer") {
      setJobTitle("Lead Product Designer · Design Systems");
      setDepartment("Product & Design");
      setReqCode("REQ-108");
      setSalaryRange("£110,000 - £135,000 + Equity");
    }
    showToast(`✓ Applied preset: ${preset}`);
  };

  // Remove preferred skill
  const handleRemoveSkill = (skill: string) => {
    setPreferredSkills((prev) => prev.filter((s) => s !== skill));
  };

  // Add preferred skill
  const handleAddSkill = () => {
    if (newSkillText.trim()) {
      setPreferredSkills((prev) => [...prev, newSkillText.trim()]);
      setNewSkillText("");
      setIsAddingSkill(false);
    }
  };

  // Publish requisition handler
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setToastMessage(null);
    if (!Number.isFinite(minYearsExperience) || minYearsExperience < 0 || minYearsExperience > 100) {
      setPublishError("Minimum experience must be between 0 and 100 years.");
      setIsPublishing(false);
      return;
    }
    try {
      await createJobRequisition({
        title: jobTitle,
        department,
        location: locationPolicy,
        job_description: missionNarrative,
        required_skills: preferredSkills,
        min_years_experience: minYearsExperience,
      });
      showToast(`✓ Requisition Published: ${jobTitle} (${reqCode})`);
      setTimeout(() => {
        router.push("/jobs");
      }, 1200);
    } catch (reason) {
      setPublishError(getErrorMessage(reason));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            {publishError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{publishError}</p>}
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <CheckCircle2 className="w-5 h-5 text-[#7a55fa] shrink-0" />
                <span className="text-xs font-semibold">{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="ml-2 text-[#7b8495] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Top Utility & Breadcrumb Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-1.5 text-xs text-[#45474c] font-medium">
                <Link href="/jobs" className="hover:text-[#171c25] transition-colors">
                  Requisitions
                </Link>
                <SymbolIcon name="chevron_right" className="text-[16px] text-[#75777c]" style={{ fontSize: "16px" }} />
                <span className="text-[#171c25] text-sm sm:text-base font-bold tracking-tight">
                  New Job Requisition
                </span>
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-bold">
                  Draft REQ-208
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#45474c] font-mono text-xs font-medium border border-[#dee2ef]/50">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Auto-saved 42s ago
                </span>
                <button
                  onClick={() => showToast("Help: Step-by-step requisition builder calibrated with Halden leveling rubrics")}
                  className="p-2 rounded-lg text-[#45474c] hover:text-[#171c25] hover:bg-[#e6eefe] transition-colors cursor-pointer"
                  type="button"
                >
                  <SymbolIcon name="help_outline" className="text-[20px]" style={{ fontSize: "20px" }} />
                </button>
              </div>
            </div>

            {/* Stepper Navigation Header */}
            <div className="w-full bg-white rounded-xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Step 1 (Active) */}
                <div
                  onClick={() => setActiveStep(1)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                    activeStep === 1
                      ? "bg-[#eff4ff] border border-[#6137e0]/30 shadow-2xs"
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    1
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-[#6137e0] font-bold tracking-tight">Step 01</span>
                    <span className="text-xs text-[#141c27] font-bold truncate">Role Preset &amp; Basics</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => setActiveStep(2)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                    activeStep === 2
                      ? "bg-[#eff4ff] border border-[#6137e0]/30 shadow-2xs"
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#dbe3f2] text-[#45474c] flex items-center justify-center text-xs font-semibold">
                    2
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-[#45474c] font-medium">Step 02</span>
                    <span className="text-xs text-[#141c27] font-semibold truncate">Skills &amp; Rubric Weighting</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  onClick={() => setActiveStep(3)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                    activeStep === 3
                      ? "bg-[#eff4ff] border border-[#6137e0]/30 shadow-2xs"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#dbe3f2] text-[#45474c] flex items-center justify-center text-xs font-semibold">
                    3
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-[#45474c] font-medium">Step 03</span>
                    <span className="text-xs text-[#141c27] font-semibold truncate">Interview Loop Plan</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div
                  onClick={() => setActiveStep(4)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                    activeStep === 4
                      ? "bg-[#eff4ff] border border-[#6137e0]/30 shadow-2xs"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#dbe3f2] text-[#45474c] flex items-center justify-center text-xs font-semibold">
                    4
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-[#45474c] font-medium">Step 04</span>
                    <span className="text-xs text-[#141c27] font-semibold truncate">Review &amp; Publish</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Workspace Split Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Configuration Workspace (8 cols) */}
              <div className="xl:col-span-8 flex flex-col gap-6">
                {/* Preset Selection Band */}
                <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] text-[#6137e0] font-bold tracking-wider uppercase">
                        Baseline Template
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-[#141c27]">Role Presets</h2>
                    </div>
                    <button
                      onClick={() => showToast("Preset customization: 42 engineering presets mapped in taxonomy")}
                      className="inline-flex items-center gap-1 text-[#6137e0] text-xs font-semibold hover:underline cursor-pointer"
                    >
                      <SymbolIcon name="tune" className="text-[16px]" style={{ fontSize: "16px" }} />
                      Customize Presets
                    </button>
                  </div>
                  <p className="text-xs text-[#45474c] mb-4">
                    Selecting a preset injects standardized core qualifications, rubric scoring factors, and automated assessment criteria.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => handleSelectPreset("Senior Platform Engineer")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedPreset === "Senior Platform Engineer"
                          ? "bg-[#131c29] text-white shadow-xs"
                          : "bg-[#eff4ff] text-[#45474c] hover:bg-[#e6eefe]"
                      }`}
                      type="button"
                    >
                      Senior Platform Engineer
                    </button>

                    <button
                      onClick={() => handleSelectPreset("Lead Product Designer")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedPreset === "Lead Product Designer"
                          ? "bg-[#131c29] text-white shadow-xs"
                          : "bg-[#eff4ff] text-[#45474c] hover:bg-[#e6eefe]"
                      }`}
                      type="button"
                    >
                      Lead Product Designer
                    </button>

                    {/* Selected Preset */}
                    <button
                      onClick={() => handleSelectPreset("Staff Backend Engineer")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all ${
                        selectedPreset === "Staff Backend Engineer"
                          ? "bg-[#131c29] text-white"
                          : "bg-[#eff4ff] text-[#45474c] hover:bg-[#e6eefe]"
                      }`}
                      type="button"
                    >
                      <SymbolIcon name="verified" className="text-[#cbbeff] text-[18px]" style={{ fontSize: "18px" }} />
                      <span>Staff Backend Engineer</span>
                    </button>

                    <button
                      onClick={() => handleSelectPreset("Custom")}
                      className="px-3.5 py-2 rounded-lg bg-[#eff4ff] text-[#45474c] text-xs font-semibold hover:bg-[#e6eefe] transition-all flex items-center gap-1 cursor-pointer"
                      type="button"
                    >
                      <SymbolIcon name="add" className="text-[16px]" style={{ fontSize: "16px" }} />
                      <span>Custom Requisition</span>
                    </button>
                  </div>
                </div>

                {/* Section: Core Details & Calibration Parameters */}
                <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        System Specification
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-[#141c27]">Requisition Core Details</h2>
                    </div>
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#e1e8f8] text-[#45474c] font-semibold">
                      REQ ID: 208-LON
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Job Title */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold flex items-center justify-between">
                        <span>Job Title</span>
                        <span className="text-[#45474c] text-xs font-normal">Internal &amp; External facing</span>
                      </label>
                      <input
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full h-10 px-3 bg-[#eff4ff] text-[#141c27] text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:bg-white border border-transparent focus:border-[#6137e0]/30 transition-colors"
                        type="text"
                      />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Department &amp; Pod</label>
                      <div className="relative">
                        <input
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full h-10 px-3 pr-9 bg-[#eff4ff] text-[#141c27] text-xs sm:text-sm font-medium rounded-lg focus:outline-none focus:bg-white border border-transparent focus:border-[#6137e0]/30 transition-colors"
                          type="text"
                        />
                        <SymbolIcon name="dns" className="absolute right-3 top-2.5 text-[#75777c] text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                    </div>

                    {/* Requisition ID */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Requisition Code</label>
                      <input
                        value={reqCode}
                        readOnly
                        className="w-full h-10 px-3 bg-[#dbe3f2]/60 text-[#45474c] font-mono text-xs rounded-lg cursor-not-allowed font-semibold"
                        type="text"
                      />
                    </div>

                    {/* Hiring Manager with Avatar */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Hiring Manager</label>
                      <div className="h-10 px-3 bg-[#eff4ff] rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#e6eefe] transition-colors border border-transparent">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#6137e0] text-white text-[10px] flex items-center justify-center font-bold">
                            CM
                          </div>
                          <span className="text-xs text-[#141c27] font-medium">
                            {hiringManager}
                          </span>
                        </div>
                        <SymbolIcon name="unfold_more" className="text-[#75777c] text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                    </div>

                    {/* Recruiter Owner */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Recruiter Owner</label>
                      <div className="h-10 px-3 bg-[#eff4ff] rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#e6eefe] transition-colors border border-transparent">
                        <div className="flex items-center gap-2">
                          <img
                            alt="Elena Varga"
                            className="w-6 h-6 rounded-full object-cover"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAb-xhC8Gt5a03IKeWoDmDYIb7OA7BFzq9MsVFM-rwt-YyHrVDJuLTTjQMMaNeKBbZMIHcWMSdXGW10tTDx5ZoEOpjrAMNKkwLFKzPxljc_M-xlr0M99deH89FjCESOhATVNQm1yejVm0SIVwzM5g5adk49UfUM46utSaH31Gn5G5kma9PN7GGOCPqOOJ-w4nct86OTEFn2AEOjFwU9p92xWtXzzqpF_a6NmoRqV7rmUek9kATdvAw3vA"
                          />
                          <span className="text-xs text-[#141c27] font-medium">
                            {recruiterOwner}
                          </span>
                        </div>
                        <SymbolIcon name="unfold_more" className="text-[#75777c] text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                    </div>

                    {/* Employment Type */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="minimum-experience" className="text-xs text-[#141c27] font-bold">Minimum experience (years)</label>
                      <input id="minimum-experience" type="number" min="0" max="100" step="0.5"
                        value={minYearsExperience} onChange={e => setMinYearsExperience(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-[#eff4ff] text-[#141c27] text-xs font-medium rounded-lg focus:outline-none focus:bg-white transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Employment Type</label>
                      <input
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                        className="w-full h-10 px-3 bg-[#eff4ff] text-[#141c27] text-xs font-medium rounded-lg focus:outline-none focus:bg-white transition-colors"
                        type="text"
                      />
                    </div>

                    {/* Location & Policy */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold">Location &amp; Policy</label>
                      <div className="relative">
                        <input
                          value={locationPolicy}
                          onChange={(e) => setLocationPolicy(e.target.value)}
                          className="w-full h-10 px-3 pr-9 bg-[#eff4ff] text-[#141c27] text-xs font-medium rounded-lg focus:outline-none focus:bg-white transition-colors"
                          type="text"
                        />
                        <SymbolIcon name="apartment" className="absolute right-3 top-2.5 text-[#75777c] text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                    </div>

                    {/* Target Compensation Range */}
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs text-[#141c27] font-bold flex items-center justify-between">
                        <span>Target Compensation Range</span>
                        <span className="text-emerald-700 text-xs font-semibold">
                          Benchmarked to 85th Percentile
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          value={salaryRange}
                          onChange={(e) => setSalaryRange(e.target.value)}
                          className="w-full h-10 px-3 pr-9 bg-[#eff4ff] text-[#141c27] text-xs font-bold rounded-lg focus:outline-none focus:bg-white transition-colors"
                          type="text"
                        />
                        <SymbolIcon name="payments" className="absolute right-3 top-2.5 text-[#75777c] text-[18px]" style={{ fontSize: "18px" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Job Description & Essential Impact */}
                <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        Semantic Parse
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-[#141c27]">
                        Job Description &amp; Essential Impact
                      </h2>
                    </div>
                    <div className="flex items-center p-1 bg-[#eff4ff] rounded-lg border border-[#dee2ef]/50">
                      <button
                        onClick={() => setDescFormat("structured")}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          descFormat === "structured"
                            ? "bg-white text-[#141c27] shadow-xs"
                            : "text-[#45474c] hover:text-[#141c27]"
                        }`}
                        type="button"
                      >
                        Structured Spec
                      </button>
                      <button
                        onClick={() => setDescFormat("raw")}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                          descFormat === "raw"
                            ? "bg-white text-[#141c27] shadow-xs"
                            : "text-[#45474c] hover:text-[#141c27]"
                        }`}
                        type="button"
                      >
                        Raw Markdown
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#141c27]">Mission Narrative</span>
                        <span className="text-[11px] text-[#6137e0] font-semibold">4 Critical Deliverables Identified</span>
                      </div>
                      <textarea
                        value={missionNarrative}
                        onChange={(e) => setMissionNarrative(e.target.value)}
                        className="w-full bg-[#eff4ff] text-[#141c27] text-xs p-3.5 rounded-lg leading-relaxed focus:outline-none focus:bg-white border border-[#dee2ef]/40 resize-none"
                        rows={4}
                      />
                    </div>

                    {/* 2 Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <SymbolIcon name="bolt" className="text-[#6137e0] text-[18px]" style={{ fontSize: "18px" }} />
                          <span className="text-xs font-bold text-[#141c27]">P99.9 Sub-5ms SLAs</span>
                        </div>
                        <p className="text-[11px] text-[#45474c] leading-relaxed">
                          Architect memory-safe Go micro-engines on low jitter kernels.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <SymbolIcon name="hub" className="text-[#6137e0] text-[18px]" style={{ fontSize: "18px" }} />
                          <span className="text-xs font-bold text-[#141c27]">Event Bus Hardening</span>
                        </div>
                        <p className="text-[11px] text-[#45474c] leading-relaxed">
                          Design partitioned Kafka streams with idempotent consumers.
                        </p>
                      </div>
                    </div>

                    {/* Transparent Alignment Trail */}
                    <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#dee2ef]/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <SymbolIcon name="verified" className="text-[#6137e0] text-[18px]" style={{ fontSize: "18px" }} />
                        <span className="text-[#45474c]">
                          JD parsed against 14 Halden leveling artifacts to calibrate benchmark skill vectors.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-white text-[#6137e0] font-bold border border-[#dee2ef]">
                          Matrix: L6-ENG
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white text-[#141c27] font-semibold border border-[#dee2ef]">
                          Tier-1 Requisition
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Evaluation Engine Competency Map */}
                <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[10px] text-[#45474c] uppercase tracking-wider font-bold">
                        Evaluation Engine
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-[#141c27]">
                        Required &amp; Preferred Competency Map
                      </h2>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#e7deff] text-[#1e0060] font-mono text-[11px] font-bold">
                      Weighted Scoring Active
                    </span>
                  </div>

                  {/* Required Technical Attributes */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                        Required Technical Attributes
                      </span>
                      <span className="text-[11px] text-[#75777c]">Non-negotiable qualification gates</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Go / Golang</div>
                          <div className="text-[11px] text-[#45474c]">Concurrency channels, memory profiler</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-black text-white font-mono text-[10px] font-bold">
                          Expert
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Distributed Systems / gRPC</div>
                          <div className="text-[11px] text-[#45474c]">Consensus algorithms, Raft, Protobuf</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-black text-white font-mono text-[10px] font-bold">
                          Expert
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Kubernetes</div>
                          <div className="text-[11px] text-[#45474c]">Custom CRDs, CNI, service meshes</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#dbe3f2] text-[#141c27] font-mono text-[10px] font-bold">
                          Proficient
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Kafka Streams</div>
                          <div className="text-[11px] text-[#45474c]">Cluster partitions, replication protocols</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#dbe3f2] text-[#141c27] font-mono text-[10px] font-bold">
                          Proficient
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Preferred & Multiplier Capabilities */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#141c27] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#6137e0]"></span>
                        Preferred &amp; Multiplier Capabilities
                      </span>
                      <span className="text-[11px] text-[#75777c]">Additive evaluation bonus</span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {preferredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 rounded-full bg-[#e7deff] text-[#1e0060] text-xs font-semibold flex items-center gap-1.5"
                        >
                          <span>{skill}</span>
                          <button
                            onClick={() => handleRemoveSkill(skill)}
                            className="hover:bg-[#cbbeff] rounded-full p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      {isAddingSkill ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={newSkillText}
                            onChange={(e) => setNewSkillText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                            placeholder="Skill name..."
                            className="h-8 px-2.5 rounded-lg bg-[#eff4ff] text-xs border border-[#6137e0]/30 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleAddSkill}
                            className="h-8 px-2 rounded-lg bg-[#6137e0] text-white text-xs font-bold"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingSkill(true)}
                          className="px-3 py-1 rounded-full bg-[#eff4ff] hover:bg-[#e6eefe] text-[#141c27] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-[#dee2ef]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Preferred Skill</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidate Scoring Rubric Weights */}
                  <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">Candidate Scoring Rubric Weights</div>
                        <div className="text-[11px] text-[#45474c]">
                          Calibrate how interviewer feedback aggregates into human hiring decisions.
                        </div>
                      </div>
                      <span className="font-mono text-[11px] bg-white px-2.5 py-0.5 rounded font-bold text-[#141c27] border border-[#dee2ef]">
                        Total : 100% Validated
                      </span>
                    </div>

                    {/* Stacked Bar */}
                    <div className="w-full h-3 rounded-full bg-[#dbe3f2] overflow-hidden flex">
                      <div style={{ width: `${techStackWeight}%` }} className="h-full bg-black"></div>
                      <div style={{ width: `${archDepthWeight}%` }} className="h-full bg-[#6137e0]"></div>
                      <div style={{ width: `${leadershipWeight}%` }} className="h-full bg-emerald-600"></div>
                      <div style={{ width: `${rampWeight}%` }} className="h-full bg-[#75777c]"></div>
                    </div>

                    {/* Sliders / Labels */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded bg-white border border-[#dee2ef] flex flex-col">
                        <span className="text-[#45474c] text-[10px] font-semibold">Tech Stack Match</span>
                        <span className="font-bold text-[#141c27] text-sm">{techStackWeight}%</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-[#dee2ef] flex flex-col">
                        <span className="text-[#6137e0] text-[10px] font-semibold">Architecture Depth</span>
                        <span className="font-bold text-[#6137e0] text-sm">{archDepthWeight}%</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-[#dee2ef] flex flex-col">
                        <span className="text-emerald-700 text-[10px] font-semibold">Leadership &amp; Culture</span>
                        <span className="font-bold text-emerald-700 text-sm">{leadershipWeight}%</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-[#dee2ef] flex flex-col">
                        <span className="text-[#45474c] text-[10px] font-semibold">Availability &amp; Ramp</span>
                        <span className="font-bold text-[#141c27] text-sm">{rampWeight}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proposed UX Interaction Flow Note */}
                <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/60 flex items-start gap-3">
                  <SymbolIcon name="lightbulb" className="text-[#6137e0] text-[20px] shrink-0 mt-0.5" style={{ fontSize: "20px" }} />
                  <div>
                    <div className="text-xs font-bold text-[#141c27]">Proposed UX Interaction Flow</div>
                    <p className="text-xs text-[#45474c] mt-0.5 leading-relaxed">
                      Role preset auto-fills standard leveling rubrics and suggests interview loop scorecards. Recruiter and Hiring Manager calibration occurs simultaneously within live sync sessions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Preview Column (4 cols) */}
              <div className="xl:col-span-4 flex flex-col gap-6 sticky top-20">
                {/* Live Job Card Preview */}
                <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#45474c] tracking-wider">
                      Live Job Card Preview
                    </span>
                    <button
                      onClick={() => showToast("Portal view: Live candidate career page preview")}
                      className="text-[10px] uppercase font-bold text-[#6137e0] hover:underline cursor-pointer"
                    >
                      Portal View
                    </button>
                  </div>

                  {/* Card Widget */}
                  <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#dee2ef]/60 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-[#141c27]">
                          <span>Staff Backend Engineer</span>
                          <SymbolIcon name="verified" className="text-[#6137e0] text-[16px]" style={{ fontSize: "16px" }} />
                        </div>
                        <div className="text-xs text-[#45474c] font-medium">High-Throughput Systems</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#45474c] font-medium">
                      <span>Platform &amp; Infra</span>
                      <span>·</span>
                      <span>London · Hybrid</span>
                    </div>

                    <div className="text-xs font-bold text-[#141c27]">£135k – £160k</div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#dee2ef]/60 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#131c29] text-white text-[8px] flex items-center justify-center font-bold">
                            EV
                          </div>
                          <div className="w-5 h-5 rounded-full bg-[#6137e0] text-white text-[8px] flex items-center justify-center font-bold">
                            CM
                          </div>
                          <div className="w-5 h-5 rounded-full bg-[#dbe3f2] text-[#141c27] text-[8px] flex items-center justify-center font-bold">
                            +1
                          </div>
                        </div>
                        <span className="text-[11px] text-[#45474c]">Review Team</span>
                      </div>
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Ready
                      </span>
                    </div>
                  </div>

                  {/* Estimated Sourcing Velocity */}
                  <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#dee2ef]/50 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-[#75777c] font-bold uppercase">Estimated Sourcing Velocity</div>
                      <div className="text-xs font-bold text-[#141c27] mt-0.5">
                        18-24 qualified pipeline matches / wk
                      </div>
                    </div>
                    {/* Sparkline curve SVG */}
                    <svg className="w-16 h-8 text-[#6137e0]" viewBox="0 0 64 32" fill="none">
                      <path
                        d="M2 28 C 12 24, 20 18, 30 19 C 40 20, 48 10, 62 4"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* AI Evidence Seed Matrix */}
                <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <SymbolIcon name="psychology" className="text-[#6137e0] text-[18px]" style={{ fontSize: "18px" }} />
                      <span className="text-xs font-bold text-[#141c27]">AI Evidence Seed Matrix</span>
                    </div>
                    <span className="px-2 py-0.2 rounded-full bg-[#e7deff] text-[#1e0060] font-mono text-[10px] font-bold">
                      5 Points
                    </span>
                  </div>

                  <p className="text-[11px] text-[#45474c] leading-relaxed">
                    The parser synthesizes incoming candidate resumes against these exact structural evidence markers:
                  </p>

                  <div className="flex flex-col gap-2">
                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/40 flex items-start gap-2">
                      <SymbolIcon name="check_circle" className="text-emerald-600 text-[16px] mt-0.5" style={{ fontSize: "16px" }} />
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">Concurrency profiling in Go</div>
                        <div className="text-[10px] text-[#45474c]">Evidence of pprof, mutex contention tuning</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/40 flex items-start gap-2">
                      <SymbolIcon name="check_circle" className="text-emerald-600 text-[16px] mt-0.5" style={{ fontSize: "16px" }} />
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">Scale threshold exceeding 100k RPS</div>
                        <div className="text-[10px] text-[#45474c]">Verified production deployment scale citations</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/40 flex items-start gap-2">
                      <SymbolIcon name="check_circle" className="text-emerald-600 text-[16px] mt-0.5" style={{ fontSize: "16px" }} />
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">Distributed transaction semantics</div>
                        <div className="text-[10px] text-[#45474c]">Saga patterns, outbox model, Kafka replication</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/40 flex items-start gap-2">
                      <SymbolIcon name="check_circle" className="text-emerald-600 text-[16px] mt-0.5" style={{ fontSize: "16px" }} />
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">Technical mentorship footprint</div>
                        <div className="text-[10px] text-[#45474c]">Multi-engineer code reviews &amp; RFC sponsorship</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/40 flex items-start gap-2">
                      <SymbolIcon name="check_circle" className="text-emerald-600 text-[16px] mt-0.5" style={{ fontSize: "16px" }} />
                      <div>
                        <div className="text-xs font-bold text-[#141c27]">On-call rotation leadership</div>
                        <div className="text-[10px] text-[#45474c]">Incident postmortem facilitation record</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interview Loop Pod */}
                <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-3">
                  <div className="text-[10px] uppercase font-bold text-[#45474c] tracking-wider">
                    Interview Loop Pod
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-bold">
                          1
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Screening (Recruiter)</div>
                          <div className="text-[10px] text-[#45474c]">Elena Varga · 30m</div>
                        </div>
                      </div>
                      <SymbolIcon name="drag_handle" className="text-[#75777c] text-[16px]" style={{ fontSize: "16px" }} />
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#6137e0] text-white text-[10px] flex items-center justify-center font-bold">
                          2
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Architecture Deep-Dive</div>
                          <div className="text-[10px] text-[#45474c]">Chris Miller · 60m</div>
                        </div>
                      </div>
                      <SymbolIcon name="drag_handle" className="text-[#75777c] text-[16px]" style={{ fontSize: "16px" }} />
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#eff4ff] border border-[#dee2ef]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-[#131c29] text-white text-[10px] flex items-center justify-center font-bold">
                          3
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141c27]">Distributed Coding (Go)</div>
                          <div className="text-[10px] text-[#45474c]">Marcus Reed (Senior SWE) · 60m</div>
                        </div>
                      </div>
                      <SymbolIcon name="drag_handle" className="text-[#75777c] text-[16px]" style={{ fontSize: "16px" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Action Dock */}
            <div className="sticky bottom-4 z-40 w-full mt-6 bg-white rounded-2xl p-4 sm:p-5 shadow-xl border border-[#dee2ef] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-xs text-[#141c27] font-semibold">
                  Draft configuration healthy | Preset: Staff Backend Engineer (L6)
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/jobs"
                  className="px-4 py-2 rounded-xl bg-[#eff4ff] hover:bg-[#e6eefe] text-[#141c27] text-xs font-semibold transition-colors"
                >
                  Cancel
                </Link>
                <button
                  onClick={() => showToast("✓ Requisition draft saved (Draft REQ-208)")}
                  className="px-4 py-2 rounded-xl border border-[#dee2ef] text-[#141c27] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer"
                  type="button"
                >
                  Save Draft
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-5 py-2 rounded-xl bg-black text-white hover:bg-[#131c29] transition-all shadow-md text-xs font-bold flex items-center gap-2 cursor-pointer"
                  type="button"
                >
                  {isPublishing ? (
                    <>
                      <SymbolIcon name="sync" className="text-[16px] animate-spin" style={{ fontSize: "16px" }} />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <span>Publish Requisition (REQ-208)</span>
                      <SymbolIcon name="arrow_forward" className="text-[17px]" style={{ fontSize: "17px" }} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CoreFooter />
    </>
  );
}
