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
  const currentStepIdx = STEPS.indexOf(
    upload.currentStep as (typeof STEPS)[number]
  );

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex flex-col gap-4">
      {/* Top Row: File info + Status + Cancel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700">
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
      <div className="flex items-center justify-between gap-2 pt-1">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIdx;
          const isActive = idx === currentStepIdx;

          return (
            <div key={step} className="flex items-center gap-1.5">
              {isDone ? (
                <div className="w-3.5 h-3.5 rounded-full border border-zinc-900 flex items-center justify-center text-zinc-900">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              ) : isActive ? (
                <div className="w-3.5 h-3.5 flex items-center justify-center text-zinc-950 animate-pulse">
                  <Disc className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-300">
                  <Circle className="w-2 h-2 text-transparent" />
                </div>
              )}
              <span
                className={`text-[11px] font-medium ${
                  isActive
                    ? "font-bold text-zinc-950"
                    : isDone
                    ? "text-zinc-700"
                    : "text-zinc-400"
                }`}
              >
                {step}
              </span>
              {idx < STEPS.length - 1 && (
                <span className="hidden sm:inline text-zinc-300 mx-1">
                  •••••
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
