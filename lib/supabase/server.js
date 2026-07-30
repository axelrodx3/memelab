import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. Middleware refreshes them.
          }
        }
      }
    }
  );
}

export function createAdminClient() {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function getViewer() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,username,display_name,avatar_url,banner_url,bio,role,karma,
      mature_content_enabled,username_changed_at,profile_visibility,
      show_activity,account_status,deactivated_at,created_at
    `)
    .eq("id", data.claims.sub)
    .maybeSingle();

  if (!profile) return null;
  return { ...profile, email: data.claims.email || null };
}
