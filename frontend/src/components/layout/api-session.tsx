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
  requestPasswordReset,
  confirmPasswordReset,
  acceptInvitation,
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
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [resetToken, setResetToken] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [allowRegistration, setAllowRegistration] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof URLSearchParams === "undefined" || !window.location?.search) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invitation");
    const rst = params.get("reset");
    if (inv || rst) {
      setTimeout(() => {
        if (inv) {
          setInvitationToken(inv);
          setAuthMode("register");
        } else if (rst) {
          setResetToken(rst);
          setAuthMode("reset");
        }
      }, 0);
    }
  }, []);

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
    setInfoMessage("");
    setBusy(true);
    try {
      if (legacyBackend) {
        setSessionApiKey(key);
        setKey("");
        setLegacyConnected(true);
      } else if (authMode === "forgot") {
        const res = await requestPasswordReset(email.trim().toLowerCase());
        setInfoMessage(res.message);
        setAuthMode("reset");
      } else if (authMode === "reset") {
        const res = await confirmPasswordReset({ token: resetToken.trim(), password });
        setInfoMessage(res.message);
        setPassword("");
        setResetToken("");
        setAuthMode("login");
      } else {
        if (authMode === "register") {
          await registerWorkspace({
            email: email.trim().toLowerCase(),
            password,
            name: name.trim(),
            workspace_name: workspace.trim() || "Workspace",
            workspace_kind: kind,
            invitation_token: invitationToken.trim() || undefined,
          });
        } else {
          await signIn(email.trim().toLowerCase(), password);
          if (invitationToken.trim()) {
            try {
              await acceptInvitation(invitationToken.trim());
            } catch {
              // Ignore if already joined or handled
            }
          }
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
          <form onSubmit={connect} className="bg-white p-8 rounded-2xl border border-zinc-200 max-w-md w-full space-y-4 shadow-sm">
            <h1 className="text-xl font-bold">
              {legacyBackend
                ? "Connect to ATS"
                : authMode === "forgot"
                ? "Recover your password"
                : authMode === "reset"
                ? "Set a new password"
                : authMode === "register"
                ? "Create your workspace"
                : "Sign in to ATS"}
            </h1>
            <p className="text-sm text-zinc-600">
              {authMode === "forgot"
                ? "Enter your account email to receive a password reset token."
                : authMode === "reset"
                ? "Enter your reset token and new password (min. 12 characters)."
                : "Manage hiring in your organization’s workspace."}
            </p>
            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}
            {infoMessage && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">{infoMessage}</p>}
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
            ) : authMode === "forgot" ? (
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
            ) : authMode === "reset" ? (
              <>
                <label className="block text-sm">
                  Reset token
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="rst_..."
                    className="w-full border rounded-lg p-3 mt-1 font-mono text-xs"
                  />
                </label>
                <label className="block text-sm">
                  New password (min 12 characters)
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={256}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-lg p-3 mt-1"
                  />
                </label>
              </>
            ) : (
              <>
                {authMode === "register" && (
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
                    {!invitationToken && (
                      <>
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
                    {invitationToken && (
                      <label className="block text-sm">
                        Invitation Token
                        <input
                          type="text"
                          value={invitationToken}
                          onChange={(e) => setInvitationToken(e.target.value)}
                          className="w-full border rounded-lg p-3 mt-1 font-mono text-xs bg-zinc-50"
                        />
                      </label>
                    )}
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
                    minLength={authMode === "register" ? 12 : undefined}
                    maxLength={256}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-lg p-3 mt-1"
                  />
                </label>
              </>
            )}
            <button disabled={busy} type="submit" className="w-full bg-black text-white rounded-lg px-4 py-2.5 font-medium disabled:opacity-50 transition-colors">
              {busy
                ? "Please wait…"
                : authMode === "forgot"
                ? "Send reset instructions"
                : authMode === "reset"
                ? "Reset password"
                : authMode === "register"
                ? "Create account"
                : "Sign in"}
            </button>
            <div className="flex flex-col gap-2 pt-2 text-xs text-center text-zinc-600">
              {authMode === "login" && (
                <>
                  <a
                    href="#forgot"
                    role="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setAuthMode("forgot");
                      setError("");
                      setInfoMessage("");
                    }}
                    className="underline hover:text-black cursor-pointer"
                  >
                    Forgot your password?
                  </a>
                  {!legacyBackend && allowRegistration && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        setError("");
                        setInfoMessage("");
                      }}
                      className="underline hover:text-black cursor-pointer"
                    >
                      Need an account? Create a workspace
                    </button>
                  )}
                </>
              )}
              {authMode === "register" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                    setInfoMessage("");
                  }}
                  className="underline hover:text-black cursor-pointer"
                >
                  Already have an account? Sign in
                </button>
              )}
              {(authMode === "forgot" || authMode === "reset") && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                    setInfoMessage("");
                  }}
                  className="underline hover:text-black cursor-pointer"
                >
                  Back to Sign In
                </button>
              )}
            </div>
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
