"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  RefreshCw,
  Database,
  Tag,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  FileCode,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchTaxonomyStats,
  fetchTaxonomySkills,
  approveTaxonomySkill,
  rejectTaxonomySkill,
  addAliasToTaxonomySkill,
  createTaxonomySkill,
  TaxonomySkillItem,
  TaxonomyStats,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "language", label: "Languages" },
  { id: "framework", label: "Frameworks" },
  { id: "database", label: "Databases" },
  { id: "platform", label: "Cloud & Platforms" },
  { id: "tool", label: "Tools & DevOps" },
  { id: "library", label: "AI/ML & Libraries" },
  { id: "domain", label: "Domains & Architecture" },
  { id: "soft_skill", label: "Soft Skills" },
];

export default function TaxonomyPage() {
  const [stats, setStats] = useState<TaxonomyStats | null>(null);
  const [skills, setSkills] = useState<TaxonomySkillItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "pending" | "rejected">("pending");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCanonicalName, setNewCanonicalName] = useState("");
  const [newCategory, setNewCategory] = useState("language");
  const [newAliases, setNewAliases] = useState("");
  const [newIsAmbiguous, setNewIsAmbiguous] = useState(false);

  const [aliasModalTarget, setAliasModalTarget] = useState<TaxonomySkillItem | null>(null);
  const [newAliasInput, setNewAliasInput] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, skillsData] = await Promise.all([
        fetchTaxonomyStats(),
        fetchTaxonomySkills({
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          status: activeTab !== "all" ? activeTab : undefined,
          search: searchQuery || undefined,
          limit: 100,
        }),
      ]);
      setStats(statsData);
      setSkills(skillsData.items);
      setTotalCount(skillsData.total);

      // If no pending items on first load and tab was pending, switch to approved
      if (activeTab === "pending" && skillsData.total === 0 && !searchQuery) {
        setActiveTab("approved");
      }
    } catch (e) {
      console.error("Failed to load taxonomy data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCategory, searchQuery]);

  const handleApprove = async (skill: TaxonomySkillItem) => {
    await approveTaxonomySkill(skill.id);
    loadData();
  };

  const handleReject = async (skill: TaxonomySkillItem) => {
    await rejectTaxonomySkill(skill.id);
    loadData();
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCanonicalName.trim()) return;

    const aliasesArr = newAliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    await createTaxonomySkill({
      canonical_name: newCanonicalName.trim(),
      category: newCategory,
      aliases: aliasesArr,
      is_ambiguous: newIsAmbiguous,
      source: "manual",
    });

    setIsAddModalOpen(false);
    setNewCanonicalName("");
    setNewAliases("");
    setNewIsAmbiguous(false);
    loadData();
  };

  const handleAddAliasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasModalTarget || !newAliasInput.trim()) return;

    await addAliasToTaxonomySkill(aliasModalTarget.id, newAliasInput.trim());
    setAliasModalTarget(null);
    setNewAliasInput("");
    loadData();
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "language":
        return "bg-blue-50 text-blue-700 border-blue-200/80";
      case "framework":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      case "database":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "platform":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "tool":
        return "bg-zinc-100 text-zinc-800 border-zinc-200";
      case "library":
        return "bg-rose-50 text-rose-700 border-rose-200/80";
      case "domain":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200";
    }
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search skills, aliases, categories..." />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-7">
          {/* Header & Title */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-serif font-black text-zinc-950 tracking-tight">
                  Skill Taxonomy & Flywheel
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[11px] px-2.5 py-0.5 rounded-full"
                >
                  Version v{stats?.version || "2026.08.1"}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Proprietary ontology mapping ~500+ tech skills with alias normalization, Lightcast / ESCO source grounding, and continuous candidate flywheel learning.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="h-9 px-3.5 text-xs font-semibold rounded-full border-zinc-200 hover:bg-white text-zinc-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="h-9 px-4 text-xs font-semibold rounded-full bg-black hover:bg-zinc-800 text-white transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Canonical Skill
              </Button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                  Total Ontology
                </span>
                <Database className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-serif font-black text-zinc-950">
                {stats?.total_skills ?? 0}
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">Standardized skill entities</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                  Approved Canonical
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-serif font-black text-emerald-950">
                {stats?.approved_count ?? 0}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">Production active matching</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-amber-600">
                <span className="text-[11px] font-bold tracking-wider uppercase text-amber-700">
                  Flywheel Review Queue
                </span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-serif font-black text-amber-950">
                {stats?.pending_count ?? 0}
              </div>
              <p className="text-[11px] text-amber-700 font-medium">Unmapped candidate skills</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                  Curated Sources
                </span>
                <Globe className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-serif font-black text-zinc-950">
                Lightcast + ESCO
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">O*NET & StackOverflow</p>
            </div>
          </div>

          {/* Filter Bar & Tabs */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                    activeTab === "pending"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Flywheel Queue
                  {stats && stats.pending_count > 0 && (
                    <span className="ml-1 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {stats.pending_count}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("approved")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                    activeTab === "approved"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Approved Skills
                </button>
                <button
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    activeTab === "all"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  All ({stats?.total_skills ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab("rejected")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    activeTab === "rejected"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  Rejected
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter skills or aliases..."
                  className="pl-9 h-9 text-xs rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-bold text-zinc-400 uppercase mr-1">
                Category:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors border",
                    selectedCategory === cat.id
                      ? "bg-zinc-950 text-white border-zinc-950"
                      : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Skills Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-xs text-zinc-500 font-medium">
              Loading skill ontology & flywheel records...
            </div>
          ) : skills.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-zinc-900">No skills matching filter</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {activeTab === "pending"
                  ? "All candidate skills have been reviewed and normalized into canonical taxonomy entries."
                  : "No skills matched your search query or category filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={cn(
                    "bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between space-y-4 transition-all hover:border-zinc-300",
                    skill.status === "pending"
                      ? "border-amber-200 bg-amber-50/10"
                      : skill.status === "rejected"
                      ? "border-zinc-200 opacity-60"
                      : "border-zinc-200/80"
                  )}
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Name & Category */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-zinc-950 leading-snug">
                            {skill.canonical_name}
                          </h3>
                          {skill.is_ambiguous && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0 border-zinc-300"
                              title="Ambiguity Guard: Exact match only (never fuzzy)"
                            >
                              Exact Match
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          Source: {skill.source || "lightcast"}
                        </span>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 border",
                          getCategoryBadgeColor(skill.category)
                        )}
                      >
                        {skill.category.replace("_", " ")}
                      </Badge>
                    </div>

                    {/* Pending Context Sample */}
                    {skill.status === "pending" && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 space-y-1">
                        <div className="flex items-center gap-1 font-semibold text-[10px] text-amber-700 uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Extracted from Resumes ({skill.occurrence_count}x)
                        </div>
                        {skill.context_sample && (
                          <p className="italic text-amber-800 line-clamp-2">
                            &ldquo;{skill.context_sample}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Aliases Tags */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Aliases ({skill.aliases?.length || 0}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {skill.aliases && skill.aliases.length > 0 ? (
                          skill.aliases.map((alias, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200/60"
                            >
                              {alias}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">No aliases recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    {skill.status === "pending" ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(skill)}
                          className="flex-1 h-8 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Approve Skill
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(skill)}
                          className="h-8 px-3 text-xs font-medium rounded-lg border-zinc-200 text-zinc-600 hover:text-rose-600 hover:border-rose-200 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className="text-zinc-400 text-[11px] font-mono">
                          v{skill.taxonomy_version}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAliasModalTarget(skill)}
                          className="h-7 px-2.5 text-xs text-zinc-600 hover:text-zinc-950 font-semibold flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3 text-zinc-400" />
                          + Add Alias
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Add Canonical Skill Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-serif font-black text-lg text-zinc-950">
              Add Canonical Skill
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Define a new standardized skill entry with category and alias mappings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSkill} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Canonical Name</label>
              <Input
                value={newCanonicalName}
                onChange={(e) => setNewCanonicalName(e.target.value)}
                placeholder="e.g. Apache Cassandra"
                required
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full h-9 text-xs rounded-xl border border-zinc-200 px-3 bg-white text-zinc-900 focus:outline-hidden"
              >
                <option value="language">Programming Language</option>
                <option value="framework">Framework</option>
                <option value="database">Database</option>
                <option value="platform">Cloud & Platform</option>
                <option value="tool">Tool & DevOps</option>
                <option value="library">Library & AI/ML</option>
                <option value="domain">Domain & Architecture</option>
                <option value="soft_skill">Soft Skill</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">
                Aliases (Comma-Separated)
              </label>
              <Input
                value={newAliases}
                onChange={(e) => setNewAliases(e.target.value)}
                placeholder="e.g. cassandra, apache-cassandra, datastax"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isAmbiguous"
                checked={newIsAmbiguous}
                onChange={(e) => setNewIsAmbiguous(e.target.checked)}
                className="rounded border-zinc-300 text-black focus:ring-black"
              />
              <label htmlFor="isAmbiguous" className="text-xs text-zinc-700 font-medium">
                Ambiguous Acronym (Requires exact match protection)
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-xs rounded-full bg-black hover:bg-zinc-800 text-white font-semibold"
              >
                Create Skill
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Alias Modal */}
      <Dialog open={!!aliasModalTarget} onOpenChange={(open) => !open && setAliasModalTarget(null)}>
        <DialogContent className="sm:max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-serif font-black text-base text-zinc-950">
              Add Alias to {aliasModalTarget?.canonical_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Add an alternative name or abbreviation candidates use on resumes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddAliasSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">New Alias String</label>
              <Input
                value={newAliasInput}
                onChange={(e) => setNewAliasInput(e.target.value)}
                placeholder="e.g. k8s-operator"
                required
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAliasModalTarget(null)}
                className="text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-xs rounded-full bg-black hover:bg-zinc-800 text-white font-semibold"
              >
                Add Alias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
