export const Rancher = async () => ({
  event: async ({ event }) => {
    const headers = { "content-type": "application/json" };
    if (process.env.RANCHER_TOKEN) headers.authorization = `Bearer ${process.env.RANCHER_TOKEN}`;
    try {
      await fetch(`${process.env.RANCHER_URL ?? "http://127.0.0.1:4000"}/v1/hooks/opencode`, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(2000),
      });
    } catch {}
  },
});
