"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { Settings, Shield, Cpu, Database, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [model, setModel] = useState("gemma2:2b");
  const [reranker, setReranker] = useState("BAAI/bge-reranker-large");
  const [piiEnabled, setPiiEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f6]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav showDateFilter={false} searchPlaceholder="Search settings..." />

        <main className="flex-1 p-8 max-w-4xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
                  System Settings
                </h1>
                <p className="text-xs text-zinc-500 font-medium">
                  Configure LLM engines, retrieval weights, and privacy gates
                </p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              variant="pill"
              className="text-xs px-5 font-semibold gap-1.5"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-zinc-950">
              AI Models & Evaluation Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Stage 3 LLM Evaluator Model
                </label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Stage 2 Cross-Encoder Model
                </label>
                <Input
                  value={reranker}
                  onChange={(e) => setReranker(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-900">
                  Strict PII Redaction Gate
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Always strip names, phone numbers, and emails before LLM inference
                </p>
              </div>
              <Switch
                checked={piiEnabled}
                onCheckedChange={setPiiEnabled}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
