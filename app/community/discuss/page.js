import { Lightbulb, MessageSquareText, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { getDiscussions } from "../../../lib/community";
import { getViewer } from "../../../lib/supabase/server";
import SiteHeader from "../../components/SiteHeader";
import CommunityFeed from "../CommunityFeed";

export const metadata = { title: "Discussions — MemeLab Community" };
export const dynamic = "force-dynamic";

export const CHANNELS = [
  ["general", "General", MessageSquareText, "Everything happening around MemeLab."],
  ["meme-talk", "Meme Talk", MessageSquareText, "Formats, trends, lore and internet culture."],
  ["studio-help", "Studio Help", Wrench, "Editing questions, techniques and creator support."],
  ["ideas", "Ideas & Feedback", Lightbulb, "Shape what MemeLab builds next."],
  ["off-topic", "Off Topic", MessageSquareText, "The corner for everything else."]
];

export default async function DiscussionsPage({ searchParams }) {
  const params = await searchParams;
  const channel = CHANNELS.some(([slug]) => slug === params.channel) ? params.channel : "general";
  const sort = params.sort === "top" ? "top" : "new";
  const viewer = await getViewer();
  const discussions = await getDiscussions(channel, sort, viewer?.id);
  const selected = CHANNELS.find(([slug]) => slug === channel);

  return (
    <main className="community-page discussion-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="discussion-hero shell">
        <div><span className="section-label">MEMELAB DISCUSSIONS</span><h1>Talk shop.<br /><span>Trade ideas.</span></h1><p>Focused rooms for creators, meme historians and everyone building the next thing.</p></div>
        <Link className="primary-cta" href={viewer ? `/community/discuss/create?channel=${channel}` : `/auth?next=/community/discuss/create?channel=${channel}`}><Plus size={17} /> Start a discussion</Link>
      </section>
      <nav className="community-mode-nav shell glass" aria-label="Community areas">
        <Link href="/community">Stream</Link>
        <Link className="active" href="/community/discuss">Discussions</Link>
      </nav>

      <div className="discussion-layout shell">
        <aside className="discussion-channels glass">
          <span className="section-label">CHANNELS</span>
          {CHANNELS.map(([slug, label, Icon, description]) => (
            <Link className={channel === slug ? "active" : ""} href={`/community/discuss?channel=${slug}`} key={slug}>
              <Icon size={16} /><span><strong>{label}</strong><small>{description}</small></span>
            </Link>
          ))}
        </aside>
        <section className="discussion-feed">
          <header className="discussion-feed-heading glass">
            <div><span>CHANNEL</span><h2>{selected[1]}</h2><p>{selected[3]}</p></div>
            <nav><Link className={sort === "new" ? "active" : ""} href={`/community/discuss?channel=${channel}&sort=new`}>Newest</Link><Link className={sort === "top" ? "active" : ""} href={`/community/discuss?channel=${channel}&sort=top`}>Top</Link></nav>
          </header>
          <CommunityFeed
            posts={discussions}
            viewerId={viewer?.id || null}
            showMature
            emptyTitle={`No topics in ${selected[1]} yet.`}
            emptyText="Start the first conversation in this room."
          />
        </section>
      </div>
    </main>
  );
}
