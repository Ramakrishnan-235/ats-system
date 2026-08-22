import React from "react";
import {
  MapPin,
  Mail,
  Phone,
  Link2,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CandidateDetail } from "@/types/ats";

interface CandidateLeftPanelProps {
  candidate: CandidateDetail;
}

export function CandidateLeftPanel({ candidate }: CandidateLeftPanelProps) {
  return (
    <div className="space-y-6">
      {/* Top Profile Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs flex flex-col items-center text-center">
        {/* Large Avatar */}
        <div className="relative mb-4">
          <img
            src={candidate.avatar}
            alt={candidate.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
          />
        </div>

        {/* Name & Headline */}
        <h2 className="font-bold text-lg text-zinc-950">{candidate.name}</h2>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium mt-1">
          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
          <span>{candidate.location}</span>
        </div>

        {/* Contact Links */}
        <div className="w-full mt-6 pt-6 border-t border-zinc-100 space-y-3 text-left">
          <div className="flex items-center gap-3 text-xs text-zinc-600 font-medium">
            <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
            <a
              href={`mailto:${candidate.email}`}
              className="hover:text-zinc-950 transition-colors truncate"
            >
              {candidate.email}
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-600 font-medium">
            <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
            <a
              href={`tel:${candidate.phone}`}
              className="hover:text-zinc-950 transition-colors"
            >
              {candidate.phone}
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-600 font-medium">
            <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
            <a
              href={`https://${candidate.linkedin}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-950 transition-colors truncate"
            >
              {candidate.linkedin}
            </a>
          </div>
        </div>
      </div>

      {/* Experience Timeline Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
        <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
          EXPERIENCE
        </span>

        <div className="space-y-6 relative before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100">
          {candidate.experience.map((exp, idx) => (
            <div key={idx} className="relative pl-6 space-y-1">
              {/* Dot */}
              <div
                className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  idx === 0 ? "bg-black" : "bg-zinc-300"
                }`}
              />
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-bold text-xs text-zinc-900 leading-tight">
                  {exp.role}, {exp.company}
                </h4>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium block">
                {exp.period}
              </span>
            </div>
          ))}
        </div>

        {/* Education Subtext */}
        {candidate.highest_education && (
          <div className="pt-4 border-t border-zinc-100 flex items-start gap-2 text-xs text-zinc-600">
            <GraduationCap className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <span className="font-medium">{candidate.highest_education}</span>
          </div>
        )}

        {/* Core Skills Chips */}
        <div className="pt-4 border-t border-zinc-100 space-y-2.5">
          <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase block">
            CORE SKILLS
          </span>
          <div className="flex flex-wrap gap-1.5">
            {candidate.core_skills.map((skill) => (
              <Badge
                key={skill}
                variant="tag"
                className="text-[11px] px-2.5 py-0.5 rounded-md font-medium"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
