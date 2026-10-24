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
import { Edit3 } from "lucide-react";
import { CandidateDetail } from "@/types/ats";
import { editCandidate, getErrorMessage } from "@/lib/api";

interface EditCandidateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDetail | null;
  onSuccess: (updatedFields: Partial<CandidateDetail>) => void;
  onError: (errorMessage: string) => void;
}

export function EditCandidateModal({
  isOpen,
  onOpenChange,
  candidate,
  onSuccess,
  onError,
}: EditCandidateModalProps) {
  const [editName, setEditName] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editExpYears, setEditExpYears] = useState(0);
  const [editEducation, setEditEducation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (candidate && isOpen) {
      Promise.resolve().then(() => {
        setEditName(candidate.name || "");
        setEditHeadline(candidate.target_headline || "");
        setEditEmail(candidate.email === "N/A" || candidate.email === "[REDACTED]" ? "" : candidate.email || "");
        setEditPhone(candidate.phone === "N/A" || candidate.phone === "[REDACTED]" ? "" : candidate.phone || "");
        setEditLocation(candidate.location === "N/A" ? "" : candidate.location || "");
        setEditSkills((candidate.core_skills || []).join(", "));
        setEditExpYears(candidate.years_of_experience || 0);
        setEditEducation(candidate.highest_education || "");
      });
    }
  }, [candidate, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    setIsSaving(true);
    try {
      const skillsArray = editSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await editCandidate(candidate.id, {
        name: editName.trim() || undefined,
        headline: editHeadline.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        location: editLocation.trim() || undefined,
        skills: skillsArray.length ? skillsArray : undefined,
        experience_years: editExpYears,
        education: editEducation.trim() || undefined,
      });

      onSuccess({
        ...updated,
        name: editName.trim() || candidate.name,
        target_headline: editHeadline.trim() || candidate.target_headline,
        email: editEmail.trim() || candidate.email,
        phone: editPhone.trim() || candidate.phone,
        location: editLocation.trim() || candidate.location,
        core_skills: skillsArray.length ? skillsArray : candidate.core_skills,
        years_of_experience: editExpYears,
        highest_education: editEducation.trim() || candidate.highest_education,
        processing_status: "COMPLETED",
        error_message: undefined,
      });
      onOpenChange(false);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#6137e0]" />
            <span>Manual Candidate Review &amp; Profile Edit</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <p className="text-xs text-zinc-500">
            Update candidate details directly. If AI processing failed, saving will rescue the candidate to &ldquo;Completed&rdquo; status.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Full Name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 text-xs rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Target Headline / Role</label>
            <Input
              value={editHeadline}
              onChange={(e) => setEditHeadline(e.target.value)}
              placeholder="Senior Distributed Systems Engineer"
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Email Address</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="candidate@example.com"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Phone</label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 (555) 019-2831"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Location</label>
              <Input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="San Francisco, CA (Hybrid)"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Years of Experience</label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={editExpYears}
                onChange={(e) => setEditExpYears(Number(e.target.value))}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Core Skills (comma-separated)</label>
            <Input
              value={editSkills}
              onChange={(e) => setEditSkills(e.target.value)}
              placeholder="Rust, PostgreSQL, Distributed Systems, Docker"
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Highest Education</label>
            <Input
              value={editEducation}
              onChange={(e) => setEditEducation(e.target.value)}
              placeholder="B.S. in Computer Science"
              className="h-10 text-xs rounded-xl"
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
              {isSaving ? "Saving..." : "Save & Rescue Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
