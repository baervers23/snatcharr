/** Node-only startup — loaded from instrumentation.ts when NEXT_RUNTIME=nodejs. */
export async function registerNodeStartup(): Promise<void> {
  try {
    const { ensureGuidarrDataDir } = await import("./lib/guidarr/storage");
    await ensureGuidarrDataDir();
  } catch (err) {
    console.error("[Startup] Guidarr data dir failed:", err);
  }

  // Defer DB/config checks and background tasks so a bad volume mount cannot block the HTTP server.
  setTimeout(() => {
    void (async () => {
      try {
        const { ensureDatabaseReady } = await import("./lib/db/migrate");
        ensureDatabaseReady();
      } catch (err) {
        console.error("[Startup] Database init failed:", err);
      }

      try {
        const { logStartupConfigStatus } = await import("./lib/setup-status");
        logStartupConfigStatus();
      } catch (err) {
        console.error("[Startup] Config check failed:", err);
      }

      try {
        const { getSetting } = await import("./lib/db/settings");
        const { setDownloadDirCache } = await import("./lib/paths");
        const downloadDir = await getSetting("downloadDir");
        if (downloadDir) setDownloadDirCache(downloadDir);
      } catch (err) {
        console.error("[Startup] Settings preload failed:", err);
      }

      try {
        const { startBackgroundTasks, runHealthCheckTask } = await import("./lib/tasks");
        startBackgroundTasks();
        setTimeout(() => {
          runHealthCheckTask().catch((err) => console.error("[Startup] Health check failed:", err));
        }, 8_000);
      } catch (err) {
        console.error("[Startup] Background tasks failed:", err);
      }
    })();
  }, 1_000);
}
