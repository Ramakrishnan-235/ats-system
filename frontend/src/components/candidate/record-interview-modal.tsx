"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { CandidateDetail, InterviewRecord } from "@/types/ats";
import { getErrorMessage, recordCandidateInterview } from "@/lib/api";

interface RecordInterviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDetail | null;
  onSuccess: (interviews: InterviewRecord[]) => void;
  onError: (errorMessage: string) => void;
}

export function RecordInterviewModal({
  isOpen,
  onOpenChange,
  candidate,
  onSuccess,
  onError,
}: RecordInterviewModalProps) {
  const [interviewRound, setInterviewRound] = useState("Technical Architecture Screen");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewOutcome, setInterviewOutcome] = useState("SCHEDULED");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => {
        setInterviewRound("Technical Architecture Screen");
        setInterviewDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
        setInterviewerName("Lead Engineer");
        setInterviewOutcome("SCHEDULED");
        setInterviewFeedback("");
      });
    }
  }, [isOpen]);

  const handleRecordInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !candidate.applied_for_job_id) {
      onError("Please select an active target job requisition to record an interview.");
      return;
    }
    setIsSaving(true);
    try {
      const records = await recordCandidateInterview(candidate.applied_for_job_id, candidate.id, {
        round: interviewRound,
        scheduled_at: interviewDate || new Date().toISOString(),
        interviewer_name: interviewerName.trim() || "Recruitment Panel",
        outcome: interviewOutcome,
        feedback: interviewFeedback.trim() || undefined,
      });
      onSuccess(records);
      onOpenChange(false);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#6137e0]" />
            <span>Record Interview Round</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleRecordInterview} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Interview Round / Stage Name</label>
            <select
              value={interviewRound}
              onChange={(e) => setInterviewRound(e.target.value)}
              className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
            >
              <option value="Initial Screening">Initial Screening</option>
              <option value="Technical Architecture Screen">Technical Architecture Screen</option>
              <option value="System Design Deep-Dive">System Design Deep-Dive</option>
              <option value="Values & Leadership Interview">Values &amp; Leadership Interview</option>
              <option value="Final Executive Debrief">Final Executive Debrief</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Scheduled Date &amp; Time</label>
              <Input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Interviewer Name</label>
              <Input
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
                placeholder="Sarah Jenkins"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Interview Outcome</label>
            <select
              value={interviewOutcome}
              onChange={(e) => setInterviewOutcome(e.target.value)}
              className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
            >
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="PASSED">PASSED (Advance)</option>
              <option value="FAILED">FAILED (Reject)</option>
              <option value="COMPLETED">COMPLETED (Pending Review)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Feedback &amp; Panel Notes</label>
            <textarea
              value={interviewFeedback}
              onChange={(e) => setInterviewFeedback(e.target.value)}
              placeholder="Candidate demonstrated deep concurrency mastery, solved caching bottleneck..."
              rows={3}
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
            />
          </div>

          <DialogFooter className="pt-4 flex justify-end gap-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-black hover:bg-zinc-800 text-white text-xs px-5 rounded-xl transition-colors cursor-pointer"
            >
              {isSaving ? "Saving..." : "Record Interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
