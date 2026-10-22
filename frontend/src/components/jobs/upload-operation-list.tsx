import type { ProcessingStage, UploadTask } from "@/lib/api";

export const UPLOAD_OPERATIONS = [
  ["upload", "Upload & PDF validation"],
  ["document_verification", "Read & verify stored resume"],
  ["pdf_parsing", "Load parser & read PDF text"],
  ["pii_redaction", "Protect personal information"],
  ["profile_extraction", "Extract candidate profile"],
  ["skill_normalization", "Normalize skills"],
  ["profile_sanitization", "Validate & anonymize profile"],
  ["document_embedding", "Create search embedding"],
  ["llm_evaluation", "AI evaluation & citation checks"],
  ["saving_results", "Save profile & evaluation"],
] as const;

export function observedDuration(stage: ProcessingStage | undefined, serverTime?: string): string {
  if (!stage?.started_at) return "";
  const end = stage.finished_at || serverTime;
  if (!end) return "";
  const elapsed = Date.parse(end) - Date.parse(stage.started_at);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "";
  const seconds = elapsed / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function operationSnapshot(task: UploadTask | null, upload: ProcessingStage | null) {
  const stages: Record<string, ProcessingStage> = { ...task?.stages, ...(upload ? { upload } : {}) };
  const finished = Object.values(stages).filter(stage => stage.status !== "RUNNING").length;
  const active = UPLOAD_OPERATIONS.find(([id]) => stages[id]?.status === "RUNNING");
  let title = active?.[1] || task?.step || "Uploading resume";
  if (task?.state === "PENDING") title = "Queued — waiting for a worker";
  if (task?.state === "FAILURE") title = "Processing stopped — review the reported error";
  if (task?.state === "SUCCESS") title = "Processing finished";
  if (active && !["SUCCESS", "FAILURE"].includes(task?.state || "") && stages[active[0]]?.detail === "LOCAL_EXTRACTION") title = "Extracting profile locally";
  return { stages, finished, total: UPLOAD_OPERATIONS.length, title };
}

const STATUS_LABELS = {
  RUNNING: "Running", COMPLETED: "Completed", FAILED: "Unavailable",
  SKIPPED: "Skipped", FALLBACK: "Local fallback",
};
const DETAILS: Record<string, string> = {
  LOCAL_EXTRACTION: "Using local extraction",
  LLM_DISABLED: "AI extraction is disabled",
  EMBEDDINGS_DISABLED: "Search embeddings are disabled",
  MODEL_UNAVAILABLE: "The model did not return a usable result",
  NO_JOB: "No target job was selected",
};

export function UploadOperationList({ task, upload }: { task: UploadTask | null; upload: ProcessingStage | null }) {
  const { stages } = operationSnapshot(task, upload);
  return <ol aria-label="Live resume processing operations" className="space-y-1.5">
    {UPLOAD_OPERATIONS.map(([id, title], index) => {
      const stage = stages[id];
      const running = stage?.status === "RUNNING" && task?.state !== "FAILURE";
      const failed = stage?.status === "FAILED" || (stage?.status === "RUNNING" && task?.state === "FAILURE");
      const done = stage?.status === "COMPLETED";
      const duration = observedDuration(stage, id === "upload" ? new Date().toISOString() : task?.server_time);
      return <li key={id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
        running ? "border-indigo-300 bg-indigo-50" : failed ? "border-amber-200 bg-amber-50" : done ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-zinc-50/50"
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${running ? "animate-pulse bg-indigo-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>{done ? "✓" : failed ? "!" : index + 1}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-900">{title}</p>
            {stage?.detail && DETAILS[stage.detail] && <p className="text-[11px] text-zinc-500">{DETAILS[stage.detail]}</p>}
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-zinc-600">{failed ? "Unavailable" : stage ? STATUS_LABELS[stage.status] : "Waiting"}{duration ? ` · ${duration}` : ""}</span>
      </li>;
    })}
  </ol>;
}
