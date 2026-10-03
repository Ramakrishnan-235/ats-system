"use client";
import { FileText, LoaderCircle, X } from "lucide-react";
import type { ActiveUpload } from "@/types/ats";
export function ActiveUploadRow({ upload, onCancel }: { upload: ActiveUpload; onCancel?: (id: string) => void }) {
  return <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-3">
    <FileText className="w-5 h-5" /><div className="flex-1"><p className="text-sm font-bold">{upload.filename}</p><p className="text-xs text-zinc-500" role="status">{upload.statusLabel}</p></div><LoaderCircle className="w-4 h-4 animate-spin" />
    {onCancel && <button onClick={() => onCancel(upload.id)} aria-label={`Cancel waiting for ${upload.filename}`} className="p-2"><X className="w-4 h-4" /></button>}
  </div>;
}
