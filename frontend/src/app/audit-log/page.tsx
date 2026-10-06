"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Bell,
  User,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fetchAuditLogs, type AuditLogItem, getErrorMessage } from "@/lib/api";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState("All Events");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAuditLogs({ limit: 100 })
      .then((data) => setLogs(data || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesDecision =
      selectedDecision === "All Events" ||
      (selectedDecision === "Allowed Only" && log.decision === "ALLOWED") ||
      (selectedDecision === "Denied / Blocked" && log.decision === "DENIED");

    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      log.actor_id.toLowerCase().includes(query) ||
      log.actor_role.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.resource_type.toLowerCase().includes(query) ||
      log.resource_id.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query);

    return matchesDecision && matchesQuery;
  });

  return (
    <div className="min-h-screen flex bg-[#faf9f6] text-zinc-900 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-200/70 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>ATS</span>
            <span>›</span>
            <span>Compliance</span>
            <span>›</span>
            <span className="text-zinc-900">Audit Trail</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-zinc-200">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center">
                AU
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-zinc-900 leading-tight">
                  Security Officer
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Compliance & PII Audit
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-[1300px] w-full mx-auto space-y-6">
          {/* Title and Subtitle */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
              Security & Compliance Audit Trail
            </h1>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Immutable per-user audit trail tracking personal data (PII) access, authorization decisions, and candidate data actions.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Event Type Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3.5 text-xs font-semibold bg-zinc-50 border-zinc-200 rounded-xl gap-2 hover:bg-zinc-100"
                  >
                    <span>{selectedDecision}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white rounded-xl">
                  {["All Events", "Allowed Only", "Denied / Blocked"].map((r) => (
                    <DropdownMenuItem
                      key={r}
                      onClick={() => setSelectedDecision(r)}
                      className="text-xs cursor-pointer"
                    >
                      {r}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search Bar */}
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by user, role, action, or candidate..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-zinc-50 rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400 text-zinc-900"
                />
              </div>
            </div>

            <div className="text-xs font-mono text-zinc-400">
              {filteredLogs.length} event{filteredLogs.length === 1 ? "" : "s"} logged
            </div>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
            {/* Table Headers */}
            <div className="grid grid-cols-12 gap-3 px-6 py-3.5 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/50">
              <div className="col-span-3">TIMESTAMP (UTC)</div>
              <div className="col-span-3">ACTOR & ROLE</div>
              <div className="col-span-3">ACTION / TARGET</div>
              <div className="col-span-3 text-right pr-2">DECISION</div>
            </div>

            {/* Audit Log Rows / Empty State */}
            {loading ? (
              <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
                <p className="font-semibold text-zinc-700">Loading audit trail...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
                <p className="font-semibold text-zinc-700">No Audit Records</p>
                <p>Personal data requests and PII access checks will be recorded here in real-time.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const isAllowed = log.decision === "ALLOWED";

                return (
                  <div key={log.id} className="border-b border-zinc-100 last:border-0">
                    {/* Row Summary */}
                    <div
                      onClick={() => toggleRow(log.id)}
                      className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors cursor-pointer text-xs"
                    >
                      <div className="col-span-3 font-mono text-zinc-500 text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>

                      <div className="col-span-3 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#eae7df] text-zinc-900 font-bold text-xs flex items-center justify-center shrink-0">
                          {log.actor_id.slice(0, 2).toUpperCase() || "US"}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-950 leading-tight">
                            {log.actor_id}
                          </p>
                          <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                            {log.actor_role}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-3">
                        <p className="font-mono text-xs font-semibold text-zinc-900 leading-tight">
                          {log.action}
                        </p>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {log.resource_type}: {log.resource_id}
                        </span>
                      </div>

                      <div className="col-span-3 flex items-center justify-end gap-1.5 pr-2">
                        {isAllowed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ALLOWED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>DENIED</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Audit Log Details Panel */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-3 bg-[#fbfbfa] border-t border-zinc-100 space-y-3 animate-in fade-in-50 duration-150">
                        <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2 shadow-2xs">
                          <div className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                            <span>AUDIT EVENT DETAILS</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-zinc-400 font-medium">Record ID:</span>{" "}
                              <span className="font-mono text-zinc-700">{log.id}</span>
                            </div>
                            <div>
                              <span className="text-zinc-400 font-medium">Client IP:</span>{" "}
                              <span className="font-mono text-zinc-700">{log.ip_address || "N/A"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-zinc-400 font-medium">Context & Reason:</span>{" "}
                              <span className="text-zinc-800 font-medium">{log.details}</span>
                            </div>
                            {log.user_agent && (
                              <div className="col-span-2">
                                <span className="text-zinc-400 font-medium">User Agent:</span>{" "}
                                <span className="font-mono text-[11px] text-zinc-600">{log.user_agent}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
