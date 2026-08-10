export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeStartup } = await import("./instrumentation.node");
    await registerNodeStartup();
  }
}
