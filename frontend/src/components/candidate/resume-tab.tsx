"use client";

import React from "react";
import { CandidateDetail, CitationLocation } from "@/types/ats";
import { InteractivePdfViewer } from "@/components/candidate/interactive-pdf-viewer";

interface ResumeTabProps {
  candidate: CandidateDetail;
  activeCitation?: CitationLocation | null;
  onClearCitation?: () => void;
}

export function ResumeTab({
  candidate,
  activeCitation,
  onClearCitation,
}: ResumeTabProps) {
  return (
    <InteractivePdfViewer
      candidate={candidate}
      activeCitation={activeCitation}
      onClearCitation={onClearCitation}
    />
  );
}
