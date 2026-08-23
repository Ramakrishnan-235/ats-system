"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon, FileCode } from "lucide-react";

interface ResumeDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"];

export function ResumeDropzone({ onFilesSelected }: ResumeDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => {
      const name = f.name.toLowerCase();
      return (
        ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
        f.type.startsWith("image/") ||
        f.type === "application/pdf" ||
        f.type.includes("word")
      );
    });
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
        isDragOver
          ? "border-zinc-950 bg-zinc-100/80 scale-[1.005]"
          : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50/50"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.tiff,.bmp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-800 mb-3 shadow-xs">
        <UploadCloud className="w-6 h-6" />
      </div>

      <h3 className="text-sm font-bold text-zinc-950">
        Drag & drop Resumes (PDF, Word DOCX, PNG/JPG Images)
      </h3>
      <p className="text-xs text-zinc-500 mt-1">
        <span className="font-semibold underline decoration-zinc-400 underline-offset-2">
          Browse Files
        </span>{" "}
        • Supports multi-file background batch ingestion
      </p>

      {/* Format Supported Badges */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-100 flex-wrap justify-center">
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
          <FileText className="w-3 h-3" />
          <span>PDF Documents</span>
        </span>
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
          <FileCode className="w-3 h-3" />
          <span>Word DOCX</span>
        </span>
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md">
          <ImageIcon className="w-3 h-3" />
          <span>Image OCR (PNG / JPG)</span>
        </span>
      </div>
    </div>
  );
}
