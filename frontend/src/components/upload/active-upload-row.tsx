"use client";

import React from "react";
import { FileText, X, Check, Circle, Disc } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ActiveUpload } from "@/types/ats";

interface ActiveUploadRowProps {
  upload: ActiveUpload;
  onCancel?: (id: string) => void;
}

const STEPS = ["Parsing", "PII Scrub", "LLM Extract", "Indexing", "Done"] as const;

export function ActiveUploadRow({ upload, onCancel }: ActiveUploadRowProps) {
  const currentStepClean = upload.currentStep.replace("Image OCR", "Parsing").replace("Docx Parse", "Parsing");
  const currentStepIdx = STEPS.indexOf(
    currentStepClean as (typeof STEPS)[number]
  );

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex flex-col gap-4">
      {/* Top Row: File info + Status + Cancel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-700 border border-red-200/80">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-zinc-950">
                {upload.filename}
              </span>
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border border-zinc-200">
                {upload.taskId}
              </span>
              <span className="bg-red-50 text-red-700 border border-red-200/60 text-[9px] font-bold px-1.5 py-0.5 rounded">
                PDF
              </span>
            </div>
            <span className="text-[11px] font-bold text-zinc-500 tracking-wide uppercase">
              {upload.statusLabel}
            </span>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={() => onCancel(upload.id)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <Progress
        value={upload.progress}
        className="h-1.5 bg-zinc-100"
        indicatorClassName="bg-zinc-950"
      />

      {/* Step Pipeline Indicators */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {STEPS.map((step, idx) => {
          const isCompleted = currentStepIdx > idx || upload.progress >= (idx + 1) * 20;
          const isCurrent = currentStepIdx === idx && upload.progress < 100;
          const displayStepName = idx === 0 ? "PDF Parse" : step;

          return (
            <div
              key={step}
              className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                isCompleted
                  ? "text-zinc-900"
                  : isCurrent
                  ? "text-zinc-950 font-bold"
                  : "text-zinc-400"
              }`}
            >
              {isCompleted ? (
                <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
              ) : isCurrent ? (
                <Disc className="w-4 h-4 text-black animate-spin shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-300 shrink-0" />
              )}
              <span className="truncate">{displayStepName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
