import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const validEmailTypes = new Set([
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change"
]);

function safeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/community";
  return value;
}

export async function GET(request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const resultUrl = new URL("/auth/confirmed", url.origin);
  resultUrl.searchParams.set("next", next);

  if (!tokenHash || !type || !validEmailTypes.has(type)) {
    resultUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(resultUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type
  });

  if (error) resultUrl.searchParams.set("error", "expired");
  return NextResponse.redirect(resultUrl);
}
