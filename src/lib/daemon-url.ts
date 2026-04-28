// Server-only — never import in client components.
// The daemon is a private localhost process; the browser must
// reach it through Next API routes, not directly.

export function daemonUrl(path: string): string {
  const host = process.env.MC_DAEMON_HOST ?? "127.0.0.1";
  const port = process.env.MC_DAEMON_PORT ?? "18790";
  const cleaned = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}:${port}${cleaned}`;
}
