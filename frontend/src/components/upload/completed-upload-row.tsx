import React from "react";
import Link from "next/link";
import { FileText, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompletedUpload } from "@/types/ats";

interface CompletedUploadRowProps {
  item: CompletedUpload;
}

export function CompletedUploadRow({ item }: CompletedUploadRowProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex items-center justify-between gap-4">
      {/* File Details */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200/70 flex items-center justify-center text-zinc-700">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-zinc-950">
              {item.filename}
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              Complete
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            {item.taskId} • Processed in {item.duration}
          </p>
        </div>
      </div>

      {/* Action CTA */}
      <Link href={`/candidates/${item.candidateId}`}>
        <Button
          variant="pill"
          size="sm"
          className="h-8 text-xs font-semibold gap-1 px-4"
        >
          <span>View Candidate Profile</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    </div>
  );
}
