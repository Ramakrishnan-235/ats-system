"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { requiresApiKey, setSessionApiKey } from "@/lib/api";

export function ApiSession({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(!requiresApiKey);
  const [key, setKey] = useState("");
  const connect = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    setSessionApiKey(key);
    setKey("");
    setConnected(true);
  };
  const disconnect = () => {
    setSessionApiKey("");
    setConnected(false);
  };
  if (!connected) return (
    <main className="min-h-screen grid place-items-center p-8">
      <form onSubmit={connect} className="bg-white p-8 rounded-2xl border border-zinc-200 max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold">Connect to ATS</h1>
        <p className="text-sm text-zinc-600">Enter the API key supplied by your administrator. It stays in memory for this browser session and is cleared on reload or disconnect.</p>
        <label htmlFor="api-key" className="block text-sm font-semibold">API key</label>
        <input id="api-key" type="password" autoComplete="off" required value={key} onChange={event => setKey(event.target.value)} className="w-full border rounded-lg p-3" />
        <button type="submit" className="bg-black text-white rounded-lg px-4 py-2">Connect</button>
      </form>
    </main>
  );
  return <>{requiresApiKey && <button onClick={disconnect} className="fixed bottom-3 right-3 z-50 text-xs border bg-white rounded-lg px-3 py-2 shadow" title="Clear the API credential and loaded data">Disconnect API session</button>}{children}</>;
}
