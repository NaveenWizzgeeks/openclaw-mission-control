export class OpenClawClient {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private onStatusChange?: (connected: boolean) => void;
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(
    _url: string,
    _token: string,
    onStatusChange?: (connected: boolean) => void
  ) {
    this.onStatusChange = onStatusChange;
  }

  connect() {
    // Test connectivity by making a health request
    this.request("health", {})
      .then(() => {
        this._connected = true;
        this.onStatusChange?.(true);
      })
      .catch(() => {
        this._connected = false;
        this.onStatusChange?.(false);
        // Retry after 3 seconds
        setTimeout(() => this.connect(), 3000);
      });
  }

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch("/api/openclaw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params: params || {} }),
    });

    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Request failed");
    }

    return json.data as T;
  }

  on(event: string, handler: (data: unknown) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.eventHandlers.get(event)?.delete(handler);
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this._connected = false;
  }

  get connected() {
    return this._connected;
  }
}
