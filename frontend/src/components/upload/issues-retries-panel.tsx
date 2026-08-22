"use client";

import React from "react";
import { RefreshCw, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadIssue } from "@/types/ats";

interface IssuesRetriesPanelProps {
  issues: UploadIssue[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function IssuesRetriesPanel({
  issues,
  onRetry,
  onCancel,
}: IssuesRetriesPanelProps) {
  return (
    <div className="space-y-3">
      <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
        ISSUES & RETRIES
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {issues.map((issue) => {
          const isFailed = issue.status === "failed";

          return (
            <div
              key={issue.id}
              className={`rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[140px] border ${
                isFailed
                  ? "bg-[#fff5f5] border-red-200/80 text-red-950"
                  : "bg-white border-zinc-200/80 text-zinc-950"
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                {isFailed ? (
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0 animate-spin">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-xs">{issue.filename}</h4>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isFailed ? "text-red-700 font-medium" : "text-zinc-600"
                    }`}
                  >
                    {issue.message}
                  </p>
                  {issue.nextRetryIn && (
                    <span className="text-[11px] text-zinc-400 block mt-1">
                      Next retry in {issue.nextRetryIn}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200/40">
                {isFailed ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-zinc-600 hover:text-zinc-900 px-3"
                    >
                      View Logs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry && onRetry(issue.id)}
                      className="h-7 text-xs font-semibold gap-1 px-3 border-red-200 hover:bg-red-50 text-red-700"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancel && onCancel(issue.id)}
                    className="h-7 text-xs font-medium px-3 text-zinc-700 border-zinc-200"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
