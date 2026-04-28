import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export const config = {
  gateway: {
    url: process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789",
    origin: process.env.OPENCLAW_GATEWAY_ORIGIN ?? "http://localhost:3000",
    token: process.env.OPENCLAW_TOKEN ?? "",
    clientId: "openclaw-control-ui",
    clientMode: "ui",
    clientName: "Mission Control Daemon",
    clientVersion: "2.0.0-dev",
  },
  reconnect: {
    minDelayMs: 500,
    maxDelayMs: 30_000,
    factor: 2,
  },
  request: {
    defaultTimeoutMs: 15_000,
  },
  server: {
    host: process.env.MC_DAEMON_HOST ?? "127.0.0.1",
    port: Number(process.env.MC_DAEMON_PORT ?? 18790),
  },
  logging: {
    level: (process.env.MC_LOG_LEVEL ?? "info") as
      | "debug"
      | "info"
      | "warn"
      | "error",
  },
};
