"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestError } from "@/components/layout/request-error";
import { fetchCandidates, fetchCandidate, uploadAndWait, getErrorMessage } from "@/lib/api";
import type { CandidateDetail, NewCandidatePayload } from "@/types/ats";
export type { NewCandidatePayload };

interface AddCandidateJobModalProps {
  open: boolean; onOpenChange: (open: boolean) => void; jobTitle: string;
  jobId?: string; requiredSkills: string[]; existingCandidateIds?: string[];
  onAddCandidate: (candidate: NewCandidatePayload) => Promise<void>;
}

export function AddCandidateJobModal({ open, onOpenChange, jobTitle, jobId, existingCandidateIds = [], onAddCandidate }: AddCandidateJobModalProps) {
  const [pool, setPool] = useState<CandidateDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [skills, setSkills] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { return () => controller.current?.abort(); }, []);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    fetchCandidates({ include_pii: true })
      .then(data => { if (!disposed) setPool(data); })
      .catch(() => {
        fetchCandidates()
          .then(data => { if (!disposed) setPool(data); })
          .catch(reason => { if (!disposed) setError(getErrorMessage(reason)); });
      });
    return () => { disposed = true; };
  }, [open]);
  const assign = async (candidate: CandidateDetail) => {
    let candidateToAssign = candidate;
    if (candidate.is_pii_masked && candidate.id) {
      try {
        const unmasked = await fetchCandidate(candidate.id, true);
        if (unmasked && !unmasked.is_pii_masked) {
          candidateToAssign = unmasked;
        }
      } catch {
        // Fallback to current candidate if unmasking request fails
      }
    }

    const matchesJob = Boolean(
      jobId && (
        candidateToAssign.applied_for_job_id === jobId ||
        (jobTitle && candidateToAssign.applied_for_job && candidateToAssign.applied_for_job.toLowerCase().includes(jobTitle.toLowerCase()))
      )
    );
    const score = matchesJob ? (candidateToAssign.scorecard?.overall_match_score ?? null) : null;
    const label = matchesJob
      ? (candidateToAssign.scorecard?.match_tier || (score !== null ? "Evaluated" : "Not Evaluated"))
      : "Not Evaluated";

    await onAddCandidate({
      id: candidateToAssign.id,
      name: candidateToAssign.name,
      headline: candidateToAssign.target_headline || candidateToAssign.role,
      avatar: candidateToAssign.avatar,
      skills: candidateToAssign.core_skills,
      stage: "Screening",
      // Match scores belong to the job they were evaluated against.
      matchScore: score,
      matchLabel: label,
      sourceResumeLink: `/candidates/${candidateToAssign.id}`,
    });
  };
  const select = async (candidate: CandidateDetail) => {
    setBusy(true); setError(null);
    try { await assign(candidate); onOpenChange(false); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true); setError(null);
    try {
      const result = await uploadAndWait(file, jobId, pending.signal);
      if (pending.signal.aborted) return;
      const candidate = await fetchCandidate(result.candidate_id, true);
      if (pending.signal.aborted) return;
      if (jobId && !candidate.applied_for_job_id) {
        candidate.applied_for_job_id = jobId;
      }
      if (result.match_score !== null && result.match_score !== undefined && candidate.scorecard) {
        if (candidate.scorecard.overall_match_score === null || candidate.scorecard.overall_match_score === undefined) {
          candidate.scorecard.overall_match_score = result.match_score;
        }
      }
      await assign(candidate);
      onOpenChange(false);
    } catch (reason) { if (!pending.signal.aborted) setError(getErrorMessage(reason)); }
    finally { if (controller.current === pending) { controller.current = null; setBusy(false); } }
  };
  const manual = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await onAddCandidate({ name: name.trim(), headline: headline.trim(), skills: skills.split(",").map(skill => skill.trim()).filter(Boolean), stage: "Screening", matchScore: null });
      setName(""); setHeadline(""); setSkills(""); onOpenChange(false);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };
  const close = (nextOpen: boolean) => {
    if (!nextOpen) { controller.current?.abort(); controller.current = null; setBusy(false); }
    onOpenChange(nextOpen);
  };
  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl bg-white p-6">
    <DialogHeader><DialogTitle>Add candidate to {jobTitle}</DialogTitle><DialogDescription>Select an existing candidate or upload a PDF. New candidates remain unevaluated until job matching completes.</DialogDescription></DialogHeader>
    <RequestError message={error} />
    <section className="space-y-2"><h3 className="font-semibold text-sm">Candidate repository</h3>
      {pool.filter(candidate => !existingCandidateIds.includes(candidate.id)).map(candidate => <div key={candidate.id} className="flex items-center justify-between border rounded-lg p-3 text-sm"><span>{candidate.name}</span><Button disabled={busy} onClick={() => void select(candidate)} size="sm">Add</Button></div>)}
      {pool.length === 0 && <p className="text-xs text-zinc-500">No candidates loaded.</p>}
    </section>
    <section className="space-y-2"><label htmlFor="candidate-resume" className="block text-sm font-semibold">Upload PDF resume</label><input id="candidate-resume" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />{busy && <p role="status" className="text-xs">Waiting for backend processing…</p>}</section>
    <form onSubmit={manual} className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Enter candidate details</h3>
      <Input aria-label="Candidate name" required value={name} onChange={event => setName(event.target.value)} placeholder="Name" />
      <Input aria-label="Candidate headline" required value={headline} onChange={event => setHeadline(event.target.value)} placeholder="Role or headline" />
      <Input aria-label="Candidate skills" value={skills} onChange={event => setSkills(event.target.value)} placeholder="Skills, separated by commas" />
      <Button type="submit" disabled={busy}>Save candidate</Button>
    </form>
  </DialogContent></Dialog>;
}
