"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, legacyBackend, requiresApiKey, setSessionApiKey, fetchSession, fetchAuthConfig, signIn, signOut, registerWorkspace, switchWorkspace, getErrorMessage, type Session } from "@/lib/api";

const SessionContext = createContext<{session: Session | null; disconnect: () => Promise<void>}>({session: null, disconnect: async () => {}});
export const useSession = () => useContext(SessionContext);

export function ApiSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!legacyBackend);
  const [legacyConnected, setLegacyConnected] = useState(!requiresApiKey);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [kind, setKind] = useState("corporate");
  const [registering, setRegistering] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (legacyBackend) return;
    let active = true;
    fetchSession().then(value => { if (active) setSession(value); }).catch(error => {
      if (active && !(error instanceof ApiError && error.status === 401)) setError(getErrorMessage(error));
    }).finally(() => { if (active) setLoading(false); });
    fetchAuthConfig().then(value => { if (active) setAllowRegistration(value.registration_enabled); }).catch(() => {});
    const expired = () => { setSession(null); setError("Your session expired. Sign in again."); };
    window.addEventListener("ats-session-expired", expired);
    return () => { active = false; window.removeEventListener("ats-session-expired", expired); };
  }, []);
  async function connect(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (legacyBackend) { setSessionApiKey(key); setKey(""); setLegacyConnected(true); }
      else {
        if (registering) await registerWorkspace({ email, password, name, workspace_name: workspace, workspace_kind: kind });
        else await signIn(email, password);
        setPassword(""); setSession(await fetchSession());
      }
    } catch (error) { setError(getErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setError("");
    try {
      if (legacyBackend) { setSessionApiKey(""); setLegacyConnected(false); }
      else { await signOut(); setSession(null); }
    } catch (error) { setError(getErrorMessage(error)); }
  }
  if (loading) return <main className="min-h-screen grid place-items-center">Loading your workspace…</main>;
  const connected = legacyBackend ? legacyConnected : !!session;
  if (!connected) return (
    <main className="min-h-screen grid place-items-center p-8">
      <form onSubmit={connect} className="bg-white p-8 rounded-2xl border border-zinc-200 max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold">{legacyBackend ? "Connect to ATS" : registering ? "Create your workspace" : "Sign in to ATS"}</h1>
        <p className="text-sm text-zinc-600">Manage hiring in your organization’s workspace.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {legacyBackend ? <label className="block text-sm">API key<input type="password" required value={key} onChange={e => setKey(e.target.value)} className="w-full border rounded-lg p-3 mt-1" /></label> : <>
          {registering && <>
            <label className="block text-sm">Your name<input required maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-3 mt-1" /></label>
            <label className="block text-sm">Workspace name<input required maxLength={200} value={workspace} onChange={e => setWorkspace(e.target.value)} className="w-full border rounded-lg p-3 mt-1" /></label>
            <label className="block text-sm">Workspace type<select value={kind} onChange={e => setKind(e.target.value)} className="w-full border rounded-lg p-3 mt-1"><option value="corporate">Corporate hiring</option><option value="agency">Recruitment agency</option></select></label>
          </>}
          <label className="block text-sm">Email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg p-3 mt-1" /></label>
          <label className="block text-sm">Password<input type="password" required minLength={registering ? 12 : undefined} maxLength={256} autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg p-3 mt-1" /></label>
        </>}
        <button disabled={busy} type="submit" className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? "Please wait…" : registering ? "Create workspace" : "Sign in"}</button>
        {!legacyBackend && allowRegistration && <button type="button" onClick={() => { setRegistering(!registering); setError(""); }} className="block text-sm underline">{registering ? "Already have an account? Sign in" : "Create an account and workspace"}</button>}
      </form>
    </main>
  );
  return <SessionContext.Provider value={{session, disconnect}}>
    <div className="fixed bottom-3 right-3 z-50 flex gap-2 border bg-white rounded-lg p-2 shadow">
      {session && <select aria-label="Active workspace" value={session.user.tenant_id} onChange={async e => {
        try { await switchWorkspace(e.target.value); window.location.reload(); } catch (error) { setError(getErrorMessage(error)); }
      }} className="text-xs max-w-48">{session.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
      {session?.development_mode ? <span className="text-xs px-2 text-amber-700">Local testing mode</span> : <button onClick={disconnect} className="text-xs px-2">Sign out</button>}
    </div>
    {error && <p role="alert" className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-lg p-3 text-red-700">{error}</p>}
    {children}
  </SessionContext.Provider>;
}
