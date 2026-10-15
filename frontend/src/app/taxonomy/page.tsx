"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchTaxonomySkills, createTaxonomySkill, approveTaxonomySkill, rejectTaxonomySkill, addAliasToTaxonomySkill, getErrorMessage, type TaxonomySkillItem } from "@/lib/api";

const CATEGORIES = ["language", "framework", "database", "platform", "tool", "library", "domain", "soft_skill", "methodology"];
const PAGE_SIZE = 50;
const control = "rounded-lg border border-[#dee2ef] bg-white p-2 text-sm";

export default function TaxonomyPage() {
  const [skills, setSkills] = useState<TaxonomySkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newCategory, setNewCategory] = useState("tool");
  const [aliases, setAliases] = useState("");
  const [alias, setAlias] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    // Fetch lifecycle follows the current server-side filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetchTaxonomySkills({ search: search || undefined, category: category || undefined, status: status || undefined, page, limit: PAGE_SIZE })
      .then(result => { if (active) { setSkills(result.items); setTotal(result.total); setVersion(result.version); } })
      .catch(reason => { if (active) { setSkills([]); setTotal(0); setError(getErrorMessage(reason)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, category, status, page, refresh]);

  const selected = skills.find(skill => skill.id === selectedId) || skills[0];
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSaveError(""); setMessage("");
    try {
      const saved = await createTaxonomySkill({ canonical_name: name.trim(), category: newCategory, aliases: aliases.split(",").map(value => value.trim()).filter(Boolean), source: "manual" });
      setSelectedId(saved.id); setName(""); setAliases(""); setOpen(false);
      setSearch(""); setCategory(""); setStatus(""); setPage(1); setRefresh(value => value + 1);
      setMessage(`Saved ${saved.canonical_name}.`);
    } catch (reason) { setSaveError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function update(action: () => Promise<TaxonomySkillItem>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await action();
      setSkills(previous => previous.map(skill => skill.id === saved.id ? saved : skill));
      setAlias(""); setMessage(`Saved ${saved.canonical_name}.`); setRefresh(value => value + 1);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <>
    <CoreHeader />
    <main className="min-h-screen bg-[#f8f9ff] pt-20 pb-12 px-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Skills Taxonomy</h1><p className="text-sm text-zinc-600">Manage saved skills, aliases, and review decisions for this workspace.</p></div>
          <div className="flex gap-2">
            <button type="button" className={control} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
            <button type="button" className="rounded-lg bg-[#131c29] px-4 py-2 text-sm text-white" onClick={() => { setSaveError(""); setOpen(true); }}>New skill</button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
        <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
          <input aria-label="Search skills" placeholder="Search skill names" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={`${control} flex-1`} />
          <select aria-label="Filter skill category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className={control}>
            <option value="">All categories</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}
          </select>
          <select aria-label="Filter skill status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={control}>
            <option value="">All statuses</option>{["approved", "pending", "rejected"].map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        {loading ? <p role="status">Loading skills…</p> : <>
          <p className="text-xs text-zinc-600">{skills.length} shown · {total} matching skills · Version {version || "not provided"}</p>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section aria-label="Saved skills" className="overflow-hidden rounded-2xl border bg-white">
              {!skills.length && !error && <p className="p-6 text-zinc-600">No skills match these filters.</p>}
              {skills.map(skill => <button key={skill.id} type="button" aria-pressed={selected?.id === skill.id} onClick={() => { setSelectedId(skill.id); setAlias(""); }} className={`block w-full border-b p-4 text-left ${selected?.id === skill.id ? "bg-[#e7deff]/40" : "hover:bg-zinc-50"}`}>
                <span className="font-semibold">{skill.canonical_name}</span><span className="block text-xs text-zinc-600">{skill.category} · {skill.status}</span>
                <span className="text-xs text-zinc-500">{skill.aliases.join(", ") || "No aliases"}</span>
              </button>)}
            </section>
            {selected && <section aria-label="Skill details" className="rounded-2xl border bg-white p-6 space-y-4">
              <h2 className="text-xl font-bold">{selected.canonical_name}</h2>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-zinc-500">ID</dt><dd className="break-all font-mono">{selected.id}</dd></div>
                <div><dt className="text-zinc-500">Category / status</dt><dd>{selected.category} / {selected.status}</dd></div>
                <div><dt className="text-zinc-500">Aliases</dt><dd>{selected.aliases.join(", ") || "None"}</dd></div>
                <div><dt className="text-zinc-500">Source</dt><dd>{selected.source || "Not recorded"}</dd></div>
                <div><dt className="text-zinc-500">Updated</dt><dd>{selected.updated_at || "Not recorded"}</dd></div>
              </dl>
              <div className="flex gap-2">
                <button type="button" disabled={busy || selected.status === "approved"} className={`${control} disabled:opacity-50`} onClick={() => update(() => approveTaxonomySkill(selected.id))}>Approve</button>
                <button type="button" disabled={busy || selected.status === "rejected"} className={`${control} disabled:opacity-50`} onClick={() => update(() => rejectTaxonomySkill(selected.id))}>Reject</button>
              </div>
              <form onSubmit={event => { event.preventDefault(); if (alias.trim()) void update(() => addAliasToTaxonomySkill(selected.id, alias.trim())); }} className="flex gap-2">
                <input aria-label="New alias" required maxLength={100} value={alias} onChange={event => setAlias(event.target.value)} className={`${control} min-w-0 flex-1`} />
                <button disabled={busy || !alias.trim()} className={`${control} disabled:opacity-50`}>Add alias</button>
              </form>
            </section>}
          </div>
          <nav aria-label="Taxonomy pages" className="flex items-center gap-4">
            <button type="button" disabled={page === 1} className={`${control} disabled:opacity-50`} onClick={() => setPage(value => value - 1)}>Previous</button>
            <span className="text-sm">Page {page}</span>
            <button type="button" disabled={page * PAGE_SIZE >= total} className={`${control} disabled:opacity-50`} onClick={() => setPage(value => value + 1)}>Next</button>
          </nav>
        </>}
      </div>
    </main>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>New skill</DialogTitle><DialogDescription>Save a canonical skill and its aliases to the workspace taxonomy.</DialogDescription></DialogHeader>
      <form onSubmit={create} className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
        <label className="block text-sm">Skill name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} className={`${control} block w-full mt-1`} /></label>
        <label className="block text-sm">Category<select value={newCategory} onChange={event => setNewCategory(event.target.value)} className={`${control} block w-full mt-1`}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm">Aliases (comma separated)<input value={aliases} onChange={event => setAliases(event.target.value)} className={`${control} block w-full mt-1`} /></label>
        <button disabled={busy || !name.trim()} className="rounded-lg bg-[#131c29] px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Save skill"}</button>
      </form>
    </DialogContent></Dialog>
    <CoreFooter />
  </>;
}
