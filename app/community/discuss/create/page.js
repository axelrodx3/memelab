import { redirect } from "next/navigation";
import { getViewer } from "../../../../lib/supabase/server";
import SiteHeader from "../../../components/SiteHeader";
import DiscussionForm from "./DiscussionForm";

export const metadata = { title: "Start a discussion — MemeLab" };

export default async function CreateDiscussionPage({ searchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/community/discuss/create");
  const params = await searchParams;
  const allowed = new Set(["general", "meme-talk", "studio-help", "ideas", "off-topic"]);
  const channel = allowed.has(params.channel) ? params.channel : "general";

  return (
    <main className="create-post-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="discussion-create-shell shell">
        <header><span className="section-label">START A DISCUSSION</span><h1>Bring it to<br /><span>the community.</span></h1><p>Choose the right room, make the topic clear, and invite a real conversation.</p></header>
        <DiscussionForm viewer={viewer} initialChannel={channel} />
      </section>
    </main>
  );
}
