"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Sparkles,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { createJobRequisition } from "@/lib/api";
import { JobRequisition } from "@/types/ats";

interface CreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated?: (job: JobRequisition) => void;
}

export function CreateJobModal({
  open,
  onOpenChange,
  onJobCreated,
}: CreateJobModalProps) {
  const [title, setTitle] = useState("Senior Backend Engineer");
  const [department, setDepartment] = useState("Engineering");
  const [location, setLocation] = useState("Remote");
  const [description, setDescription] = useState(
    `We are seeking an experienced Senior Backend Engineer to join our core platform team. You will be responsible for designing, building, and maintaining scalable microservices that power our primary application.\n\nKey Responsibilities:\n• Architect high-performance APIs\n• Optimize database queries and schema design`
  );
  const [skills, setSkills] = useState([
    "Python",
    "FastAPI",
    "PostgreSQL",
    "Kubernetes",
  ]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [runAiMatch, setRunAiMatch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      setNewSkillInput("");
      setIsAddingSkill(false);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await createJobRequisition({
        title,
        department,
        location,
        job_description: description,
        required_skills: skills,
        run_ai_match: runAiMatch,
      });
      if (onJobCreated) onJobCreated(created);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-950">
            Create New Job
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Job Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">
              Job Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="h-10 rounded-xl bg-white border-zinc-200 text-sm font-medium"
              required
            />
          </div>

          {/* Department & Location Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Department
              </label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Data">Data</option>
                  <option value="Design">Design</option>
                  <option value="Product">Product</option>
                  <option value="Marketing">Marketing</option>
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Location
              </label>
              <div className="relative">
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  <option value="Remote">Remote</option>
                  <option value="New York / Hybrid">New York / Hybrid</option>
                  <option value="London / Remote">London / Remote</option>
                  <option value="San Francisco / Hybrid">
                    San Francisco / Hybrid
                  </option>
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Job Description with Rich Text Toolbar */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">
              Job Description
            </label>
            <div className="border border-zinc-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-zinc-950">
              {/* Toolbar */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-zinc-300 mx-1" />
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-zinc-300 mx-1" />
                <button
                  type="button"
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Textarea */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full p-3 text-xs text-zinc-800 focus:outline-none resize-none leading-relaxed"
                placeholder="Enter key requirements and responsibilities..."
                required
              />
            </div>
          </div>

          {/* Required Skills Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-600">
                Required Skills
              </label>
              <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                AUTO-EXTRACTED
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {skills.map((skill) => (
                <div
                  key={skill}
                  className="bg-zinc-100 border border-zinc-200/80 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-800 flex items-center gap-1.5 group hover:bg-zinc-200/80 transition-colors"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-zinc-400 hover:text-zinc-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {isAddingSkill ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    placeholder="Skill name"
                    className="h-7 w-28 text-xs py-0 px-2 rounded-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      } else if (e.key === "Escape") {
                        setIsAddingSkill(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={handleAddSkill}
                  >
                    Add
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(true)}
                  className="border border-dashed border-zinc-300 hover:border-zinc-500 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add skill</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Match Toggle Card */}
          <div className="bg-[#f7f6f2] border border-[#e8e6df] rounded-xl p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={runAiMatch}
                onCheckedChange={setRunAiMatch}
                id="ai-match-toggle"
              />
              <div>
                <label
                  htmlFor="ai-match-toggle"
                  className="text-xs font-bold text-zinc-900 cursor-pointer block"
                >
                  Run AI Match on save
                </label>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Screens all candidates through the 3-stage pipeline. ~60s · Top
                  20 evaluated by LLM
                </p>
              </div>
            </div>
          </div>

          {/* Dialog Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-5 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#5046e5] to-[#7c3aed] text-white hover:opacity-95 shadow-md flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Creating..." : "Create & Match"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
