"use client";

import React, { useState } from "react";
import { ShieldCheck, Eye, EyeOff, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CandidateDetail } from "@/types/ats";

interface ResumeTabProps {
  candidate: CandidateDetail;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeRedact(text: string, target?: string, replacement?: string) {
  if (!text || !target || target.trim().length < 2 || !replacement) return text;
  try {
    return text.replace(new RegExp(escapeRegExp(target.trim()), "gi"), replacement);
  } catch {
    return text;
  }
}

export function ResumeTab({ candidate }: ResumeTabProps) {
  const [redactPII, setRedactPII] = useState(true);

  let rawResume = candidate.raw_text || "";
  if (rawResume) {
    if (redactPII) {
      rawResume = safeRedact(rawResume, candidate.name, "[REDACTED_NAME]");
      rawResume = safeRedact(rawResume, candidate.email, "[REDACTED_EMAIL]");
      rawResume = safeRedact(rawResume, candidate.phone, "[REDACTED_PHONE]");
      rawResume = safeRedact(rawResume, candidate.location, "[REDACTED_LOCATION]");
    }
  } else {
    rawResume = `================================================================================
CANDIDATE CURRICULUM VITAE
================================================================================
Name: ${redactPII ? "[REDACTED_NAME]" : candidate.name}
Email: ${redactPII ? "[REDACTED_EMAIL@DOMAIN.COM]" : candidate.email}
Phone: ${redactPII ? "[REDACTED_PHONE_NUMBER]" : candidate.phone}
Location: ${redactPII ? "[REDACTED_LOCATION]" : candidate.location}

OBJECTIVE / HEADLINE
--------------------------------------------------------------------------------
${candidate.target_headline || "Senior Software Engineer"}

PROFESSIONAL EXPERIENCE
--------------------------------------------------------------------------------
${candidate.experience?.map((e) => `${e.company} — ${e.role} (${e.period})\n• ${e.description}`).join("\n\n") || "Experience details extracted from uploaded resume."}

EDUCATION
--------------------------------------------------------------------------------
${candidate.highest_education || "Degree in Computer Science"}

CORE SKILLS
--------------------------------------------------------------------------------
${candidate.core_skills?.join(", ") || "Technical competencies and tools."}
================================================================================`;
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-900">
              PII De-Identification Layer
            </h4>
            <p className="text-[11px] text-zinc-500">
              Presidio regex + NER scrubbed before LLM scoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
            <Switch
              id="pii-toggle"
              checked={redactPII}
              onCheckedChange={setRedactPII}
            />
            <label
              htmlFor="pii-toggle"
              className="text-xs font-semibold text-zinc-700 cursor-pointer"
            >
              {redactPII ? "PII Masked" : "Raw Document"}
            </label>
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </Button>
        </div>
      </div>

      {/* Code / Text Block */}
      <div className="bg-[#18181b] text-zinc-200 rounded-xl p-5 font-mono text-xs leading-relaxed overflow-x-auto selection:bg-zinc-700">
        <pre>{rawResume}</pre>
      </div>
    </div>
  );
}
