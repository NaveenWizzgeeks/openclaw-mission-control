"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus, Loader2, Save, X, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  type: string | null;
  path: string;
}

interface InstallForm {
  name: string;
  installId: string;
  source: string;
}

const EMPTY_FORM: InstallForm = { name: "", installId: "", source: "" };

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InstallForm | null>(null);
  const [installing, setInstalling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills").then((r) => r.json());
      if (res.ok) setSkills(res.skills);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const install = async () => {
    if (!form?.name || !form?.installId) return;
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());
      if (res.ok) {
        setForm(null);
        await load();
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Skills
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plugins and extensions installed in <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.openclaw/extensions</code>
          </p>
        </div>
        <Button onClick={() => setForm(EMPTY_FORM)} disabled={!!form}>
          <Plus className="h-4 w-4 mr-1" /> Install Skill
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 text-sm flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {form && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Install a Skill</h3>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (unique)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Install ID (npm pkg or path)" value={form.installId} onChange={(v) => setForm({ ...form, installId: v })} />
            <div className="col-span-2">
              <Field label="Source URL (optional — git URL or registry)" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={install} disabled={installing || !form.name || !form.installId}>
              {installing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Install
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading skills…
        </div>
      ) : skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills installed yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {skills.map((s) => (
            <div key={s.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    {s.version && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">v{s.version}</span>}
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  {s.type && <span className="text-[10px] uppercase mt-2 inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.type}</span>}
                  <p className="text-[10px] text-muted-foreground/60 mt-2 truncate" title={s.path}>{s.path}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
    </div>
  );
}
