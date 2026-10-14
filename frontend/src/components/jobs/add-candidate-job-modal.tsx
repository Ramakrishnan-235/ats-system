"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestError } from "@/components/layout/request-error";
import { fetchCandidates, uploadAndWait, getErrorMessage, type UploadResponse, type UploadTask } from "@/lib/api";
import { completedProfile, monitorIngestion, resumeHash } from "@/lib/ingestion";
import type { CandidateDetail, NewCandidatePayload } from "@/types/ats";
export type { NewCandidatePayload };

interface AddCandidateJobModalProps {
  open: boolean; onOpenChange: (open: boolean) => void; jobTitle: string;
  jobId: string; requiredSkills: string[]; existingCandidateIds?: string[];
  onAddCandidate: (candidate: NewCandidatePayload) => Promise<void>;
  onCandidatesChanged: (candidateId: string) => Promise<void>;
}

export function AddCandidateJobModal(props: AddCandidateJobModalProps) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl bg-white p-6">
      <DialogHeader>
        <DialogTitle>Add candidate to {props.jobTitle}</DialogTitle>
        <DialogDescription>Select from Candidates or upload a new resume for this job.</DialogDescription>
      </DialogHeader>
      {props.open && <CandidatePicker {...props} />}
    </DialogContent>
  </Dialog>;
}

function CandidatePicker({ jobId, jobTitle, existingCandidateIds = [], onAddCandidate, onCandidatesChanged, onOpenChange }: AddCandidateJobModalProps) {
  const [pool, setPool] = useState<CandidateDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState<UploadResponse | null>(null);
  const [progress, setProgress] = useState("Uploading resume…");
  const [taskFailed, setTaskFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    fetchCandidates({ include_pii: true }).catch(() => fetchCandidates()).then(data => {
      if (active) setPool(data);
    }).catch(reason => { if (active) setPoolError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.current?.abort(); };
  }, []);

  const available = pool.filter(candidate => !existingCandidateIds.includes(candidate.id));
  const visible = available.filter(candidate => [candidate.name, candidate.target_headline, candidate.role, ...(candidate.core_skills || [])].join(" ").toLowerCase().includes(search.trim().toLowerCase()));

  const select = async (candidate: CandidateDetail) => {
    setBusy(true); setError(null);
    try {
      // The backend links the canonical candidate and owns this job's score.
      await onAddCandidate({ id: candidate.id, name: candidate.name, headline: candidate.target_headline || candidate.role, stage: "Screening", matchScore: null });
      onOpenChange(false);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };

  const finished = async (task: UploadTask, signal: AbortSignal) => {
    if (task.state === "FAILURE") {
      setTaskFailed(true);
      throw new Error(task.error || "Resume processing failed. The candidate may still appear in the job for review.");
    }
    if (task.state !== "SUCCESS") return;
    const candidate = await completedProfile(task);
    if (signal.aborted) return;
    await onCandidatesChanged(candidate.id);
    if (signal.aborted) return;
    if (task.result?.evaluation_status !== "COMPLETED" || typeof task.result.match_score !== "number") {
      setError("Resume processed and candidate added. AI scoring did not complete. Use Calculate AI score on the candidate to try again.");
      return;
    }
    onOpenChange(false);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !name.trim() || !headline.trim() || busy) return;
    const pending = new AbortController(); controller.current = pending;
    setBusy(true); setError(null); setTaskFailed(false); setProgress("Validating PDF…");
    try {
      await resumeHash(file);
      if (pending.signal.aborted) return;
      setProgress("Uploading resume…");
      const result = await uploadAndWait(file, jobId, {
        signal: pending.signal, pollIntervalMs: 1500,
        upload: { name: name.trim(), headline: headline.trim(), idempotencyKey: requestKey.current },
        onAccepted: async response => {
          if (pending.signal.aborted) return;
          setAccepted(response);
          setProgress("Resume received. Waiting for backend processing…");
          await onCandidatesChanged(response.candidate_id);
        },
        onProgress: task => { if (!pending.signal.aborted) setProgress((task.step || task.state) + (typeof task.progress === "number" ? " · " + task.progress + "%" : "")); },
      });
      if (!pending.signal.aborted) await finished({ state: "SUCCESS", task_id: result.task_id, result }, pending.signal);
    } catch (reason) { if (!pending.signal.aborted) setError(getErrorMessage(reason)); }
    finally { if (controller.current === pending) { controller.current = null; setBusy(false); } }
  };

  const checkStatus = async () => {
    if (!accepted?.task_id || busy) return;
    const pending = new AbortController(); controller.current = pending;
    setBusy(true); setError(null);
    try {
      await monitorIngestion(accepted.task_id, pending.signal, async task => {
        if (pending.signal.aborted) return;
        setProgress(task.step || task.state);
        await finished(task, pending.signal);
      });
    } catch (reason) { if (!pending.signal.aborted) setError(getErrorMessage(reason)); }
    finally { if (controller.current === pending) { controller.current = null; setBusy(false); } }
  };

  return <div className="space-y-4">
    <div className="flex gap-2 border-b pb-3">
      <Button type="button" variant={tab === "existing" ? "default" : "outline"} disabled={busy} onClick={() => setTab("existing")}>From Candidates</Button>
      <Button type="button" variant={tab === "new" ? "default" : "outline"} disabled={busy} onClick={() => setTab("new")}>New candidate & resume</Button>
    </div>
    <RequestError message={error} />
    {tab === "existing" ? <section className="space-y-3">
      <Input aria-label="Search candidate repository" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, role, or skills…" />
      <RequestError message={poolError} />
      {loading ? <p role="status" className="text-sm text-zinc-500">Loading candidates…</p> : <>
        <p className="text-xs text-zinc-500">{visible.length} available candidates. Existing resumes and profile details are reused.</p>
        <div className="max-h-72 overflow-y-auto overscroll-contain space-y-2">
          {visible.map(candidate => <div key={candidate.id} className="flex items-start justify-between gap-3 border rounded-xl p-3 text-sm">
            <div className="min-w-0 space-y-1">
              <Link href={`/candidates/${candidate.id}`} className="font-semibold hover:underline">{candidate.name}</Link>
              <p className="text-xs text-zinc-600">{candidate.target_headline || candidate.role || "Role not specified"}</p>
              <p className="text-xs text-zinc-500">{candidate.core_skills?.slice(0, 5).join(" · ") || "No extracted skills yet"}</p>
              <p className="text-[11px] text-zinc-500">Resume processing: {candidate.processing_status || "Not reported"}</p>
            </div>
            <Button type="button" disabled={busy} onClick={() => void select(candidate)} size="sm">Add to job</Button>
          </div>)}
          {!visible.length && <p className="text-sm text-zinc-500 py-4">{pool.length && !available.length ? "All candidates are already linked to this job." : "No matching candidates found."}</p>}
        </div>
        <p className="text-xs text-zinc-500">After adding an unscored candidate, use Calculate AI score to evaluate their resume against {jobTitle}.</p>
      </>}
    </section> : <form onSubmit={upload} className="space-y-4">
      <div className="space-y-1"><label htmlFor="new-candidate-name" className="text-sm font-semibold">Candidate name</label><Input id="new-candidate-name" required maxLength={200} disabled={busy || !!accepted} value={name} onChange={event => { setName(event.target.value); requestKey.current = crypto.randomUUID(); }} placeholder="Full name" /></div>
      <div className="space-y-1"><label htmlFor="new-candidate-role" className="text-sm font-semibold">Candidate role / headline</label><Input id="new-candidate-role" required maxLength={200} disabled={busy || !!accepted} value={headline} onChange={event => { setHeadline(event.target.value); requestKey.current = crypto.randomUUID(); }} placeholder="e.g. Backend Engineer" /></div>
      <div className="space-y-1"><label htmlFor="new-candidate-resume" className="block text-sm font-semibold">PDF resume</label><input id="new-candidate-resume" type="file" required accept=".pdf,application/pdf" disabled={busy || !!accepted} onChange={event => { setFile(event.target.files?.[0] || null); requestKey.current = crypto.randomUUID(); }} /><p className="text-xs text-zinc-500">Up to 10 MB. This resume is processed and scored against {jobTitle}.</p></div>
      {busy && <p role="status" className="text-sm text-[#6137e0]">{progress}</p>}
      {accepted ? <div className="space-y-2"><p className="text-xs text-zinc-500">The resume was received by the server. Closing this dialog does not cancel backend processing.</p><Button type="button" disabled={busy || taskFailed} onClick={() => void checkStatus()}>Check processing status</Button><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Return to job</Button></div> : <Button type="submit" disabled={busy || !file}>Upload resume & calculate score</Button>}
    </form>}
  </div>;
}
