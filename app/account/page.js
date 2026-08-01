import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { createClient, getViewer } from "../../lib/supabase/server";
import AccountCenter from "./AccountCenter";

export const metadata = { title: "Account Center | MemeLab" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/account");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("account_settings")
    .select("gender,visibility_before_deactivation,notification_email,notification_replies,notification_votes,notification_social,notification_messages,show_online_status,message_permission")
    .eq("user_id", viewer.id)
    .maybeSingle();
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("blocked_id,created_at,blocked:profiles!user_blocks_blocked_id_fkey(username,display_name,avatar_url)")
    .eq("blocker_id", viewer.id)
    .order("created_at", { ascending: false });

  return (
    <main className="account-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <AccountCenter
        profile={viewer}
        initialBlocks={blocks || []}
        settings={settings || {
          gender: null,
          visibility_before_deactivation: "public",
          notification_email: true,
          notification_replies: true,
          notification_votes: true,
          notification_social: true,
          notification_messages: true,
          show_online_status: true,
          message_permission: "everyone"
        }}
      />
    </main>
  );
}
