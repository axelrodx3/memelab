import { NextResponse } from "next/server";

const rateLimits = new Map();
const MAX_EVENTS_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60 * 1000;

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim();
}

function allowReport(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || current.expiresAt <= now) {
    rateLimits.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_EVENTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function POST(request) {
  if (!allowReport(request)) return new NextResponse(null, { status: 204 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 204 });

  const route = cleanText(body.route, "/");
  const event = {
    type: cleanText(body.type, "client").slice(0, 48),
    route: route.startsWith("/") ? route.slice(0, 180) : "/",
    name: cleanText(body.name, "Error").slice(0, 80),
    message: cleanText(body.message, "Unknown client error").slice(0, 320),
    digest: cleanText(body.digest).slice(0, 120)
  };

  console.error("[memelab:client-error]", JSON.stringify(event));
  return NextResponse.json({ received: true }, { status: 202 });
}
