import type { RankedCandidate } from "@/types/ats";

const PRIMARY_STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired"];

export function jobPipelineColumns(candidates: RankedCandidate[]) {
  const stages = [...PRIMARY_STAGES, ...Array.from(new Set(candidates.map(candidate => candidate.stage))).filter(stage => !PRIMARY_STAGES.includes(stage))];
  return stages.map(stage => ({
    stage,
    label: stage === "Interview" ? "Tech Interview" : stage,
    items: candidates.filter(candidate => candidate.stage === stage),
  }));
}

export function nextApplicationStage(stage: string): string | undefined {
  const next: Record<string, string> = {
    Applied: "Screening", Screening: "Interview", "Recruiter Review": "Interview",
    Contacted: "Interview", Interview: "Qualified", Qualified: "Offer",
    Negotiation: "Offer", Offer: "Hired", Offered: "Hired",
  };
  return next[stage];
}
