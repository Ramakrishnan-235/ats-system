"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useSession } from "@/components/layout/api-session";
import { createClient, createSubmission, fetchClients, fetchSubmissions, fetchDashboardStats, getErrorMessage, type AgencyClient, type AgencySubmission } from "@/lib/api";

export default function Clients() {
  const {session}=useSession();
  const workspace=session?.workspaces.find(w=>w.id===session.user.tenant_id);
  const [clients,setClients]=useState<AgencyClient[]>([]);
  const [submissions,setSubmissions]=useState<AgencySubmission[]>([]);
  const [applications,setApplications]=useState<{id:string;label:string}[]>([]);
  const [name,setName]=useState(""); const [client,setClient]=useState(""); const [application,setApplication]=useState("");
  const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function refresh(){const [c,s,d]=await Promise.all([fetchClients(),fetchSubmissions(),fetchDashboardStats()]);setClients(c);setSubmissions(s);setApplications(Object.values(d.pipeline).flat().filter(a=>a.application_id && !["Withdrawn","Rejected"].includes(a.stage)).map(a=>({id:a.application_id!,label:`${a.name} · ${a.summary}`})));}
  useEffect(()=>{let active=true;if(workspace?.kind==="agency") Promise.all([fetchClients(),fetchSubmissions(),fetchDashboardStats()]).then(([c,s,d])=>{if(!active)return;setClients(c);setSubmissions(s);setApplications(Object.values(d.pipeline).flat().filter(a=>a.application_id && !["Withdrawn","Rejected"].includes(a.stage)).map(a=>({id:a.application_id!,label:`${a.name} · ${a.summary}`})));}).catch(e=>{if(active)setMessage(getErrorMessage(e));});return()=>{active=false;};},[workspace?.kind]);
  async function add(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{await createClient(name);setName("");await refresh();}catch(e){setMessage(getErrorMessage(e));}finally{setBusy(false);}}
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{await createSubmission(client,application);await refresh();setMessage("Submission saved with a masked candidate snapshot.");}catch(e){setMessage(getErrorMessage(e));}finally{setBusy(false);}}
  return <div className="min-h-screen flex bg-[#faf9f6]"><Sidebar /><main className="p-8 flex-1 max-w-5xl space-y-6"><h1 className="text-2xl font-bold">Clients and submissions</h1>{message && <p role="status">{message}</p>}
    {workspace?.kind!=="agency" ? <p>This page is available in recruitment agency workspaces.</p> : <>
      <form onSubmit={add} className="bg-white border rounded-2xl p-6 flex gap-3"><input aria-label="Client name" required maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="Client organization" className="border rounded-lg p-2 flex-1"/><button disabled={busy} className="bg-black text-white rounded-lg px-4 py-2">Add client</button></form>
      <form onSubmit={submit} className="bg-white border rounded-2xl p-6 space-y-4"><h2 className="font-semibold">Submit an application</h2><select aria-label="Client" required value={client} onChange={e=>setClient(e.target.value)} className="border rounded-lg p-2 w-full"><option value="">Select client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Application" required value={application} onChange={e=>setApplication(e.target.value)} className="border rounded-lg p-2 w-full"><option value="">Select application</option>{applications.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select><button disabled={busy} className="bg-black text-white rounded-lg px-4 py-2">Save submission</button></form>
      <section className="bg-white border rounded-2xl p-6"><h2 className="font-semibold mb-4">Saved submissions</h2>{!submissions.length && <p>No submissions yet.</p>}<table className="w-full text-left text-sm"><thead><tr><th>Client</th><th>Status</th><th>Created</th></tr></thead><tbody>{submissions.map(s=><tr key={s.id} className="border-t"><td className="py-3">{s.client_name}</td><td>{s.status}</td><td>{new Date(s.created_at).toLocaleString()}</td></tr>)}</tbody></table></section>
    </>}
  </main></div>;
}

