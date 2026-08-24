"use client";

import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  Save,
  Check,
  Code2,
  Workflow,
  Briefcase,
  Users2,
  GraduationCap,
  Layers,
  ChevronDown,
  ChevronUp,
  Flame,
  Crown,
  Zap,
  Microscope,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CriteriaWeights } from "@/types/ats";
import { DEFAULT_CRITERIA_WEIGHTS } from "@/lib/api";

export interface RubricWeightsPanelProps {
  initialWeights?: CriteriaWeights;
  onWeightsChange: (weights: CriteriaWeights) => void;
  onSaveAsDefault?: (weights: CriteriaWeights) => Promise<void>;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  candidateCount?: number;
}

interface Preset {
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ElementType;
  weights: CriteriaWeights;
}

export const RUBRIC_PRESETS: Preset[] = [
  {
    id: "balanced",
    name: "Balanced Standard",
    shortDesc: "Equalized generalist weighting",
    icon: Scale,
    weights: {
      technical_depth: 30,
      system_design: 25,
      experience_seniority: 20,
      leadership_culture: 15,
      domain_expertise: 10,
    },
  },
  {
    id: "deep_tech",
    name: "Deep Technical / IC",
    shortDesc: "80% coding & system architecture",
    icon: Zap,
    weights: {
      technical_depth: 45,
      system_design: 35,
      experience_seniority: 10,
      leadership_culture: 5,
      domain_expertise: 5,
    },
  },
  {
    id: "staff_lead",
    name: "Staff / Tech Lead",
    shortDesc: "Systems, cross-team & technical leadership",
    icon: Crown,
    weights: {
      technical_depth: 25,
      system_design: 30,
      experience_seniority: 20,
      leadership_culture: 20,
      domain_expertise: 5,
    },
  },
  {
    id: "startup",
    name: "Startup Velocity",
    shortDesc: "Hands-on execution & track record",
    icon: Flame,
    weights: {
      technical_depth: 35,
      system_design: 15,
      experience_seniority: 25,
      leadership_culture: 15,
      domain_expertise: 10,
    },
  },
  {
    id: "domain_specialist",
    name: "Domain Specialist",
    shortDesc: "Fintech, AI/ML, Healthcare vertical focus",
    icon: Microscope,
    weights: {
      technical_depth: 20,
      system_design: 15,
      experience_seniority: 20,
      leadership_culture: 10,
      domain_expertise: 35,
    },
  },
];

const DIMENSION_CONFIG = [
  {
    key: "technical_depth" as const,
    label: "Technical Depth & Skills",
    desc: "Language proficiency, framework mastery, and coding capabilities",
    icon: Code2,
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    bgLight: "bg-emerald-50",
    borderLight: "border-emerald-200",
    accentColor: "accent-emerald-600",
  },
  {
    key: "system_design" as const,
    label: "Architecture & System Design",
    desc: "Distributed systems, concurrency, scalability, and cloud topology",
    icon: Workflow,
    color: "bg-indigo-500",
    textColor: "text-indigo-700",
    bgLight: "bg-indigo-50",
    borderLight: "border-indigo-200",
    accentColor: "accent-indigo-600",
  },
  {
    key: "experience_seniority" as const,
    label: "Experience & Seniority",
    desc: "Track record, career progression, production impact, and scale",
    icon: Briefcase,
    color: "bg-purple-500",
    textColor: "text-purple-700",
    bgLight: "bg-purple-50",
    borderLight: "border-purple-200",
    accentColor: "accent-purple-600",
  },
  {
    key: "leadership_culture" as const,
    label: "Leadership & Communication",
    desc: "Mentorship, cross-functional collaboration, and technical direction",
    icon: Users2,
    color: "bg-amber-500",
    textColor: "text-amber-800",
    bgLight: "bg-amber-50",
    borderLight: "border-amber-200",
    accentColor: "accent-amber-600",
  },
  {
    key: "domain_expertise" as const,
    label: "Domain & Industry Knowledge",
    desc: "Vertical-specific knowledge (e.g. AI/ML, Fintech, Cloud, Security)",
    icon: GraduationCap,
    color: "bg-rose-500",
    textColor: "text-rose-700",
    bgLight: "bg-rose-50",
    borderLight: "border-rose-200",
    accentColor: "accent-rose-600",
  },
];

export function RubricWeightsPanel({
  initialWeights,
  onWeightsChange,
  onSaveAsDefault,
  isCollapsible = true,
  defaultExpanded = true,
  candidateCount,
}: RubricWeightsPanelProps) {
  const [weights, setWeights] = useState<CriteriaWeights>(
    initialWeights || DEFAULT_CRITERIA_WEIGHTS
  );
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>("balanced");

  useEffect(() => {
    if (initialWeights) {
      setWeights(initialWeights);
      detectActivePreset(initialWeights);
    }
  }, [initialWeights]);

  const detectActivePreset = (currentWeights: CriteriaWeights) => {
    const matched = RUBRIC_PRESETS.find(
      (p) =>
        p.weights.technical_depth === currentWeights.technical_depth &&
        p.weights.system_design === currentWeights.system_design &&
        p.weights.experience_seniority === currentWeights.experience_seniority &&
        p.weights.leadership_culture === currentWeights.leadership_culture &&
        p.weights.domain_expertise === currentWeights.domain_expertise
    );
    setActivePresetId(matched ? matched.id : null);
  };

  const handleSliderChange = (
    key: keyof CriteriaWeights,
    value: number
  ) => {
    const updated: CriteriaWeights = {
      ...weights,
      [key]: value,
    };
    setWeights(updated);
    detectActivePreset(updated);
    onWeightsChange(updated);
  };

  const handlePresetSelect = (preset: Preset) => {
    setWeights(preset.weights);
    setActivePresetId(preset.id);
    onWeightsChange(preset.weights);
  };

  const handleReset = () => {
    const defaultW = { ...DEFAULT_CRITERIA_WEIGHTS };
    setWeights(defaultW);
    setActivePresetId("balanced");
    onWeightsChange(defaultW);
  };

  const handleSave = async () => {
    if (!onSaveAsDefault) return;
    setIsSaving(true);
    try {
      await onSaveAsDefault(weights);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute total and proportions
  const totalWeight =
    weights.technical_depth +
    weights.system_design +
    weights.experience_seniority +
    weights.leadership_culture +
    weights.domain_expertise;

  const getProportionPercent = (val: number) => {
    if (totalWeight <= 0) return 20;
    return Math.round((val / totalWeight) * 100);
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden transition-all duration-300">
      {/* Header Bar */}
      <div className="p-5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-zinc-50/70 via-white to-zinc-50/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-zinc-950">
                Dynamic Rubric Calibration
              </h3>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-mono font-medium px-2 py-0.5"
              >
                <Sparkles className="w-2.5 h-2.5 mr-1" />
                Real-time &lt; 5ms
              </Badge>
              {candidateCount !== undefined && (
                <span className="text-xs text-zinc-500 font-medium">
                  • Re-ranking {candidateCount} candidate{candidateCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Adjust criteria weights to calibrate candidate scores and leaderboard ranks instantly without LLM re-runs.
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> Saved as default!
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset
          </Button>

          {onSaveAsDefault && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 text-xs font-semibold bg-zinc-950 text-white hover:bg-zinc-800 transition-colors"
            >
              {isSaving ? (
                <span className="flex items-center gap-1">Saving...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save as Default
                </>
              )}
            </Button>
          )}

          {isCollapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900"
              title={isExpanded ? "Collapse calibration panel" : "Expand calibration panel"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Content Body */}
      {isExpanded && (
        <div className="p-5 space-y-6">
          {/* 1. Proportional Visual Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Normalized Weight Distribution
              </span>
              <span className="font-mono text-zinc-500 font-medium">
                Total weight sum:{" "}
                <strong className="text-zinc-900">{totalWeight}%</strong>{" "}
                (Normalized to 100%)
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-zinc-100 flex overflow-hidden p-0.5 gap-0.5 border border-zinc-200/80 shadow-inner">
              {DIMENSION_CONFIG.map((dim) => {
                const proportion = getProportionPercent(weights[dim.key]);
                if (proportion <= 0) return null;
                return (
                  <div
                    key={dim.key}
                    style={{ width: `${proportion}%` }}
                    className={`${dim.color} h-full rounded-full transition-all duration-300 relative group`}
                    title={`${dim.label}: ${weights[dim.key]}% (${proportion}% of total)`}
                  />
                );
              })}
            </div>

            {/* Distribution Legend */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              {DIMENSION_CONFIG.map((dim) => {
                const prop = getProportionPercent(weights[dim.key]);
                return (
                  <div
                    key={dim.key}
                    className="flex items-center gap-1.5 font-medium text-zinc-600"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${dim.color}`} />
                    <span>{dim.label.split(" ")[0]}</span>
                    <span className="font-mono font-bold text-zinc-900">
                      {prop}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Role-Tailored Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                ROLE-TAILORED PRESETS
              </span>
              <span className="text-[11px] text-zinc-500">
                Click any preset to apply instant calibration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {RUBRIC_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = activePresetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                      isActive
                        ? "bg-zinc-950 text-white border-zinc-950 shadow-sm ring-2 ring-zinc-950/20"
                        : "bg-zinc-50/70 hover:bg-zinc-100/90 text-zinc-800 border-zinc-200/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? "text-amber-400" : "text-zinc-600"
                          }`}
                        />
                        {isActive && (
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs">{preset.name}</div>
                      <div
                        className={`text-[11px] mt-0.5 line-clamp-1 ${
                          isActive ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        {preset.shortDesc}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-mono">
                      <span className={isActive ? "text-zinc-300" : "text-zinc-500"}>
                        Tech/Sys/Exp
                      </span>
                      <span className="font-bold">
                        {preset.weights.technical_depth}/{preset.weights.system_design}/
                        {preset.weights.experience_seniority}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Interactive Weight Sliders Grid */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                FINE-GRAINED CRITERIA WEIGHTS
              </span>
              <span className="text-[11px] text-zinc-500">
                Drag sliders for customized weighting
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DIMENSION_CONFIG.map((dim) => {
                const Icon = dim.icon;
                const value = weights[dim.key];
                const prop = getProportionPercent(value);

                return (
                  <div
                    key={dim.key}
                    className={`p-4 rounded-xl border ${dim.borderLight} ${dim.bgLight}/40 space-y-3 transition-all`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg ${dim.bgLight} ${dim.textColor} flex items-center justify-center shrink-0 border ${dim.borderLight}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-zinc-900 leading-tight">
                            {dim.label}
                          </div>
                          <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                            {dim.desc}
                          </div>
                        </div>
                      </div>

                      {/* Percentage Badge */}
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-bold font-mono ${dim.textColor}`}
                        >
                          {value}%
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {prop}% of total
                        </div>
                      </div>
                    </div>

                    {/* Range Slider */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={value}
                        onChange={(e) =>
                          handleSliderChange(dim.key, parseFloat(e.target.value))
                        }
                        className={`w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer ${dim.accentColor}`}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400 px-0.5">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
