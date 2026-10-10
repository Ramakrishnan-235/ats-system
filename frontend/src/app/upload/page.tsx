"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { ResumeDropzone } from "@/components/upload/resume-dropzone";
import { ActiveUploadRow } from "@/components/upload/active-upload-row";
import { CompletedUploadRow } from "@/components/upload/completed-upload-row";
import { IssuesRetriesPanel } from "@/components/upload/issues-retries-panel";
import { uploadAndWait, getErrorMessage, fetchJobs } from "@/lib/api";
import type { ActiveUpload, CompletedUpload, UploadIssue, JobRequisition } from "@/types/ats";

export default function UploadResumesPage() {
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [completedUploads, setCompletedUploads] = useState<CompletedUpload[]>([]);
  const [issues, setIssues] = useState<UploadIssue[]>([]);
  const [jobs, setJobs] = useState<JobRequisition[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [jobsError, setJobsError] = useState<string | null>(null);
  const uploadJobs = useRef(new Map<string, string>());
  useEffect(() => {
    let disposed = false;
    fetchJobs({ status: "OPEN" }).then(data => { if (!disposed) setJobs(data); })
      .catch(error => { if (!disposed) setJobsError(getErrorMessage(error)); });
    return () => { disposed = true; };
  }, []);
  const originals = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const pending = controllers.current;
    const files = originals.current;
    return () => { pending.forEach(controller => controller.abort()); pending.clear(); files.clear(); };
  }, []);

  const processFile = async (file: File, uploadId: string, jobId = selectedJob) => {
    const controller = new AbortController();
    controllers.current.set(uploadId, controller);
    originals.current.set(uploadId, file);
    uploadJobs.current.set(uploadId, jobId);
    setIssues(previous => previous.filter(issue => issue.id !== uploadId));
    setActiveUploads(previous => [{ id: uploadId, filename: file.name, taskId: "Awaiting backend", statusLabel: "Uploading and processing", progress: 0, currentStep: "Parsing" }, ...previous]);
    const started = performance.now();
    try {
      const result = await uploadAndWait(file, jobId || undefined, controller.signal, (task) => {
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
            statusLabel: task.step === "Parsing" ? (jobId ? "Extracting resume and assessing job match…" : "Extracting resume details…") : (task.step ? `${task.step}…` : "Waiting for processing…"),
            progress: task.progress ?? (task.state === "SUCCESS" ? 100 : upload.progress),
            currentStep: step,
          };
        }));
      });
      if (controller.signal.aborted) return;
      setCompletedUploads(previous => [{ id: uploadId, filename: file.name, taskId: result.task_id, duration: `${((performance.now() - started) / 1000).toFixed(1)}s`, candidateId: result.candidate_id, evaluationStatus: result.evaluation_status, matchScore: result.match_score }, ...previous]);
      originals.current.delete(uploadId);
      uploadJobs.current.delete(uploadId);
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
    uploadJobs.current.delete(uploadId);
    setActiveUploads(previous => previous.filter(upload => upload.id !== uploadId));
    setIssues(previous => previous.filter(issue => issue.id !== uploadId));
  };
  const retry = (uploadId: string) => {
    const file = originals.current.get(uploadId);
    if (file && !controllers.current.has(uploadId)) void processFile(file, uploadId, uploadJobs.current.get(uploadId) || "");
  };
  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Upload Resumes" showDateFilter={false} />
        <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-8">
          <section className="space-y-2">
            <label htmlFor="upload-job" className="block text-sm font-semibold">Score against a job</label>
            <select id="upload-job" value={selectedJob} onChange={event => setSelectedJob(event.target.value)} className="w-full border border-zinc-200 bg-white rounded-lg p-3 text-sm">
              <option value="">Candidate pool — extract details without a match score</option>
              {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
            <p className="text-sm text-zinc-600">Choose a job to receive a match score. Processing can take a few minutes. You can stop waiting while processing continues.</p>
            {jobsError && <p role="alert" className="text-sm text-red-600">Could not load jobs: {jobsError}</p>}
          </section>
          <ResumeDropzone onFilesSelected={files => files.forEach(file => void processFile(file, crypto.randomUUID()))} />
          {activeUploads.length > 0 && <section className="space-y-3"><h2 className="font-bold">Active uploads</h2>{activeUploads.map(upload => <ActiveUploadRow key={upload.id} upload={upload} onCancel={cancel} />)}</section>}
          {completedUploads.length > 0 && <section className="space-y-3"><h2 className="font-bold">Completed</h2>{completedUploads.map(item => <CompletedUploadRow key={item.id} item={item} />)}</section>}
          {issues.length > 0 && <IssuesRetriesPanel issues={issues} onRetry={retry} onCancel={cancel} />}
        </main>
      </div>
    </div>
  );
}
