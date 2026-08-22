"use client";

import React, { useState } from "react";
import { ShieldCheck, Eye, EyeOff, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CandidateDetail } from "@/types/ats";

interface ResumeTabProps {
  candidate: CandidateDetail;
}

export function ResumeTab({ candidate }: ResumeTabProps) {
  const [redactPII, setRedactPII] = useState(true);

  const rawResume = `================================================================================
CANDIDATE CURRICULUM VITAE
================================================================================
Name: ${redactPII ? "[REDACTED_NAME]" : candidate.name}
Email: ${redactPII ? "[REDACTED_EMAIL@DOMAIN.COM]" : candidate.email}
Phone: ${redactPII ? "[REDACTED_PHONE_NUMBER]" : candidate.phone}
Location: ${redactPII ? "[REDACTED_LOCATION]" : candidate.location}

OBJECTIVE
--------------------------------------------------------------------------------
Experienced Staff / Senior Backend Engineer specializing in high-throughput
distributed systems, API latency optimization, and microservice architecture.

PROFESSIONAL EXPERIENCE
--------------------------------------------------------------------------------
Stripe — Staff Backend Engineer (2021 — Present)
• Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%.
• Implemented robust idempotency keys for distributed payments processing across multi-region PostgreSQL clusters.
• Mentored 3 junior and mid-level software engineers.

Uber — Senior Software Engineer (2018 — 2021)
• Architected real-time driver telemetry stream processor handling 250k events/sec using Kafka and Go.
• Optimized spatial query indexing on PostgreSQL with PostGIS, decreasing geospatial lookup latency by 65%.

EDUCATION
--------------------------------------------------------------------------------
Stanford University — M.S. Computer Science (Distributed Systems)

CORE SKILLS
--------------------------------------------------------------------------------
Python, FastAPI, Kubernetes, PostgreSQL, AWS, Go, Docker, Redis, Kafka, Distributed Systems.
================================================================================`;

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
