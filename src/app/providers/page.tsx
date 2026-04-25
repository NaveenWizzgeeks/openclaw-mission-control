"use client";

import { useEffect, useState } from "react";
import { Plug, Plus, Trash2, Loader2, Save, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Provider {
  id: string;
  api: string;
  baseUrl?: string;
  hasApiKey: boolean;
  modelCount: number;
  models: Array<{ id: string; name?: string }>;
}

interface ProviderForm {
  id: string;
  api: string;
  baseUrl: string;
  apiKey: string;
  modelsText: string; // comma-separated model ids
}

const EMPTY_FORM: ProviderForm = { id: "", api: "anthropic", baseUrl: "", apiKey: "", modelsText: "" };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/providers").then((r) => r.json());
      if (res.ok) setProviders(res.providers);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form?.id) return;
    setSaving(true);
    setError(null);
    try {
      const models = form.modelsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ id, name: id }));
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          api: form.api,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
          models,
        }),
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
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Remove provider "${id}"? OpenClaw config will be backed up first.`)) return;
    setError(null);
    const res = await fetch(`/api/providers?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => r.json());
    if (res.ok) load();
    else setError(res.error);
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6" /> Providers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure model providers used by your OpenClaw squad.
          </p>
        </div>
        <Button onClick={() => setForm(EMPTY_FORM)} disabled={!!form}>
          <Plus className="h-4 w-4 mr-1" /> Add Provider
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
            <h3 className="font-semibold">New / Update Provider</h3>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID (e.g. openai, ollama)" value={form.id} onChange={(v) => setForm({ ...form, id: v })} />
            <Field label="API type (anthropic | openai | ollama)" value={form.api} onChange={(v) => setForm({ ...form, api: v })} />
            <Field label="Base URL (optional)" value={form.baseUrl} onChange={(v) => setForm({ ...form, baseUrl: v })} />
            <Field label="API Key (optional)" value={form.apiKey} onChange={(v) => setForm({ ...form, apiKey: v })} type="password" />
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Models (comma-separated IDs)</label>
              <textarea
                value={form.modelsText}
                onChange={(e) => setForm({ ...form, modelsText: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                rows={2}
                placeholder="gpt-4o, gpt-4o-mini"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={save} disabled={saving || !form.id}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading providers…
        </div>
      ) : providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No providers configured yet.</p>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{p.id}</h3>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.api}</span>
                    {p.hasApiKey && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">authed</span>}
                  </div>
                  {p.baseUrl && <p className="text-xs text-muted-foreground mt-1">{p.baseUrl}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{p.modelCount} model{p.modelCount !== 1 && "s"}</p>
                  {p.models.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.models.slice(0, 8).map((m) => (
                        <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{m.id}</span>
                      ))}
                      {p.models.length > 8 && <span className="text-[10px] text-muted-foreground">+{p.models.length - 8} more</span>}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
      />
    </div>
  );
}
