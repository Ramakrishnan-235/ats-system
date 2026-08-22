"use client";

import React, { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

interface ResumeDropzoneProps {
  onFilesSelected: (files: File[]) => void;
}

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
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
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
      className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
        isDragOver
          ? "border-zinc-950 bg-zinc-100/80 scale-[1.005]"
          : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50/50"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 mb-3 shadow-xs">
        <UploadCloud className="w-6 h-6" />
      </div>

      <h3 className="text-sm font-bold text-zinc-900">
        Drag & drop PDF resumes here
      </h3>
      <p className="text-xs text-zinc-500 mt-1">
        <span className="font-medium underline decoration-zinc-400 underline-offset-2">
          Browse Files
        </span>{" "}
        • multi-upload supported
      </p>
    </div>
  );
}
