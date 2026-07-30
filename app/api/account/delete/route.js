import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deleteMemberAccount } from "../../../../lib/account-deletion.mjs";
import { createClient } from "../../../../lib/supabase/server";

export async function DELETE(request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email = claimsData?.claims?.email;
  if (claimsError || !userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.password) return NextResponse.json({ error: "Enter your current password." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey) {
    return NextResponse.json({ error: "Account deletion is temporarily unavailable." }, { status: 503 });
  }

  const verifier = createAdminClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: passwordError } = await verifier.auth.signInWithPassword({ email, password: body.password });
  if (passwordError) return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });

  const admin = createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    await deleteMemberAccount(admin, userId);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Account deletion failed." }, { status: 500 });
  }

  await supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ deleted: true });
}
