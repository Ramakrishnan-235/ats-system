"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import {
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  UserPlus,
  CheckCheck,
  History,
  Forward,
  Filter,
  Layers,
  Sparkles,
  Shield,
  Briefcase,
  FileText,
  Pause,
  Slash,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  FolderOpen,
} from "lucide-react";

interface InboxTask {
  id: string;
  taskId: string;
  title: string;
  candidateName: string;
  candidateRole: string;
  candidateSummary: string;
  candidateAvatar?: string;
  reqCode: string;
  reqTitle: string;
  priorityLabel: string;
  priorityColor: string;
  categoryLabel: string;
  categoryColor: string;
  initialInitials: string;
  stageNote: string;
  actionText: string;
  dueText: string;
}

export default function RecruiterInboxPage() {
  const router = useRouter();

  // Active task selection
  const [activeTaskId, setActiveTaskId] = useState<string>("task-mv");

  // Filter tabs
  const [activeScopeTab, setActiveScopeTab] = useState<"Mine" | "Team" | "Completed">("Mine");
  const [selectedCategoryChip, setSelectedCategoryChip] = useState<string>("All Types");

  // Selection checkboxes
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);

  // Selected pipeline stage in decision card
  const [selectedStage, setSelectedStage] = useState<"advance" | "hold" | "reject">("advance");

  // Briefing note
  const [briefingNote, setBriefingNote] = useState(
    "Candidate has exceptional Kubernetes multi-region experience. Recommend Chris Miller focus the 45m screen specifically on p99 distributed consensus protocols and failure recovery patterns."
  );

  // Toast / Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(
    "Task auto-sync ready. Real-time inbox synchronizes candidate stage updates across interviewers."
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const tasks: InboxTask[] = [
    {
      id: "task-mv",
      taskId: "8812",
      title: "Stage Transition: Marcus Vance",
      candidateName: "Marcus Vance",
      candidateRole: "Senior Platform Engineer • Direct Referral (GitHub Verified)",
      candidateSummary: "11y platform exp • Ex-Stripe Platform Core • London (Hybrid)",
      candidateAvatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCATJkY5iNt20HC1IM1IsubCQVOR5Pj3eQQ3GmFffu0eqmpXutFTqkO74_Lju-g2-0UTTDyPhJEhgNtqXt3ql578_6X1vud5HQJUx1SamdRyngg0tHr83xF1Y5y6QSG6D3_W6mRr0WQcIBAMG3dMp6v0YtEQoLzRzo26EebJUVr8Gjvwy-3ZCz0W0opo-ScBs3P8u0wgRuhl9u7fOayou_XtUpj0a3JPPfS5x90TwVzbQPl7I0Q1z9oLQ",
      reqCode: "Req-204",
      reqTitle: "Staff Platform Eng",
      priorityLabel: "Overdue: 2h ago",
      priorityColor: "text-red-700 bg-red-100",
      categoryLabel: "Recruiter Review",
      categoryColor: "text-[#6137e0] bg-[#e7deff]/70",
      initialInitials: "MV",
      stageNote: "Awaiting Adv. to Screen",
      actionText: "Inspect Proof",
      dueText: "Overdue",
    },
    {
      id: "task-cm",
      taskId: "8813",
      title: "Scorecard Missing: Chris Miller",
      candidateName: "David K.",
      candidateRole: "Candidate: David K. • Technical Systems Architecture Round",
      candidateSummary: "Panelist: Chris Miller (Senior Architect) • Stage: Tech Screen",
      reqCode: "Req-204",
      reqTitle: "Senior Platform Eng",
      priorityLabel: "Due: 17:00 Today",
      priorityColor: "text-[#141c27] bg-[#dbe3f2]",
      categoryLabel: "Feedback Reminder",
      categoryColor: "text-[#45474c] bg-[#eff4ff]",
      initialInitials: "CM",
      stageNote: "Panelist: Senior Architect",
      actionText: "Send Nudge",
      dueText: "Due Today",
    },
    {
      id: "task-ps",
      taskId: "8814",
      title: "Review Inbound Referral: Priya Sharma",
      candidateName: "Priya Sharma",
      candidateRole: "Lead Product Designer • Referred by VP Design (H. Tanaka)",
      candidateSummary: "Design Systems & Trader Workstation UX • Portfolio link attached",
      reqCode: "Req-188",
      reqTitle: "Lead Product Designer",
      priorityLabel: "Due: Today",
      priorityColor: "text-[#141c27] bg-[#dbe3f2]",
      categoryLabel: "New Applicant",
      categoryColor: "text-emerald-800 bg-emerald-100",
      initialInitials: "PS",
      stageNote: "Portfolio link attached",
      actionText: "Initial Screen",
      dueText: "Due Today",
    },
    {
      id: "task-lc",
      taskId: "8815",
      title: "Client Submission Feedback: Halden FinTech",
      candidateName: "Liam Chen",
      candidateRole: "Candidate: Liam Chen • Shortlist Package Stage",
      candidateSummary: "Agency Submission Review • Client: VP Risk Ops",
      reqCode: "Req-312",
      reqTitle: "FinTech Core",
      priorityLabel: "Due: Tomorrow",
      priorityColor: "text-[#45474c] bg-[#dbe3f2]",
      categoryLabel: "Agency Review",
      categoryColor: "text-[#45474c] bg-[#eff4ff]",
      initialInitials: "LC",
      stageNote: "Client: VP Risk Ops",
      actionText: "Pending Client Signoff",
      dueText: "Due Tomorrow",
    },
  ];

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedTaskIds({});
      setSelectAll(false);
    } else {
      const all: Record<string, boolean> = {};
      tasks.forEach((t) => {
        all[t.id] = true;
      });
      setSelectedTaskIds(all);
      setSelectAll(true);
    }
  };

  const handleToggleTask = (id: string) => {
    setSelectedTaskIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const activeTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  const handleCompleteTask = () => {
    showToast(`✓ Task for ${activeTask.candidateName} completed successfully!`);
    const currentIndex = tasks.findIndex((t) => t.id === activeTaskId);
    const nextTask = tasks[(currentIndex + 1) % tasks.length];
    setActiveTaskId(nextTask.id);
  };

  return (
    <>
      <CoreHeader />

      <main className="w-full pt-16 bg-[#f8f9ff] min-h-[calc(100vh-4rem)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full pb-16">
            {/* Toast Feedback State Preview (Dismissible / Action Triggered) */}
            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-50 bg-[#131c29] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#6137e0]/40 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <CheckCircle2 className="w-5 h-5 text-[#7a55fa] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Task auto-sync ready</span>
                  <span className="text-[11px] text-[#bec7d9]">{toastMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="ml-2 text-[#7b8495] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Primary Workspace Content */}
            <div className="flex flex-col gap-5 w-full">
              {/* Header Section with Metainfo */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#6137e0] font-bold bg-[#e7deff] px-2 py-0.5 rounded-full">
                      Recruitment Operations
                    </span>
                    <span className="text-[#c5c6cc] text-xs">•</span>
                    <span className="text-xs text-[#45474c] font-mono font-medium">Sync ID: #INB-7729</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#141c27] tracking-tight">
                    Recruiter Inbox
                  </h1>
                  <p className="text-xs sm:text-sm text-[#45474c] max-w-2xl">
                    Pending candidate reviews, interview feedback requests, and hiring committee sign-offs with evidence-backed audit trails.
                  </p>
                </div>

                {/* Quick Metrics Counter Strip */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70">
                  <div className="px-3.5 py-1.5 flex flex-col text-left">
                    <span className="text-[10px] text-[#45474c] uppercase font-bold tracking-wider">Urgent</span>
                    <span className="text-base font-bold text-red-600 flex items-center gap-1">
                      2 <span className="text-xs">!</span>
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[#e1e8f8]"></div>
                  <div className="px-3.5 py-1.5 flex flex-col text-left">
                    <span className="text-[10px] text-[#45474c] uppercase font-bold tracking-wider">Mine Today</span>
                    <span className="text-base font-bold text-[#141c27]">4</span>
                  </div>
                  <div className="w-px h-8 bg-[#e1e8f8]"></div>
                  <div className="px-3.5 py-1.5 flex flex-col text-left">
                    <span className="text-[10px] text-[#45474c] uppercase font-bold tracking-wider">Cleared</span>
                    <span className="text-base font-bold text-emerald-700">12</span>
                  </div>
                </div>
              </div>

              {/* Filter Control Module & Bulk Actions Bar */}
              <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 p-4 flex flex-col gap-4">
                {/* Upper Filter Row: Main View Scope Tabs & Quick Category Chips */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* View Scope Tabs */}
                  <div className="flex items-center gap-1 bg-[#e6eefe] p-1 rounded-lg self-start">
                    <button
                      onClick={() => setActiveScopeTab("Mine")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeScopeTab === "Mine"
                          ? "bg-white text-[#141c27]"
                          : "text-[#45474c] hover:text-[#141c27]"
                      }`}
                      type="button"
                    >
                      <span>Mine</span>
                      <span className="h-4 px-1.5 rounded-full bg-[#6137e0] text-white text-[10px] font-bold flex items-center justify-center">
                        4
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveScopeTab("Team")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeScopeTab === "Team"
                          ? "bg-white text-[#141c27] shadow-xs"
                          : "text-[#45474c] hover:text-[#141c27]"
                      }`}
                      type="button"
                    >
                      <span>Team</span>
                      <span className="h-4 px-1.5 rounded-full bg-[#dbe3f2] text-[#45474c] text-[10px] font-bold flex items-center justify-center">
                        9
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveScopeTab("Completed")}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeScopeTab === "Completed"
                          ? "bg-white text-[#141c27] shadow-xs"
                          : "text-[#45474c] hover:text-[#141c27]"
                      }`}
                      type="button"
                    >
                      <span>Completed Today</span>
                      <span className="h-4 px-1.5 rounded-full bg-[#dbe3f2] text-[#45474c] text-[10px] font-bold flex items-center justify-center">
                        12
                      </span>
                    </button>
                  </div>

                  {/* Quick Filters Chips */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                    {[
                      { name: "All Types", isUrgent: false },
                      { name: "Due / Overdue (2)", isUrgent: true },
                      { name: "Stage Transitions", isUrgent: false },
                      { name: "Scorecard Feedback", isUrgent: false },
                      { name: "Client Approvals", isUrgent: false },
                    ].map((chip) => {
                      const isSelected = selectedCategoryChip === chip.name;
                      return (
                        <button
                          key={chip.name}
                          onClick={() => setSelectedCategoryChip(chip.name)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-[#000000] text-white shadow-xs"
                              : chip.isUrgent
                              ? "bg-red-100 text-red-900 hover:bg-red-200"
                              : "bg-[#e6eefe] text-[#45474c] hover:text-[#141c27]"
                          }`}
                          type="button"
                        >
                          {chip.isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>}
                          <span>{chip.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lower Filter Bar: Bulk Action Controls & Operational Tools */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#dee2ef]/40">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        checked={selectAll}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded bg-[#dbe3f2] accent-[#000000] cursor-pointer"
                        type="checkbox"
                      />
                      <span className="text-xs text-[#45474c] font-medium">Select All In View (4)</span>
                    </label>
                    <div className="h-4 w-px bg-[#dbe3f2] hidden sm:block"></div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => showToast("Selected tasks marked as complete")}
                        className="px-2.5 py-1 bg-[#e6eefe] hover:bg-[#dee2ef] text-[#141c27] rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        type="button"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark Complete</span>
                      </button>
                      <button
                        onClick={() => showToast("Reassign task dialog ready")}
                        className="px-2.5 py-1 bg-[#e6eefe] hover:bg-[#dee2ef] text-[#141c27] rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        type="button"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Reassign Owner</span>
                      </button>
                      <button
                        onClick={() => showToast("Tasks snoozed for 4 hours")}
                        className="px-2.5 py-1 bg-[#e6eefe] hover:bg-[#dee2ef] text-[#141c27] rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        type="button"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Snooze</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-[#45474c]">
                    <span>
                      Sorting: <strong className="text-[#141c27] font-semibold">Priority &amp; Due Date</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Structured Split Inbox Layout: Left (Tasks) & Right (Evidence Workspace) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN: Task List Feed (4 items for Elena Varga) */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  {tasks.map((task) => {
                    const isSelected = activeTaskId === task.id;
                    const isChecked = Boolean(selectedTaskIds[task.id]);

                    return (
                      <div
                        key={task.id}
                        onClick={() => setActiveTaskId(task.id)}
                        className={`rounded-xl p-4 cursor-pointer relative transition-all duration-150 border ${
                          isSelected
                            ? "bg-white border-[#6137e0]/50 shadow-md ring-1 ring-[#6137e0]/30"
                            : "bg-white border-[#dee2ef]/70 shadow-xs hover:border-[#dee2ef] hover:shadow-sm"
                        }`}
                      >
                        {/* Active state marker accent */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#6137e0] rounded-l-xl"></div>
                        )}

                        <div className="flex items-start justify-between gap-2 pl-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleTask(task.id);
                              }}
                              className="w-3.5 h-3.5 rounded accent-[#000000] cursor-pointer"
                            />
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${task.priorityColor}`}
                            >
                              {task.priorityLabel}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${task.categoryColor}`}>
                              {task.categoryLabel}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[#75777c] font-medium">{task.reqCode}</span>
                        </div>

                        <div className="mt-2.5 pl-1">
                          <h3 className="text-sm font-bold text-[#141c27] tracking-tight">{task.title}</h3>
                          <p className="text-xs text-[#45474c] mt-0.5 line-clamp-1">{task.candidateRole}</p>
                        </div>

                        <div className="mt-3.5 pl-1 pt-1 flex items-center justify-between border-t border-[#dee2ef]/40">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#131c29] text-white flex items-center justify-center text-[10px] font-bold">
                              {task.initialInitials}
                            </div>
                            <span className="text-xs text-[#141c27] font-medium">{task.stageNote}</span>
                          </div>

                          <div className="flex items-center gap-1 text-[#6137e0] text-xs font-bold hover:underline">
                            <span>{task.actionText}</span>
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Feed Footnote & Queue Status */}
                  <div className="p-3 rounded-lg bg-[#e6eefe] text-center text-xs text-[#45474c] border border-[#dee2ef]/40">
                    Showing 4 prioritized recruiter items for{" "}
                    <span className="text-[#141c27] font-bold">Elena Varga</span>.
                  </div>
                </div>

                {/* RIGHT COLUMN: Evidence-Backed Task Review Workspace */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  {/* Task Header & Meta Context */}
                  <div className="bg-white rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-[#dee2ef]/40">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6137e0] bg-[#e7deff] px-2 py-0.5 rounded">
                          Action Required
                        </span>
                        <span className="font-mono text-xs text-[#75777c] font-medium">
                          TASK-ID: {activeTask.taskId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showToast("Snoozing task")}
                          className="text-[#75777c] hover:text-[#141c27] p-1.5 rounded hover:bg-[#eff4ff] cursor-pointer"
                          title="Snooze Task"
                          type="button"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => showToast("Forwarding to hiring manager")}
                          className="text-[#75777c] hover:text-[#141c27] p-1.5 rounded hover:bg-[#eff4ff] cursor-pointer"
                          title="Reassign"
                          type="button"
                        >
                          <Forward className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => showToast("Viewing audit log history")}
                          className="text-[#75777c] hover:text-[#141c27] p-1.5 rounded hover:bg-[#eff4ff] cursor-pointer"
                          title="History Log"
                          type="button"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[#141c27] tracking-tight">
                        Review Application &amp; Decide Stage Transition
                      </h2>
                      <p className="text-xs sm:text-sm text-[#45474c] mt-1 leading-relaxed">
                        Verify validated engineering proof metrics against Staff Platform Engineer criteria before releasing to interview panel.
                      </p>
                    </div>

                    {/* Candidate Hero Dossier Snapshot */}
                    <div className="bg-[#eff4ff] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-[#dee2ef]/60">
                      <div className="flex items-center gap-3.5">
                        <img
                          className="w-14 h-14 rounded-xl object-cover shadow-xs shrink-0 ring-1 ring-[#dee2ef]"
                          alt={activeTask.candidateName}
                          src={
                            activeTask.candidateAvatar ||
                            "https://lh3.googleusercontent.com/aida-public/AB6AXuCATJkY5iNt20HC1IM1IsubCQVOR5Pj3eQQ3GmFffu0eqmpXutFTqkO74_Lju-g2-0UTTDyPhJEhgNtqXt3ql578_6X1vud5HQJUx1SamdRyngg0tHr83xF1Y5y6QSG6D3_W6mRr0WQcIBAMG3dMp6v0YtEQoLzRzo26EebJUVr8Gjvwy-3ZCz0W0opo-ScBs3P8u0wgRuhl9u7fOayou_XtUpj0a3JPPfS5x90TwVzbQPl7I0Q1z9oLQ"
                          }
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-bold text-[#141c27]">
                              {activeTask.candidateName}
                            </h3>
                            <CheckCircle2 className="w-4 h-4 text-[#6137e0]" />
                          </div>
                          <span className="text-xs text-[#45474c]">{activeTask.candidateSummary}</span>
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            <span className="text-[10px] bg-white text-[#141c27] px-2 py-0.5 rounded font-bold shadow-2xs border border-[#dee2ef]/50">
                              Distributed Systems
                            </span>
                            <span className="text-[10px] bg-white text-[#141c27] px-2 py-0.5 rounded font-bold shadow-2xs border border-[#dee2ef]/50">
                              Kubernetes Operators
                            </span>
                            <span className="text-[10px] bg-white text-[#141c27] px-2 py-0.5 rounded font-bold shadow-2xs border border-[#dee2ef]/50">
                              Golang
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end shrink-0">
                        <span className="text-[10px] text-[#75777c] uppercase font-bold tracking-wider">
                          Requisition Target
                        </span>
                        <span className="text-base font-bold text-[#141c27]">{activeTask.reqCode}</span>
                        <span className="text-xs text-[#6137e0] bg-[#e7deff] px-2 py-0.5 rounded font-bold mt-1">
                          {activeTask.reqTitle}
                        </span>
                      </div>
                    </div>

                    {/* Structured Evidence & Reasoning Block */}
                    <div className="rounded-xl p-4 bg-[#e7deff]/25 border border-[#cbbeff]/50 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#6137e0]" />
                          <span className="text-xs sm:text-sm text-[#6137e0] font-bold">
                            Verified Reasoning &amp; Evidence Extracts
                          </span>
                        </div>
                        <span className="text-xs text-[#45474c] font-medium">Req-204 Rubric Alignment</span>
                      </div>
                      <p className="text-xs text-[#141c27] leading-relaxed">
                        Synthesized from direct git commits, public whitepaper co-authorship, and corporate references. All claims grounded with citation links.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                        {/* Evidence 1 */}
                        <div className="bg-white rounded-lg p-3 shadow-2xs border border-[#dee2ef]/60 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[#45474c]">
                              <span className="text-[10px] font-bold uppercase text-[#6137e0] tracking-wider">
                                Production Scale
                              </span>
                              <span className="text-[10px] bg-[#eff4ff] px-1.5 py-0.5 rounded font-mono text-[#141c27]">
                                GitHub PR #149
                              </span>
                            </div>
                            <p className="text-xs text-[#141c27] mt-1.5 leading-snug">
                              Orchestrated multi-region rollout spanning 350+ Kubernetes bare-metal nodes with zero down-time migration.
                            </p>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-[#dee2ef]/50 flex items-center justify-between">
                            <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Rubric Exceeded</span>
                            </span>
                            <Link href="/candidates/cand-mv" className="text-[#6137e0] text-xs font-bold hover:underline">
                              Verify Line 44
                            </Link>
                          </div>
                        </div>

                        {/* Evidence 2 */}
                        <div className="bg-white rounded-lg p-3 shadow-2xs border border-[#dee2ef]/60 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between text-[#45474c]">
                              <span className="text-[10px] font-bold uppercase text-[#6137e0] tracking-wider">
                                Latency Optimization
                              </span>
                              <span className="text-[10px] bg-[#eff4ff] px-1.5 py-0.5 rounded font-mono text-[#141c27]">
                                Scorecard P.3
                              </span>
                            </div>
                            <p className="text-xs text-[#141c27] mt-1.5 leading-snug">
                              Refactored internal gRPC gateway achieving p99 response times drop from 82ms to 14ms across financial trading queues.
                            </p>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-[#dee2ef]/50 flex items-center justify-between">
                            <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Rubric Satisfied</span>
                            </span>
                            <Link href="/candidates/cand-mv" className="text-[#6137e0] text-xs font-bold hover:underline">
                              Verify Extract
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Quantitative Synthesis Gauge */}
                      <div className="bg-white rounded-lg p-3 shadow-2xs border border-[#dee2ef]/60 mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#131c29] text-[#cbbeff] flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-[#6137e0]/30">
                            94%
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#141c27]">
                              Structured Criteria Match: 94 / 100
                            </span>
                            <span className="text-[11px] text-[#45474c]">
                              Meets 6 of 6 hard constraints defined by Hiring Manager (Sarah Jenkins)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-semibold text-[#45474c] bg-[#eff4ff] px-2 py-1 rounded">
                            Notice: 30 days
                          </span>
                          <span className="text-[10px] font-semibold text-[#45474c] bg-[#eff4ff] px-2 py-1 rounded">
                            Comp: In-Band
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Recruiter Decision Panel Form */}
                    <div className="flex flex-col gap-3 pt-1">
                      <span className="text-xs sm:text-sm text-[#141c27] font-bold">Choose Pipeline Next Stage</span>

                      {/* Quick Stage Selector Segmented Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <label
                          onClick={() => setSelectedStage("advance")}
                          className="cursor-pointer"
                        >
                          <div
                            className={`rounded-xl p-3 transition-all flex flex-col h-full shadow-2xs border ${
                              selectedStage === "advance"
                                ? "bg-[#000000] text-white border-[#000000]"
                                : "bg-[#eff4ff] text-[#141c27] border-[#dee2ef]/70 hover:bg-[#dee2ef]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <ArrowRight className="w-4 h-4" />
                              <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                                {selectedStage === "advance" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs font-bold mt-2">Advance to Technical Screen</span>
                            <span className="text-[11px] opacity-80 mt-0.5">Assign to Chris Miller</span>
                          </div>
                        </label>

                        <label
                          onClick={() => setSelectedStage("hold")}
                          className="cursor-pointer"
                        >
                          <div
                            className={`rounded-xl p-3 transition-all flex flex-col h-full shadow-2xs border ${
                              selectedStage === "hold"
                                ? "bg-[#000000] text-white border-[#000000]"
                                : "bg-[#eff4ff] text-[#141c27] border-[#dee2ef]/70 hover:bg-[#dee2ef]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Pause className="w-4 h-4" />
                              <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                                {selectedStage === "hold" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs font-bold mt-2">Hold in Talent Pool</span>
                            <span className="text-[11px] opacity-80 mt-0.5">Archive for Q3 Platform expansion</span>
                          </div>
                        </label>

                        <label
                          onClick={() => setSelectedStage("reject")}
                          className="cursor-pointer"
                        >
                          <div
                            className={`rounded-xl p-3 transition-all flex flex-col h-full shadow-2xs border ${
                              selectedStage === "reject"
                                ? "bg-red-700 text-white border-red-700"
                                : "bg-[#eff4ff] text-[#141c27] border-[#dee2ef]/70 hover:bg-red-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Slash className="w-4 h-4" />
                              <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                                {selectedStage === "reject" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs font-bold mt-2">Reject Candidate</span>
                            <span className="text-[11px] opacity-80 mt-0.5">Send friendly constructive feedback</span>
                          </div>
                        </label>
                      </div>

                      {/* Notes & Next Steps Field */}
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#45474c] font-semibold">
                            Interviewer Briefing Note (Attached to Screen Invitation)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setBriefingNote(
                                "Auto-calibrated L6 Focus: Evaluate Marcus on p99 gRPC tail-latency optimizations, bare-metal k8s scheduler tuning, and team mentorship."
                              );
                              showToast("Rubric brief regenerated from candidate evidence!");
                            }}
                            className="text-xs text-[#6137e0] font-bold cursor-pointer hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Regenerate Rubric Brief</span>
                          </button>
                        </div>
                        <textarea
                          value={briefingNote}
                          onChange={(e) => setBriefingNote(e.target.value)}
                          rows={3}
                          className="w-full bg-[#eff4ff] text-[#141c27] rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#6137e0]/40 border border-[#dee2ef]/70 leading-relaxed shadow-inner"
                        ></textarea>
                      </div>

                      {/* Final Workflow Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <Link
                          href="/candidates/cand-mv"
                          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#dee2ef] text-[#141c27] text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-[#dee2ef]/50"
                        >
                          <FolderOpen className="w-4 h-4 text-[#75777c]" />
                          <span>View Full Candidate File</span>
                        </Link>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={handleCompleteTask}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#dbe3f2] hover:bg-[#dee2ef] text-[#141c27] text-xs font-bold transition-colors cursor-pointer"
                            type="button"
                          >
                            Complete Task
                          </button>
                          <button
                            onClick={handleCompleteTask}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#000000] hover:bg-[#131c29] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                            type="button"
                          >
                            <span>Save &amp; Next Task</span>
                            <span className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">
                              ⌘↵
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cross-Functional Team Activity Stream for Context */}
                  <div className="bg-white rounded-xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#dee2ef]/70 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#141c27]">Audit Activity on Marcus Vance</span>
                      <span className="text-[11px] text-[#45474c] font-medium">Real-time sync active</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between py-1.5 bg-[#eff4ff] px-3 rounded-lg border border-[#dee2ef]/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs text-[#141c27]">
                            Elena Varga verified GitHub public repositories
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#75777c]">Today, 10:14</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 bg-[#eff4ff] px-3 rounded-lg border border-[#dee2ef]/50">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-[#6137e0]" />
                          <span className="text-xs text-[#141c27]">
                            Referral questionnaire completed by Sarah Jenkins
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#75777c]">Yesterday, 16:45</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CoreFooter />
    </>
  );
}
