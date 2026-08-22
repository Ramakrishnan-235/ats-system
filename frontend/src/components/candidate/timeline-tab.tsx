import React from "react";
import { CheckCircle2, Clock, Send, Sparkles } from "lucide-react";
import { CandidateDetail } from "@/types/ats";

interface TimelineTabProps {
  candidate: CandidateDetail;
}

export function TimelineTab({ candidate }: TimelineTabProps) {
  const events = [
    {
      title: "Candidate Profile Ingested",
      timestamp: "2 days ago at 10:14 AM",
      description: "PDF resume parsed via PyMuPDF + Presidio PII redaction layer.",
      icon: Clock,
      status: "done",
    },
    {
      title: "Stage 1 Hybrid Dense + BM25 Vector Matching",
      timestamp: "2 days ago at 10:14 AM",
      description: "Retrieved in Top 100 with BAAI/bge-small-en-v1.5 embeddings.",
      icon: Sparkles,
      status: "done",
    },
    {
      title: "Stage 2 Cross-Encoder Re-Ranking",
      timestamp: "2 days ago at 10:15 AM",
      description: "Ranked #1 out of Top 20 via BAAI/bge-reranker-large.",
      icon: Sparkles,
      status: "done",
    },
    {
      title: "Stage 3 Deep LLM Evaluation Completed",
      timestamp: "2 days ago at 10:15 AM",
      description: "Generated 95 match score with Ollama gemma2:2b rubric citations.",
      icon: CheckCircle2,
      status: "done",
    },
    {
      title: "Advanced to Interview Round",
      timestamp: "Yesterday at 2:14 PM",
      description: "Recruiter Admin moved stage to Interviewing and left team note.",
      icon: Send,
      status: "active",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
      <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
        APPLICATION TIMELINE & LIFECYCLE
      </span>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100">
        {events.map((ev, i) => {
          const Icon = ev.icon;
          return (
            <div key={i} className="relative pl-6 space-y-1">
              <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-950 text-white flex items-center justify-center -translate-x-1/2">
                <Icon className="w-2.5 h-2.5" />
              </div>
              <div className="flex items-baseline justify-between">
                <h4 className="font-bold text-xs text-zinc-950">{ev.title}</h4>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {ev.timestamp}
                </span>
              </div>
              <p className="text-xs text-zinc-600">{ev.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
