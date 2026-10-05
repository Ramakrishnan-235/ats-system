"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { ResumeDropzone } from "@/components/upload/resume-dropzone";
import { ActiveUploadRow } from "@/components/upload/active-upload-row";
import { CompletedUploadRow } from "@/components/upload/completed-upload-row";
import { IssuesRetriesPanel } from "@/components/upload/issues-retries-panel";
import { uploadAndWait, getErrorMessage } from "@/lib/api";
import type { ActiveUpload, CompletedUpload, UploadIssue } from "@/types/ats";

export default function UploadResumesPage() {
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [completedUploads, setCompletedUploads] = useState<CompletedUpload[]>([]);
  const [issues, setIssues] = useState<UploadIssue[]>([]);
  const originals = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const pending = controllers.current;
    const files = originals.current;
    return () => { pending.forEach(controller => controller.abort()); pending.clear(); files.clear(); };
  }, []);

  const processFile = async (file: File, uploadId: string) => {
    const controller = new AbortController();
    controllers.current.set(uploadId, controller);
    originals.current.set(uploadId, file);
    setIssues(previous => previous.filter(issue => issue.id !== uploadId));
    setActiveUploads(previous => [{ id: uploadId, filename: file.name, taskId: "Awaiting backend", statusLabel: "Uploading and processing", progress: 0, currentStep: "Parsing" }, ...previous]);
    const started = performance.now();
    try {
      const result = await uploadAndWait(file, undefined, controller.signal, (task) => {
        setActiveUploads(previous => previous.map(upload => {
          if (upload.id !== uploadId) return upload;
          let step: ActiveUpload["currentStep"] = "Parsing";
          const rawStep = task.step?.toLowerCase() || "";
          if (rawStep.includes("pii") || rawStep.includes("scrub") || rawStep.includes("redact")) step = "PII Scrub";
          else if (rawStep.includes("evaluat") || rawStep.includes("llm") || rawStep.includes("score")) step = "LLM Extract";
          else if (rawStep.includes("index") || rawStep.includes("retriev")) step = "Indexing";
          else if (task.state === "SUCCESS") step = "Done";

          return {
            ...upload,
            taskId: task.task_id || upload.taskId,
            statusLabel: task.step ? `${task.step}...` : (task.state === "PROGRESS" ? "Processing resume..." : upload.statusLabel),
            progress: task.progress ?? (task.state === "SUCCESS" ? 100 : upload.progress),
            currentStep: step,
          };
        }));
      });
      if (controller.signal.aborted) return;
      setCompletedUploads(previous => [{ id: uploadId, filename: file.name, taskId: result.task_id, duration: `${((performance.now() - started) / 1000).toFixed(1)}s`, candidateId: result.candidate_id, evaluationStatus: result.evaluation_status }, ...previous]);
      originals.current.delete(uploadId);
    } catch (error) {
      if (!controller.signal.aborted) setIssues(previous => [{ id: uploadId, filename: file.name, status: "failed", message: getErrorMessage(error) }, ...previous]);
    } finally {
      if (controllers.current.get(uploadId) === controller) {
        controllers.current.delete(uploadId);
        if (!controller.signal.aborted) setActiveUploads(previous => previous.filter(upload => upload.id !== uploadId));
      }
    }
  };
  const cancel = (uploadId: string) => {
    controllers.current.get(uploadId)?.abort();
    controllers.current.delete(uploadId);
    originals.current.delete(uploadId);
    setActiveUploads(previous => previous.filter(upload => upload.id !== uploadId));
    setIssues(previous => previous.filter(issue => issue.id !== uploadId));
  };
  const retry = (uploadId: string) => {
    const file = originals.current.get(uploadId);
    if (file && !controllers.current.has(uploadId)) void processFile(file, uploadId);
  };
  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Upload Resumes" showDateFilter={false} />
        <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-8">
          <p className="text-sm text-zinc-600">Uploads are processed by the backend. Completion confirms ingestion; AI evaluation may remain pending. Cancel stops waiting for a response; processing already received by the server may continue.</p>
          <ResumeDropzone onFilesSelected={files => files.forEach(file => void processFile(file, crypto.randomUUID()))} />
          {activeUploads.length > 0 && <section className="space-y-3"><h2 className="font-bold">Active uploads</h2>{activeUploads.map(upload => <ActiveUploadRow key={upload.id} upload={upload} onCancel={cancel} />)}</section>}
          {completedUploads.length > 0 && <section className="space-y-3"><h2 className="font-bold">Completed</h2>{completedUploads.map(item => <CompletedUploadRow key={item.id} item={item} />)}</section>}
          {issues.length > 0 && <IssuesRetriesPanel issues={issues} onRetry={retry} onCancel={cancel} />}
        </main>
      </div>
    </div>
  );
}
