import { fetchCandidate, fetchUploadTask, type UploadTask } from "./api";
import type { CandidateDetail } from "@/types/ats";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export async function resumeHash(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Only PDF resumes are supported.");
  if (!file.size || file.size > MAX_RESUME_BYTES) throw new Error("Choose a non-empty PDF up to 10 MB.");
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("This file is not a valid PDF.");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function completedProfile(task: UploadTask): Promise<CandidateDetail> {
  if (task.state !== "SUCCESS" || !task.result?.candidate_id) {
    throw new Error("The backend has not confirmed a completed candidate profile.");
  }
  if (task.result.status === "FAILED") throw new Error("Resume processing failed.");
  const candidate = await fetchCandidate(task.result.candidate_id);
  if (!candidate?.id || candidate.id !== task.result.candidate_id ||
      (candidate.processing_status && candidate.processing_status !== "COMPLETED")) {
    throw new Error("The saved candidate profile is not ready. Check status again.");
  }
  return candidate;
}

function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// A slow worker remains pending. Connection errors never become completion.
export async function monitorIngestion(taskId: string, signal: AbortSignal, onTask: (task: UploadTask) => void | Promise<void>): Promise<void> {
  while (!signal.aborted) {
    const task = await fetchUploadTask(taskId, signal);
    await onTask(task);
    if (["SUCCESS", "FAILURE"].includes(task.state)) return;
    await pause(signal);
  }
}
