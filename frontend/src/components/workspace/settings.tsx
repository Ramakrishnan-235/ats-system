"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useSession } from "@/components/layout/api-session";
import { addMember, fetchMembers, getErrorMessage, updateWorkspace, type WorkspaceMember } from "@/lib/api";

export default function Settings() {
  const {session} = useSession();
  const workspace = session?.workspaces.find(w => w.id === session.user.tenant_id);
  const admin = session?.user.role === "admin" || session?.user.role === "owner";
  const [name,setName] = useState(workspace?.name ?? "");
  const [members,setMembers] = useState<WorkspaceMember[]>([]);
  const [email,setEmail] = useState("");
  const [role,setRole] = useState("recruiter");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  useEffect(() => {if(admin) fetchMembers().then(setMembers).catch(e => setMessage(getErrorMessage(e)));},[admin]);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {await updateWorkspace(name); setMessage("Workspace name saved. It will appear throughout the app on your next reload.");}
    catch(e) {setMessage(getErrorMessage(e));} finally {setBusy(false);}
  }
  async function member(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {await addMember(email,role); setMembers(await fetchMembers()); setEmail(""); setMessage("Member added to this workspace.");}
    catch(e) {setMessage(getErrorMessage(e));} finally {setBusy(false);}
  }
  return <div className="min-h-screen flex bg-[#faf9f6]"><Sidebar /><main className="p-8 space-y-6 flex-1 max-w-5xl">
    <h1 className="text-2xl font-bold">Workspace settings</h1>
    {message && <p role="status" className="border bg-white p-4 rounded-xl">{message}</p>}
    <form onSubmit={save} className="bg-white border rounded-2xl p-6 space-y-4">
      <label className="block">Workspace name<input disabled={!admin || busy} required maxLength={200} value={name} onChange={e=>setName(e.target.value)} className="block border p-3 rounded-lg w-full mt-2" /></label>
      <p className="text-sm text-zinc-600">Type: {workspace?.kind}. Your role: {session?.user.role}.</p>
      {admin && <button disabled={busy} className="bg-black text-white rounded-lg px-4 py-2">Save name</button>}
    </form>
    <section className="bg-white border rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-semibold">Team</h2>
      {admin ? <><p className="text-sm text-zinc-600">Add an existing account by email. The account holder can then select this workspace after signing in.</p>
        <form onSubmit={member} className="flex flex-wrap gap-3"><input aria-label="Member email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="border rounded-lg p-2" placeholder="Email" />
          <select aria-label="Member role" value={role} onChange={e=>setRole(e.target.value)} className="border rounded-lg p-2">{["admin","recruiter","viewer","interviewer","compliance"].map(r=><option key={r}>{r}</option>)}</select>
          <button disabled={busy} className="bg-black text-white rounded-lg px-4 py-2">Add member</button>
        </form>
        <table className="w-full text-sm text-left"><thead><tr><th className="py-2">Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{members.map(m=><tr key={m.id} className="border-t"><td className="py-3">{m.name}</td><td>{m.email}</td><td>{m.role}</td></tr>)}</tbody></table>
      </> : <p>Workspace administrators manage team access.</p>}
    </section>
    <section className="bg-white border rounded-2xl p-6 space-y-2"><h2 className="text-lg font-semibold">Privacy</h2><p className="text-sm text-zinc-600">Candidate contact details are masked by default. Revealing contacts or opening an original resume requires an authorized role and creates an audit event. Viewers and interviewers cannot reveal contact details.</p></section>
  </main></div>;
}
