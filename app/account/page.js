import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { createClient, getViewer } from "../../lib/supabase/server";
import AccountCenter from "./AccountCenter";

export const metadata = { title: "Account Center — MemeLab" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/account");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("account_settings")
    .select("gender,visibility_before_deactivation,notification_email,notification_replies,notification_votes")
    .eq("user_id", viewer.id)
    .maybeSingle();

  return (
    <main className="account-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <AccountCenter
        profile={viewer}
        settings={settings || {
          gender: null,
          visibility_before_deactivation: "public",
          notification_email: true,
          notification_replies: true,
          notification_votes: true
        }}
      />
    </main>
  );
}
