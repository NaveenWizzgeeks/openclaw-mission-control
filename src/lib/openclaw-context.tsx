"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { OpenClawClient } from "./openclaw-client";

// --- Types matching OpenClaw gateway responses ---

export interface OCSession {
  key: string;
  kind: string;
  channel: string;
  updatedAt: number;
  sessionId: string;
  model: string;
  contextTokens: number;
  totalTokens: number;
  status: string;
  startedAt: number;
  lastChannel: string;
  agentId?: string;
}

export interface OCAgent {
  id: string;
  configured: boolean;
  name?: string;
  role?: string;
  model?: string | { primary: string; fallbacks?: string[] };
}

export interface OCCronJob {
  id: string;
  name?: string;
  description?: string;
  enabled: boolean;
  schedule: {
    kind: string;
    expr?: string;
    everyMs?: number;
    at?: string;
  };
  payload: {
    kind: string;
    message?: string;
    text?: string;
  };
  sessionTarget?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount?: number;
}

export interface OCModel {
  id: string;
  provider?: string;
  name?: string;
}

export interface OCTool {
  name: string;
  description?: string;
  enabled?: boolean;
}

export interface OCStatus {
  version?: string;
  model?: string;
  tokens?: { input: number; output: number };
  cache?: { hit: number; cached: number; new: number };
  context?: { used: number; max: number };
  session?: { key: string; updatedAt: string };
  raw?: string;
}

export interface OCHealth {
  ok: boolean;
  uptime?: number;
  gateway?: string;
}

export interface OCMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface SpawnTaskParams {
  task: string;
  agentId?: string;
  model?: string;
  mode?: "run" | "session";
  label?: string;
}

export interface CreateCronParams {
  name?: string;
  description?: string;
  schedule: {
    kind: "cron" | "every" | "at";
    expr?: string;
    everyMs?: number;
    at?: string;
  };
  payload: {
    kind: "agentTurn" | "systemEvent";
    message?: string;
    text?: string;
  };
  sessionTarget?: string;
  agentId?: string;
  enabled?: boolean;
}

export interface OpenClawData {
  connected: boolean;
  loading: boolean;
  sessions: OCSession[];
  agents: OCAgent[];
  cronJobs: OCCronJob[];
  models: OCModel[];
  tools: OCTool[];
  status: OCStatus | null;
  health: OCHealth | null;
  config: Record<string, unknown> | null;
  refresh: () => Promise<void>;
  sendChat: (sessionKey: string, message: string) => Promise<unknown>;
  spawnTask: (params: SpawnTaskParams) => Promise<unknown>;
  createCron: (params: CreateCronParams) => Promise<unknown>;
  deleteCron: (jobId: string) => Promise<unknown>;
  toggleCron: (jobId: string, enabled: boolean) => Promise<unknown>;
  runCron: (jobId: string) => Promise<unknown>;
  getSessionHistory: (sessionKey: string, limit?: number) => Promise<OCMessage[]>;
}

const OpenClawContext = createContext<OpenClawData>({
  connected: false,
  loading: true,
  sessions: [],
  agents: [],
  cronJobs: [],
  models: [],
  tools: [],
  status: null,
  health: null,
  config: null,
  refresh: async () => {},
  sendChat: async () => {},
  spawnTask: async () => {},
  createCron: async () => {},
  deleteCron: async () => {},
  toggleCron: async () => {},
  runCron: async () => {},
  getSessionHistory: async () => [],
});

export function useOpenClaw() {
  return useContext(OpenClawContext);
}

const GATEWAY_URL = "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_TOKEN || "";

export function OpenClawProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<OCSession[]>([]);
  const [agents, setAgents] = useState<OCAgent[]>([]);
  const [cronJobs, setCronJobs] = useState<OCCronJob[]>([]);
  const [models, setModels] = useState<OCModel[]>([]);
  const [tools, setTools] = useState<OCTool[]>([]);
  const [status, setStatus] = useState<OCStatus | null>(null);
  const [health, setHealth] = useState<OCHealth | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const clientRef = useRef<OpenClawClient | null>(null);

  const fetchAll = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.connected) return;

    try {
      const [
        sessionsRes,
        agentsRes,
        cronRes,
        modelsRes,
        toolsRes,
        statusRes,
        healthRes,
        configRes,
      ] = await Promise.allSettled([
        client.request("sessions.list", {}),
        client.request("agents.list", {}),
        client.request("cron.list", {}),
        client.request("models.list", {}),
        client.request("tools.catalog", {}),
        client.request("status", {}),
        client.request("health", {}),
        client.request("config.get", {}),
      ]);

      if (sessionsRes.status === "fulfilled") {
        const val = sessionsRes.value as Record<string, unknown>;
        const list = (val.sessions ?? val.list ?? []) as OCSession[];
        setSessions(Array.isArray(list) ? list : []);
      }
      if (agentsRes.status === "fulfilled") {
        const val = agentsRes.value as Record<string, unknown>;
        const list = (val.agents ?? val.list ?? []) as OCAgent[];
        setAgents(Array.isArray(list) ? list : []);
      }
      if (cronRes.status === "fulfilled") {
        const val = cronRes.value as Record<string, unknown>;
        const list = (val.jobs ?? val.list ?? []) as OCCronJob[];
        setCronJobs(Array.isArray(list) ? list : []);
      }
      if (modelsRes.status === "fulfilled") {
        const val = modelsRes.value as Record<string, unknown>;
        const list = (val.models ?? val.list ?? []) as OCModel[];
        setModels(Array.isArray(list) ? list : []);
      }
      if (toolsRes.status === "fulfilled") {
        const val = toolsRes.value as Record<string, unknown>;
        const list = (val.tools ?? val.list ?? []) as OCTool[];
        setTools(Array.isArray(list) ? list : []);
      }
      if (statusRes.status === "fulfilled") {
        setStatus(statusRes.value as OCStatus);
      }
      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value as OCHealth);
      }
      if (configRes.status === "fulfilled") {
        setConfig(configRes.value as Record<string, unknown>);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const sendChat = useCallback(
    async (sessionKey: string, message: string) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      return client.request("chat.send", { sessionKey, text: message });
    },
    []
  );

  const spawnTask = useCallback(
    async (params: SpawnTaskParams) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request("sessions.spawn", {
        task: params.task,
        agentId: params.agentId || undefined,
        model: params.model || undefined,
        mode: params.mode || "run",
        label: params.label || undefined,
        runtime: "subagent",
      });
      await fetchAll();
      return result;
    },
    [fetchAll]
  );

  const createCron = useCallback(
    async (params: CreateCronParams) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request("cron.add", { job: params });
      await fetchAll();
      return result;
    },
    [fetchAll]
  );

  const deleteCron = useCallback(
    async (jobId: string) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request("cron.remove", { jobId });
      await fetchAll();
      return result;
    },
    [fetchAll]
  );

  const toggleCron = useCallback(
    async (jobId: string, enabled: boolean) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request("cron.update", {
        jobId,
        patch: { enabled },
      });
      await fetchAll();
      return result;
    },
    [fetchAll]
  );

  const runCron = useCallback(
    async (jobId: string) => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request("cron.run", { jobId });
      await fetchAll();
      return result;
    },
    [fetchAll]
  );

  const getSessionHistory = useCallback(
    async (sessionKey: string, limit = 50): Promise<OCMessage[]> => {
      const client = clientRef.current;
      if (!client?.connected) throw new Error("Not connected");
      const result = await client.request<Record<string, unknown>>(
        "sessions.history",
        { sessionKey, limit }
      );
      const messages = (result.messages ?? result.history ?? []) as OCMessage[];
      return Array.isArray(messages) ? messages : [];
    },
    []
  );

  useEffect(() => {
    const client = new OpenClawClient(GATEWAY_URL, GATEWAY_TOKEN, (isConnected) => {
      setConnected(isConnected);
      if (isConnected) fetchAll();
    });
    clientRef.current = client;
    client.connect();

    client.on("*", () => {
      fetchAll();
    });

    const interval = setInterval(() => {
      if (client.connected) fetchAll();
    }, 10000);

    return () => {
      clearInterval(interval);
      client.disconnect();
    };
  }, [fetchAll]);

  return (
    <OpenClawContext.Provider
      value={{
        connected,
        loading,
        sessions,
        agents,
        cronJobs,
        models,
        tools,
        status,
        health,
        config,
        refresh: fetchAll,
        sendChat,
        spawnTask,
        createCron,
        deleteCron,
        toggleCron,
        runCron,
        getSessionHistory,
      }}
    >
      {children}
    </OpenClawContext.Provider>
  );
}
