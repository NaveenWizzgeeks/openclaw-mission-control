export interface GatewayEnvelope {
  type: "event" | "req" | "res";
  id?: string;
  ok?: boolean;
  event?: string;
  method?: string;
  params?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

export interface GatewayEvent {
  name: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export type GatewayLinkState =
  | "idle"
  | "connecting"
  | "handshaking"
  | "ready"
  | "reconnecting"
  | "stopped";

export interface PendingRequest {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
  startedAt: number;
}

export class GatewayError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "GatewayError";
  }
}
