"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ApiError,
  legacyBackend,
  requiresApiKey,
  setSessionApiKey,
  fetchSession,
  fetchAuthConfig,
  signIn,
  signOut,
  registerWorkspace,
  getErrorMessage,
  type Session,
} from "@/lib/api";

// Explicit opt-in for local previews; Next.js embeds this value at build time.
const DISABLE_LOGIN_PAGE = process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true";

const BYPASS_SESSION: Session = {
  user: {
    user_id: "usr-recruiter-elena",
    tenant_id: "ws-halden-corp",
    role: "Corporate Recruiter Lead",
    name: "Elena Vance",
    email: "elena.vance@halden.com",
  },
  workspaces: [
    {
      id: "ws-halden-corp",
      name: "Halden Financial · Corporate Recruitment",
      kind: "corporate",
      role: "admin",
    },
  ],
  development_mode: true,
};

const SessionContext = createContext<{
  session: Session | null;
  disconnect: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}>({
  session: DISABLE_LOGIN_PAGE ? BYPASS_SESSION : null,
  disconnect: async () => {},
  refreshSession: async () => null,
});

export const useSession = () => useContext(SessionContext);

export function ApiSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(DISABLE_LOGIN_PAGE ? BYPASS_SESSION : null);
  const [loading, setLoading] = useState(!legacyBackend && !DISABLE_LOGIN_PAGE);
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

    fetchSession()
      .then((value) => {
        if (active) setSession(value || (DISABLE_LOGIN_PAGE ? BYPASS_SESSION : null));
      })
      .catch((err) => {
        if (active && !DISABLE_LOGIN_PAGE) {
          setSession(null);
          if (!(err instanceof ApiError && err.status === 401)) setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchAuthConfig()
      .then((value) => {
        if (active) setAllowRegistration(value.registration_enabled);
      })
      .catch(() => {});

    const expired = () => {
      if (!DISABLE_LOGIN_PAGE) {
        setSession(null);
        setError("Your session expired. Sign in again.");
      }
    };

    window.addEventListener("ats-session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("ats-session-expired", expired);
    };
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (legacyBackend) {
        setSessionApiKey(key);
        setKey("");
        setLegacyConnected(true);
      } else {
        if (registering) {
          await registerWorkspace({ email, password, name, workspace_name: workspace, workspace_kind: kind });
        } else {
          await signIn(email, password);
        }
        setPassword("");
        const currentSession = await fetchSession();
        if (!currentSession) throw new ApiError("Unable to confirm your session. Sign in again.");
        setSession(currentSession);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setError("");
    try {
      if (legacyBackend) {
        setSessionApiKey("");
        setLegacyConnected(false);
      } else {
        await signOut();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!DISABLE_LOGIN_PAGE) {
        setSession(null);
      }
    }
  }

  // If login is NOT disabled and user is not connected, render the login form
  if (!DISABLE_LOGIN_PAGE) {
    if (loading) return <main className="min-h-screen grid place-items-center">Loading your workspace…</main>;
    const connected = legacyBackend ? legacyConnected : !!session;
    if (!connected) {
      return (
        <main className="min-h-screen grid place-items-center p-8">
          <form onSubmit={connect} className="bg-white p-8 rounded-2xl border border-zinc-200 max-w-md w-full space-y-4">
            <h1 className="text-xl font-bold">{legacyBackend ? "Connect to ATS" : registering ? "Create your workspace" : "Sign in to ATS"}</h1>
            <p className="text-sm text-zinc-600">Manage hiring in your organization’s workspace.</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {legacyBackend ? (
              <label className="block text-sm">
                API key
                <input
                  type="password"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full border rounded-lg p-3 mt-1"
                />
              </label>
            ) : (
              <>
                {registering && (
                  <>
                    <label className="block text-sm">
                      Your name
                      <input
                        required
                        maxLength={200}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full border rounded-lg p-3 mt-1"
                      />
                    </label>
                    <label className="block text-sm">
                      Workspace name
                      <input
                        required
                        maxLength={200}
                        value={workspace}
                        onChange={(e) => setWorkspace(e.target.value)}
                        className="w-full border rounded-lg p-3 mt-1"
                      />
                    </label>
                    <label className="block text-sm">
                      Workspace type
                      <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full border rounded-lg p-3 mt-1">
                        <option value="corporate">Corporate hiring</option>
                        <option value="agency">Recruitment agency</option>
                      </select>
                    </label>
                  </>
                )}
                <label className="block text-sm">
                  Email
                  <input
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border rounded-lg p-3 mt-1"
                  />
                </label>
                <label className="block text-sm">
                  Password
                  <input
                    type="password"
                    required
                    minLength={registering ? 12 : undefined}
                    maxLength={256}
                    autoComplete={registering ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-lg p-3 mt-1"
                  />
                </label>
              </>
            )}
            <button disabled={busy} type="submit" className="bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50">
              {busy ? "Please wait…" : registering ? "Create workspace" : "Sign in"}
            </button>
            {!legacyBackend && allowRegistration && (
              <button
                type="button"
                onClick={() => {
                  setRegistering(!registering);
                  setError("");
                }}
                className="block text-sm underline"
              >
                {registering ? "Already have an account? Sign in" : "Create an account and workspace"}
              </button>
            )}
          </form>
        </main>
      );
    }
  }

  async function refreshSession() {
    if (legacyBackend) return null;
    try {
      const current = await fetchSession();
      setSession(current);
      return current;
    } catch {
      return null;
    }
  }

  return (
    <SessionContext.Provider value={{ session: session || (DISABLE_LOGIN_PAGE ? BYPASS_SESSION : null), disconnect, refreshSession }}>
      {error && !DISABLE_LOGIN_PAGE && (
        <p role="alert" className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-lg p-3 text-red-700 shadow-md">
          {error}
        </p>
      )}
      {children}
    </SessionContext.Provider>
  );
}
