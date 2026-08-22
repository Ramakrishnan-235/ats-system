"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineCandidateItem } from "@/types/ats";
import { Target, User, Briefcase, FileText, CheckCircle2 } from "lucide-react";

interface AddCandidateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateAdded: (candidate: PipelineCandidateItem) => void;
}

export function AddCandidateModal({
  open,
  onOpenChange,
  onCandidateAdded,
}: AddCandidateModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [matchScore, setMatchScore] = useState(88);
  const [stage, setStage] = useState<"Contacted" | "Interview" | "Negotiation">("Contacted");
  const [summary, setSummary] = useState("");
  const [probability, setProbability] = useState<number>(75);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;

    const newCand: PipelineCandidateItem = {
      id: `cand-${Date.now()}`,
      name: name.trim(),
      role: role.trim(),
      avatar: name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "CA",
      match_score: Number(matchScore) || 85,
      summary: summary.trim() || "Candidate added to acquisition pipeline.",
      stage: stage,
      probability: stage === "Negotiation" ? probability : undefined,
      applied_time: "Just now",
    };

    onCandidateAdded(newCand);
    onOpenChange(false);

    // Reset form
    setName("");
    setRole("");
    setMatchScore(88);
    setSummary("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-950">
                Add New Candidate
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Manually record a candidate into your active recruitment pipeline.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
              Candidate Full Name
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Lin"
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
              Target Role / Position
            </label>
            <Input
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend Architect"
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) =>
                  setStage(e.target.value as "Contacted" | "Interview" | "Negotiation")
                }
                className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none"
              >
                <option value="Contacted">Contacted</option>
                <option value="Interview">Interview</option>
                <option value="Negotiation">Negotiation</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                AI Match Score (0 - 100)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={matchScore}
                  onChange={(e) => setMatchScore(Number(e.target.value))}
                  className="h-10 text-xs pl-8 rounded-xl"
                />
                <Target className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
              </div>
            </div>
          </div>

          {stage === "Negotiation" && (
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Offer Acceptance Probability ({probability}%)
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
              Screening Note / Candidate Summary
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Key strengths, interview impressions, or background highlights..."
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:border-zinc-400 focus:outline-none resize-none"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-black hover:bg-zinc-800 text-white rounded-xl text-xs px-5"
            >
              Add to Pipeline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
