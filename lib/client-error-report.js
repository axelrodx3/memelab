const MAX_MESSAGE_LENGTH = 320;
const recentReports = new Set();

function cleanText(value, fallback = "Unknown client error") {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(token|password|secret|key)=\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH) || fallback;
}

export function reportClientError({ type = "client", error, digest = null, route } = {}) {
  if (typeof window === "undefined") return;

  const message = cleanText(error instanceof Error ? error.message : String(error));
  const pathname = typeof route === "string" && route.startsWith("/")
    ? route.slice(0, 180)
    : window.location.pathname;
  const signature = `${type}:${pathname}:${message}`;

  if (recentReports.has(signature)) return;
  recentReports.add(signature);
  if (recentReports.size > 40) recentReports.clear();

  const payload = JSON.stringify({
    type: cleanText(type, "client").slice(0, 48),
    route: pathname,
    name: cleanText(error?.name, "Error").slice(0, 80),
    message,
    digest: typeof digest === "string" ? digest.slice(0, 120) : null
  });

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        "/api/client-errors",
        new Blob([payload], { type: "application/json" })
      );
      if (sent) return;
    }

    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Reporting must never interfere with the recovery path.
  }
}
