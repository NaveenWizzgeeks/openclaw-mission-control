import { logger } from "./logger";
import { GatewayLink } from "./gateway-link";

const log = logger("daemon");

async function main() {
  log.info("Mission Control daemon v2 starting");

  const link = new GatewayLink();

  link.on("state", (s) => log.info(`gateway state -> ${s}`));
  link.on("event", (evt) => {
    log.info(`gateway event: ${evt.name}`);
  });
  link.on("ready", async () => {
    try {
      const health = await link.request("health", {});
      log.info("gateway health ok", health);
    } catch (err) {
      log.error(`health probe failed: ${(err as Error).message}`);
    }
  });

  link.start();

  const shutdown = (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    link.stop();
    setTimeout(() => process.exit(0), 200).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("daemon fatal:", err);
  process.exit(1);
});
