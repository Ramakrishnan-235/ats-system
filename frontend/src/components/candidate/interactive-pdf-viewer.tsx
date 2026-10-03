"use client";

import { useEffect, useState } from "react";
import type { CandidateDetail, CitationLocation } from "@/types/ats";
import { fetchResumePdf, getErrorMessage } from "@/lib/api";
import { RequestError } from "@/components/layout/request-error";

export function InteractivePdfViewer({ candidate, activeCitation, onClearCitation }: {
  candidate: CandidateDetail; activeCitation?: CitationLocation | null; onClearCitation?: () => void;
}) {
  const [pdf, setPdf] = useState<{ candidateId: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => {
    if (!showOriginal) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetchResumePdf(candidate.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setPdf({ candidateId: candidate.id, url: objectUrl });
      setError(null);
    }).catch(reason => { if (!controller.signal.aborted) setError(getErrorMessage(reason)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [candidate.id, showOriginal]);
  const pdfUrl = showOriginal && pdf?.candidateId === candidate.id ? pdf.url : null;
  return <section className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
    <div className="flex justify-between items-center"><h3 className="text-sm font-bold">Resume evidence</h3><button className="text-xs underline" onClick={() => setShowOriginal(previous => !previous)}>{showOriginal ? "Show extracted text" : "Load original PDF"}</button></div>
    <RequestError message={error} />
    {activeCitation && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
      <p>Backend located evidence on page {activeCitation.page}.</p><blockquote>{activeCitation.text_snippet}</blockquote>
      {activeCitation.bbox && <p>Page coordinates (%): x {activeCitation.bbox.x}, y {activeCitation.bbox.y}, width {activeCitation.bbox.width}, height {activeCitation.bbox.height}.</p>}
      <button onClick={onClearCitation} className="underline">Clear citation</button>
    </div>}
    {showOriginal ? <>
      <p className="text-xs text-zinc-600">The original PDF may contain personal information. It is fetched with your session credential.</p>
      {pdfUrl ? <><a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Open original PDF</a><iframe src={`${pdfUrl}#page=${activeCitation?.page || 1}`} title="Original resume PDF" className="w-full h-[750px] border rounded-lg" /></> : !error && <p role="status" className="text-sm">Loading original PDF…</p>}
    </> : <pre className="whitespace-pre-wrap text-xs leading-relaxed max-h-[750px] overflow-auto">{candidate.raw_text || "No extracted resume text is available for this candidate."}</pre>}
  </section>;
}
