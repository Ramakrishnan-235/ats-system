"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { ResumeDropzone } from "@/components/upload/resume-dropzone";
import { ActiveUploadRow } from "@/components/upload/active-upload-row";
import { CompletedUploadRow } from "@/components/upload/completed-upload-row";
import { IssuesRetriesPanel } from "@/components/upload/issues-retries-panel";
import { uploadResumeFile } from "@/lib/api";
import {
  MOCK_ACTIVE_UPLOADS,
  MOCK_COMPLETED_UPLOADS,
  MOCK_ISSUES,
} from "@/lib/mock-data";
import { ActiveUpload, CompletedUpload, UploadIssue } from "@/types/ats";

export default function UploadResumesPage() {
  const [activeUploads, setActiveUploads] =
    useState<ActiveUpload[]>(MOCK_ACTIVE_UPLOADS);
  const [completedUploads, setCompletedUploads] =
    useState<CompletedUpload[]>(MOCK_COMPLETED_UPLOADS);
  const [issues, setIssues] = useState<UploadIssue[]>(MOCK_ISSUES);

  const handleFilesSelected = async (files: File[]) => {
    for (const file of files) {
      const newUploadId = `up-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const newActive: ActiveUpload = {
        id: newUploadId,
        filename: file.name,
        taskId: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
        statusLabel: "PROCESSING • 10%",
        progress: 10,
        currentStep: "Parsing",
      };

      setActiveUploads((prev) => [newActive, ...prev]);

      // Call API
      uploadResumeFile(file).then((res) => {
        // Simulate step progression
        setTimeout(() => {
          setActiveUploads((prev) =>
            prev.map((item) =>
              item.id === newUploadId
                ? {
                    ...item,
                    currentStep: "PII Scrub",
                    progress: 40,
                    statusLabel: "SCRUBBING PII • 40%",
                  }
                : item
            )
          );
        }, 1200);

        setTimeout(() => {
          setActiveUploads((prev) =>
            prev.map((item) =>
              item.id === newUploadId
                ? {
                    ...item,
                    currentStep: "LLM Extract",
                    progress: 75,
                    statusLabel: "LLM EXTRACT • 75%",
                  }
                : item
            )
          );
        }, 2500);

        setTimeout(() => {
          setActiveUploads((prev) =>
            prev.map((item) =>
              item.id === newUploadId
                ? {
                    ...item,
                    currentStep: "Indexing",
                    progress: 95,
                    statusLabel: "INDEXING • 95%",
                  }
                : item
            )
          );
        }, 3800);

        setTimeout(() => {
          // Move to completed
          setActiveUploads((prev) => prev.filter((item) => item.id !== newUploadId));
          setCompletedUploads((prev) => [
            {
              id: `comp-${Date.now()}`,
              filename: file.name,
              taskId: res.task_id || newActive.taskId,
              duration: "4.8s",
              candidateId: res.candidate_id || res.id || `cand-${Date.now()}`,
            },
            ...prev,
          ]);
        }, 4800);
      });
    }
  };

  const handleCancelActive = (id: string) => {
    setActiveUploads((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRetryIssue = (id: string) => {
    const issue = issues.find((i) => i.id === id);
    if (issue) {
      setIssues((prev) => prev.filter((i) => i.id !== id));
      handleFilesSelected([new File(["demo pdf content"], issue.filename, { type: "application/pdf" })]);
    }
  };

  const handleCancelIssue = (id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search candidates..." />

        <main className="flex-1 p-8 max-w-5xl w-full mx-auto space-y-8">
          {/* Breadcrumb & Title */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 tracking-wider uppercase mb-1">
              <span>ATS</span>
              <span>›</span>
              <span className="text-zinc-800">CANDIDATES</span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">
              Upload Resumes
            </h1>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              High-accuracy PDF resume ingestion processed asynchronously — PII is redacted before AI analysis.
            </p>
          </div>

          {/* Large Dropzone */}
          <ResumeDropzone onFilesSelected={handleFilesSelected} />

          {/* Section: Active Uploads */}
          {activeUploads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-zinc-950">
                  Active Uploads
                </span>
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 font-bold text-[11px] flex items-center justify-center">
                  {activeUploads.length}
                </span>
              </div>

              <div className="space-y-3">
                {activeUploads.map((upload) => (
                  <ActiveUploadRow
                    key={upload.id}
                    upload={upload}
                    onCancel={handleCancelActive}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section: Completed */}
          {completedUploads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-zinc-950">
                  Completed
                </span>
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 font-bold text-[11px] flex items-center justify-center">
                  {completedUploads.length}
                </span>
              </div>

              <div className="space-y-3">
                {completedUploads.map((item) => (
                  <CompletedUploadRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Section: Issues & Retries */}
          <IssuesRetriesPanel
            issues={issues}
            onRetry={handleRetryIssue}
            onCancel={handleCancelIssue}
          />
        </main>
      </div>
    </div>
  );
}
