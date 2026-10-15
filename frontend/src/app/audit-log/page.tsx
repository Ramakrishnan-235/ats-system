"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CoreHeader } from "@/components/layout/core-header";
import { CoreFooter } from "@/components/layout/core-footer";
import { fetchAuditLogs, getErrorMessage, type AuditLogItem } from "@/lib/api";

const control = "rounded-lg border border-[#dee2ef] bg-white p-2 text-sm";

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditLogItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [filters, setFilters] = useState<{ actor_id?: string; action?: string; resource_type?: string }>({});
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // Loading state follows the saved filter selection and refresh request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    fetchAuditLogs({ ...filters, limit: 500 })
      .then(result => { if (active) setEvents(result); })
      .catch(reason => { if (active) { setEvents([]); setError(getErrorMessage(reason)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, refresh]);

  const filtered = events.filter(event => [event.id, event.actor_id, event.actor_role, event.action, event.resource_type, event.resource_id, event.details].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  const selected = filtered.find(event => event.id === selectedId) || filtered[0];
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setFilters({ actor_id: actor.trim() || undefined, action: action.trim() || undefined, resource_type: resource.trim() || undefined });
  }
  function exportCsv() {
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
    };
    const keys = ["id", "timestamp", "actor_id", "actor_role", "action", "resource_type", "resource_id", "decision", "details"] as const;
    const rows = [keys.join(","), ...filtered.map(event => keys.map(key => cell(event[key])).join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "audit-events.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <CoreHeader />
    <main className="min-h-screen bg-[#f8f9ff] pt-20 pb-12 px-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Audit Log</h1><p className="text-sm text-zinc-600">Recorded actions and access decisions for this workspace.</p></div>
          <div className="flex gap-2">
            <button type="button" className={control} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
            <button type="button" disabled={loading || !!error || !filtered.length} className={`${control} disabled:opacity-50`} onClick={exportCsv}>Export displayed events</button>
          </div>
        </div>
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
          <label className="text-xs">Actor ID<input aria-label="Filter audit actor" placeholder="All actors" value={actor} onChange={event => setActor(event.target.value)} className={`${control} block mt-1`} /></label>
          <label className="text-xs">Action<input aria-label="Filter audit action" placeholder="All actions" value={action} onChange={event => setAction(event.target.value)} className={`${control} block mt-1`} /></label>
          <label className="text-xs">Resource type<input aria-label="Filter audit resource" placeholder="All resource types" value={resource} onChange={event => setResource(event.target.value)} className={`${control} block mt-1`} /></label>
          <button className={control}>Apply filters</button>
        </form>
        <input aria-label="Search loaded audit events" placeholder="Search loaded events" value={search} onChange={event => setSearch(event.target.value)} className={`${control} w-full`} />
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {loading ? <p role="status">Loading audit events…</p> : !error && <>
          <p className="text-xs text-zinc-600">Showing {filtered.length} of {events.length} loaded events (up to 500 most recent matching records).</p>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section aria-label="Audit events" className="overflow-x-auto rounded-2xl border bg-white">
              {!filtered.length ? <p className="p-6 text-zinc-600">No audit events match these filters.</p> : <table className="w-full text-left text-sm">
                <thead className="bg-[#eff4ff]"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">Decision</th></tr></thead>
                <tbody>{filtered.map(event => <tr key={event.id} className={`border-t ${selected?.id === event.id ? "bg-[#e7deff]/30" : ""}`}>
                  <td className="p-3 whitespace-nowrap">{event.timestamp}</td>
                  <td className="p-3"><button type="button" onClick={() => setSelectedId(event.id)} className="font-semibold underline text-[#6137e0]">{event.action}</button></td>
                  <td className="p-3">{event.resource_type}<span className="block max-w-xs break-all text-xs text-zinc-500">{event.resource_id}</span></td>
                  <td className={`p-3 font-semibold ${event.decision === "DENIED" ? "text-red-700" : "text-emerald-700"}`}>{event.decision}</td>
                </tr>)}</tbody>
              </table>}
            </section>
            {selected && <section aria-label="Audit event details" className="rounded-2xl border bg-white p-6 space-y-4">
              <h2 className="text-lg font-bold">{selected.action}</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-zinc-500">Event ID</dt><dd className="break-all font-mono">{selected.id}</dd></div>
                <div><dt className="text-zinc-500">Timestamp</dt><dd>{selected.timestamp}</dd></div>
                <div><dt className="text-zinc-500">Actor / role</dt><dd className="break-all">{selected.actor_id || "Not recorded"} / {selected.actor_role}</dd></div>
                <div><dt className="text-zinc-500">Resource</dt><dd className="break-all">{selected.resource_type}: {selected.resource_id}</dd></div>
                <div><dt className="text-zinc-500">Decision</dt><dd>{selected.decision}</dd></div>
                <div><dt className="text-zinc-500">Details</dt><dd className="whitespace-pre-wrap">{selected.details || "No additional details recorded."}</dd></div>
                {selected.ip_address && <div><dt className="text-zinc-500">IP address</dt><dd>{selected.ip_address}</dd></div>}
                {selected.user_agent && <div><dt className="text-zinc-500">User agent</dt><dd>{selected.user_agent}</dd></div>}
              </dl>
            </section>}
          </div>
        </>}
      </div>
    </main>
    <CoreFooter />
  </>;
}
