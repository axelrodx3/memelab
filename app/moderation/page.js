import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { createClient, getViewer } from "../../lib/supabase/server";
import ModerationQueue from "./ModerationQueue";

export const metadata = { title: "Moderation — MemeLab" };
export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/moderation");
  if (!["moderator", "admin"].includes(viewer.role)) redirect("/community");

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select(`
      id,reason,details,status,created_at,post_id,comment_id,
      reporter:profiles!reports_reporter_id_fkey(username,display_name)
    `)
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <main className="moderation-page">
      <SiteHeader />
      <section className="moderation-shell shell">
        <header><span className="section-label">MODERATION</span><h1>Community queue.</h1><p>Review reports and act on content that violates MemeLab’s legal and safety requirements.</p></header>
        <ModerationQueue reports={reports || []} viewer={viewer} />
      </section>
    </main>
  );
}
