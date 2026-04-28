import { logger } from "./logger";
import { GatewayLink } from "./gateway-link";
import { bus } from "./event-bus";
import { startServer, stopServer, attachGatewayLink, setDaemonState } from "./server";

const log = logger("daemon");

async function main() {
  log.info("Mission Control daemon v2 starting");
  bus.publish({ kind: "daemon.state", state: "starting", ts: Date.now() });

  await startServer();

  const link = new GatewayLink();
  attachGatewayLink(link);

  link.on("state", (s) => {
    log.info(`gateway state -> ${s}`);
    bus.publish({ kind: "gateway.state", state: s, ts: Date.now() });
  });
  link.on("event", (evt) => {
    log.debug(`gateway event: ${evt.name}`);
    bus.publish({
      kind: "gateway.event",
      name: evt.name,
      payload: evt.payload,
      ts: evt.receivedAt,
    });
  });
  link.on("ready", async () => {
    setDaemonState("ready");
    bus.publish({ kind: "daemon.state", state: "ready", ts: Date.now() });
    try {
      await link.request("health", {});
      log.info("gateway health probe ok");
    } catch (err) {
      log.warn(`health probe failed: ${(err as Error).message}`);
    }
  });

  link.start();

  let shutting = false;
  const shutdown = async (signal: string) => {
    if (shutting) return;
    shutting = true;
    log.info(`received ${signal}, shutting down`);
    setDaemonState("stopping");
    bus.publish({ kind: "daemon.state", state: "stopping", ts: Date.now() });
    link.stop();
    await stopServer();
    setTimeout(() => process.exit(0), 100).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("daemon fatal:", err);
  process.exit(1);
});
