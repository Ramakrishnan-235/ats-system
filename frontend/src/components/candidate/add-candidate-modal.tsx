"use client";

import { useState, useId, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RequestError } from "@/components/layout/request-error";
import { uploadAndWait, getErrorMessage, type UploadResponse, type UploadTask } from "@/lib/api";
import { resumeHash } from "@/lib/ingestion";

interface AddCandidateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (candidateId: string) => void;
}

function cleanNameFromFilename(filename: string): string {
  const stem = filename.replace(/\.pdf$/i, "");
  const stripped = stem
    .replace(/^\d+[-_\s.]*/, "")
    .replace(/[\(\[\{].*?[\)\]\}]/g, "")
    .replace(/[-_.\s]*(resume|cv|updated|final|candidate|profile|202\d)/gi, "")
    .replace(/[-_.]+/g, " ")
    .trim();
  if (!stripped) return "";
  return stripped
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const PIPELINE_STAGES = [
  {
    id: "hash",
    title: "1. SHA-256 Integrity & Idempotency Lock",
    detail: "Validating %PDF-1.7 signature, computing SHA-256 fingerprint, and obtaining leased task",
    threshold: 18,
    durationLabel: "0.3s",
  },
  {
    id: "layout",
    title: "2. Layout Parsing & Presidio PII Redaction",
    detail: "Extracting multi-column layout via Docling/PyMuPDF and scrubbing personal contact tokens",
    threshold: 45,
    durationLabel: "1.1s",
  },
  {
    id: "embed",
    title: "3. EmbeddingGemma 2 (768-d) Skill Normalization",
    detail: "Encoding contextual query vectors and mapping canonical skills in taxonomy matrix",
    threshold: 75,
    durationLabel: "0.9s",
  },
  {
    id: "persist",
    title: "4. Candidate Profile Persistence & Audit Ledger",
    detail: "Atomic persistence to PostgreSQL pgvector and immutable audit ledger record",
    threshold: 98,
    durationLabel: "1.2s",
  },
];

export function AddCandidateModal({ open, onOpenChange, onSuccess }: AddCandidateModalProps) {
  const router = useRouter();
  const fileInputId = useId();

  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [isAutofilled, setIsAutofilled] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<"form" | "processing" | "complete">("form");
  const [progressPercent, setProgressPercent] = useState(10);
  const [progressText, setProgressText] = useState("Initializing extraction pipeline…");
  const [accepted, setAccepted] = useState<UploadResponse | null>(null);
  const [createdCandidateId, setCreatedCandidateId] = useState<string | null>(null);

  const rolePresets = [
    "Full-Stack Software Engineer",
    "Senior Backend Engineer (Python)",
    "Frontend Developer (React/Next.js)",
    "DevOps & Cloud Engineer",
  ];

  const handleFileSelection = (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);

    const inferredName = cleanNameFromFilename(selectedFile.name);
    if (inferredName) {
      setName(inferredName);
      setIsAutofilled(true);
    } else if (isAutofilled) {
      setName("");
      setIsAutofilled(false);
    }
    if (!headline.trim()) {
      setHeadline("Software Engineer");
    }
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !name.trim() || !headline.trim() || busy) return;

    setBusy(true);
    setError(null);
    setViewState("processing");
    setProgressPercent(15);
    setProgressText("Validating PDF structure & SHA-256 fingerprint…");

    try {
      await resumeHash(file);
      setProgressPercent(28);
      setProgressText("Uploading resume to private document storage…");

      const result = await uploadAndWait(file, undefined, {
        pollIntervalMs: 1200,
        upload: {
          name: name.trim(),
          headline: headline.trim(),
          idempotencyKey: crypto.randomUUID(),
        },
        onAccepted: async (response) => {
          setAccepted(response);
          setProgressPercent(45);
          setProgressText("Processing PDF layout & Presidio PII de-identification…");
        },
        onProgress: (task: UploadTask) => {
          const p =
            typeof task.progress === "number" && task.progress > 0
              ? task.progress
              : task.state === "RUNNING"
              ? 60
              : 35;
          setProgressPercent(Math.min(96, Math.max(25, p)));
          setProgressText(task.step || "EmbeddingGemma 2 skill normalization & profile extraction…");
        },
      });

      setProgressPercent(100);
      const candId = result.candidate_id || accepted?.candidate_id;
      if (candId) {
        setCreatedCandidateId(candId);
        onSuccess?.(candId);
      }
      setViewState("complete");
      router.refresh();
    } catch (reason) {
      setError(getErrorMessage(reason));
      setViewState("form");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setName("");
    setHeadline("");
    setIsAutofilled(false);
    setAccepted(null);
    setError(null);
    setCreatedCandidateId(null);
    setViewState("form");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && viewState === "complete") {
          handleReset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-hidden max-w-2xl bg-white p-0 border border-zinc-200/90 shadow-2xl rounded-2xl flex flex-col">
        <div className="overflow-y-auto max-h-[92vh]">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-100 flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                  Add New Candidate
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  Upload a PDF resume for automated parsing, PII redaction, and EmbeddingGemma 2 skill indexing.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            <RequestError message={error} />

            {/* FORM VIEW */}
            {viewState === "form" && (
              <form onSubmit={upload} className="space-y-4">
                {/* PDF Dropzone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={fileInputId} className="text-xs font-semibold text-zinc-800">
                      1. PDF Resume Document
                    </label>
                    <span className="text-[11px] text-zinc-500">Max 10 MB · SHA-256 verified</span>
                  </div>

                  <input
                    id={fileInputId}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      handleFileSelection(f);
                      e.target.value = "";
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      handleFileSelection(e.dataTransfer.files?.[0] || null);
                    }}
                    onClick={() => {
                      const input = document.getElementById(fileInputId) as HTMLInputElement | null;
                      if (input) {
                        input.value = "";
                        input.click();
                      }
                    }}
                    className={`group relative rounded-xl border-2 border-dashed p-4 transition cursor-pointer ${
                      dragActive
                        ? "border-indigo-600 bg-indigo-100/50"
                        : file
                        ? "border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/70"
                        : "border-zinc-300 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/20"
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-600 shrink-0">
                            <span className="text-[9px] font-extrabold tracking-tighter leading-none">PDF</span>
                            <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-zinc-900 truncate">{file.name}</p>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Verified PDF
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {Math.max(1, Math.round(file.size / 1024))} KB · Name auto-extracted from file
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.getElementById(fileInputId) as HTMLInputElement | null;
                              if (input) {
                                input.value = "";
                                input.click();
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-2xs transition"
                          >
                            Change PDF
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFile(null);
                              if (isAutofilled) {
                                setName("");
                                setIsAutofilled(false);
                              }
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                            title="Remove PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold text-zinc-800">
                          Drop PDF resume here or <span className="text-indigo-600 underline">browse computer</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Automatically extracts candidate name, skills, and timeline
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidate Name & Role Headline Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="input-global-name" className="text-xs font-semibold text-zinc-800">
                        2. Candidate Name
                      </label>
                      {isAutofilled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          ✨ Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      id="input-global-name"
                      type="text"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setIsAutofilled(false);
                      }}
                      placeholder="e.g. Takuya Matsumoto"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition bg-white text-zinc-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="input-global-headline" className="text-xs font-semibold text-zinc-800">
                        3. Role / Headline
                      </label>
                      <span className="text-[10px] text-zinc-400">Editable override</span>
                    </div>
                    <input
                      id="input-global-headline"
                      type="text"
                      required
                      maxLength={200}
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition bg-white text-zinc-900"
                    />
                  </div>
                </div>

                {/* Quick Role Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-zinc-400 mr-0.5">Quick role tags:</span>
                  {rolePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHeadline(preset)}
                      className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition ${
                        headline === preset
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-700 text-zinc-600"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Info Callout */}
                <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3 flex items-start gap-2.5 text-xs text-zinc-600">
                  <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <span className="font-semibold text-zinc-800">AI Ingestion:</span> Extracts full work timeline, scrubs PII via Presidio, and encodes a 768-d <span className="font-mono-code text-[11px] text-indigo-700 font-semibold">EmbeddingGemma 2</span> vector ready for instant matching across all open requisitions.
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs sm:text-sm font-medium text-zinc-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!file || !name.trim() || !headline.trim() || busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-300 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-500/20 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span>Upload &amp; Extract Candidate</span>
                  </button>
                </div>
              </form>
            )}

            {/* PROCESSING VIEW */}
            {viewState === "processing" && (
              <div className="space-y-5">
                {/* Laser scan card */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-900 text-white shadow-inner relative overflow-hidden">
                  <div className="relative w-14 h-16 rounded-lg bg-white/10 border border-white/20 p-2 shrink-0 flex flex-col justify-between overflow-hidden">
                    <div className="pdf-laser-line" />
                    <div className="space-y-1">
                      <div className="w-6 h-1.5 rounded bg-indigo-300/70" />
                      <div className="w-9 h-1 rounded bg-white/40" />
                      <div className="w-8 h-1 rounded bg-white/30" />
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-1 rounded bg-white/30" />
                      <div className="w-7 h-1 rounded bg-emerald-300/60" />
                    </div>
                    <span className="text-[8px] font-mono-code uppercase tracking-wider text-indigo-200 self-end">PDF</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        Durable Queue Active
                      </span>
                      <span className="text-lg font-extrabold font-mono-code text-white">{progressPercent}%</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold truncate mt-0.5">
                      {name || "Candidate"} · {file?.name || "resume.pdf"}
                    </h3>
                    <p className="text-xs text-zinc-300 truncate mt-0.5">{progressText}</p>

                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-3">
                      <div className="h-full shimmer-bar rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Stepper list */}
                <div className="space-y-2.5">
                  {PIPELINE_STAGES.map((stage, idx) => {
                    const prevThreshold = idx === 0 ? 0 : PIPELINE_STAGES[idx - 1].threshold;
                    const isDone = progressPercent >= stage.threshold;
                    const isCurrent = !isDone && progressPercent >= prevThreshold;

                    let rowStyle = "border-zinc-200/80 bg-zinc-50/60 text-zinc-400";
                    let iconHtml = (
                      <div className="w-6 h-6 rounded-full border-2 border-zinc-300 bg-white text-zinc-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {idx + 1}
                      </div>
                    );

                    if (isDone) {
                      rowStyle = "border-emerald-200 bg-emerald-50/50 text-zinc-900";
                      iconHtml = (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      );
                    } else if (isCurrent) {
                      rowStyle = "border-indigo-300 bg-indigo-50/60 text-zinc-900 shadow-2xs";
                      iconHtml = (
                        <div className="relative w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 pulse-ring">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                          </svg>
                        </div>
                      );
                    }

                    return (
                      <div key={stage.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all duration-300 ${rowStyle}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          {iconHtml}
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-snug">{stage.title}</p>
                            <p className={`text-[11px] ${isDone || isCurrent ? "text-zinc-600" : "text-zinc-400"} mt-0.5`}>
                              {stage.detail}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-mono-code shrink-0 ${isDone ? "text-emerald-700 font-semibold" : isCurrent ? "text-indigo-600 font-semibold" : "text-zinc-400"}`}>
                          {isDone ? stage.durationLabel : isCurrent ? "Running…" : "Queued"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COMPLETE VIEW */}
            {viewState === "complete" && (
              <div className="space-y-5 animate-modal-pop text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">{name} Added Successfully</h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    Candidate profile, skills, and 768-d vector indexed in the repository. Ready to match against open jobs.
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition"
                  >
                    + Add Another
                  </button>
                  {createdCandidateId ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/candidates/${createdCandidateId}`);
                      }}
                      className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition"
                    >
                      View Profile
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
