"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Workspace } from "./mission-types";

interface WorkspaceContextData {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  createWorkspace: (data: { name: string; description?: string; icon?: string }) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  selectWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextData>({
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  createWorkspace: async () => ({} as Workspace),
  deleteWorkspace: async () => {},
  selectWorkspace: () => {},
  refreshWorkspaces: async () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

const COLORS = [
  "bg-primary", "bg-violet-600", "bg-emerald-600",
  "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-orange-600",
];

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      const data = await res.json() as { ok: boolean; workspaces: Workspace[] };
      if (data.ok) {
        setWorkspaces(data.workspaces);
        // Auto-select first workspace if none selected
        setActiveId((prev) => {
          if (prev && data.workspaces.find((w) => w.id === prev)) return prev;
          return data.workspaces[0]?.id ?? null;
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Bootstrap: create default workspace if none exist
  const bootstrap = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const data = await res.json() as { ok: boolean; workspaces: Workspace[] };
    if (data.ok && data.workspaces.length === 0) {
      await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Main Workspace",
          description: "Default workspace",
          icon: "⚡",
          color: "bg-primary",
          path: "/home/wizzgeeks/.openclaw/workspace",
          isDefault: true,
        }),
      });
    }
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const createWorkspace = useCallback(async (data: { name: string; description?: string; icon?: string }) => {
    const color = COLORS[workspaces.length % COLORS.length];
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, color }),
    });
    const json = await res.json() as { ok: boolean; workspace: Workspace };
    if (json.ok) {
      setWorkspaces((prev) => [...prev, json.workspace]);
      setActiveId(json.workspace.id);
    }
    return json.workspace;
  }, [workspaces.length]);

  const deleteWorkspace = useCallback(async (id: string) => {
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    setActiveId((prev) => {
      if (prev !== id) return prev;
      const remaining = workspaces.filter((w) => w.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, [workspaces]);

  const selectWorkspace = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      loading,
      createWorkspace,
      deleteWorkspace,
      selectWorkspace,
      refreshWorkspaces: fetchWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
