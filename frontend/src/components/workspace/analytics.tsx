"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { fetchAnalytics, getErrorMessage, type AnalyticsData } from "@/lib/api";

export default function Analytics() {
  const [data,setData]=useState<AnalyticsData|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  async function refresh() {setLoading(true); setError(""); try {setData(await fetchAnalytics());}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}}
  useEffect(()=>{let active=true;fetchAnalytics().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(getErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  return <div className="min-h-screen flex bg-[#faf9f6]"><Sidebar /><main className="p-8 flex-1 max-w-5xl space-y-6">
    <div className="flex justify-between"><h1 className="text-2xl font-bold">Hiring analytics</h1><button disabled={loading} onClick={refresh} className="border rounded-lg px-4 py-2">Refresh</button></div>
    {error && <p role="alert">{error}</p>}{loading && <p>Loading saved records…</p>}
    {data && <><p className="text-sm text-zinc-600">All-time results for this workspace, updated {new Date(data.generated_at).toLocaleString()}.</p>
      <div className="grid grid-cols-2 gap-4"><div className="bg-white border rounded-2xl p-6"><p>Recorded hires</p><p className="text-3xl font-bold mt-2">{data.hires}</p></div><div className="bg-white border rounded-2xl p-6"><p>Average days to hire</p><p className="text-3xl font-bold mt-2">{data.average_days_to_hire?.toFixed(1) ?? "No hires yet"}</p></div></div>
      <section className="bg-white border rounded-2xl p-6"><h2 className="text-lg font-semibold mb-4">Applications by stage</h2>
        <table className="w-full text-left text-sm"><thead><tr><th>Stage</th><th>Applications</th><th>Average saved AI score</th></tr></thead><tbody>{data.stages.map(s=><tr key={s.stage} className="border-t"><td className="py-3">{s.stage}</td><td>{s.count}</td><td>{s.average_score?.toFixed(1) ?? "Not evaluated"}</td></tr>)}</tbody></table>{!data.stages.length && <p className="mt-3">No applications yet.</p>}
      </section><section className="bg-white border rounded-2xl p-6"><h2 className="text-lg font-semibold mb-4">Processing jobs</h2><div className="flex flex-wrap gap-6">{data.processing.map(s=><p key={s.state}>{s.state}: <strong>{s.count}</strong></p>)}</div>{!data.processing.length && <p>No processing jobs yet.</p>}</section>
    </>}
  </main></div>;
}
