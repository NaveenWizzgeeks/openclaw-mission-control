import { config } from "./config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const min = LEVELS[config.logging.level];

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  if (LEVELS[level] < min) return;
  const ts = new Date().toISOString();
  const tag = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}]`;
  if (extra === undefined) {
    console.log(`${tag} ${msg}`);
  } else {
    console.log(`${tag} ${msg}`, extra);
  }
}

export function logger(scope: string) {
  return {
    debug: (msg: string, extra?: unknown) => emit("debug", scope, msg, extra),
    info: (msg: string, extra?: unknown) => emit("info", scope, msg, extra),
    warn: (msg: string, extra?: unknown) => emit("warn", scope, msg, extra),
    error: (msg: string, extra?: unknown) => emit("error", scope, msg, extra),
  };
}

export type Logger = ReturnType<typeof logger>;
