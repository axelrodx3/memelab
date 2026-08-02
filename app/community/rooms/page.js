import { Lightbulb, MessageSquareText, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { getDiscussions } from "../../../lib/community";
import { getViewer } from "../../../lib/supabase/server";
import SiteHeader from "../../components/SiteHeader";
import CommunityFeed from "../CommunityFeed";

export const metadata = { title: "Rooms | MemeLab Community" };
export const dynamic = "force-dynamic";

export const ROOMS = [
  ["general", "General", MessageSquareText, "Everything happening around MemeLab."],
  ["meme-talk", "Meme Talk", MessageSquareText, "Formats, trends, lore and internet culture."],
  ["studio-help", "Studio Help", Wrench, "Editing questions, techniques and creator support."],
  ["ideas", "Ideas & Feedback", Lightbulb, "Shape what MemeLab builds next."],
  ["off-topic", "Off Topic", MessageSquareText, "The corner for everything else."]
];

export default async function RoomsPage({ searchParams }) {
  const params = await searchParams;
  const channel = ROOMS.some(([slug]) => slug === params.channel) ? params.channel : "general";
  const sort = params.sort === "top" ? "top" : "new";
  const viewer = await getViewer();
  const discussions = await getDiscussions(channel, sort, viewer?.id);
  const selected = ROOMS.find(([slug]) => slug === channel);

  return (
    <main className="community-page discussion-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="discussion-hero discussion-hero-quiet shell">
        <h1>Rooms</h1>
        <Link className="primary-cta" href={viewer ? `/community/rooms/create?channel=${channel}` : `/auth?next=/community/rooms/create?channel=${channel}`}><Plus size={17} /> Post</Link>
      </section>
      <nav className="community-mode-nav discussion-mode-nav shell glass" aria-label="Community areas"><Link href="/community">Stream</Link><Link className="active" href="/community/rooms">Rooms</Link><Link href="/community/circles">Circles</Link></nav>
      <div className="discussion-layout shell">
        <aside className="discussion-rooms" aria-label="Community rooms"><div className="discussion-rooms-label"><strong>Rooms</strong></div><nav>{ROOMS.map(([slug, label, Icon]) => <Link aria-current={channel === slug ? "page" : undefined} className={channel === slug ? "active" : ""} href={`/community/rooms?channel=${slug}&sort=${sort}`} key={slug}><Icon size={15} /><span>{label}</span></Link>)}</nav></aside>
        <section className="discussion-feed"><header className="discussion-feed-heading"><div><h2>{selected[1]}</h2><p>{selected[3]}</p></div><nav><Link className={sort === "new" ? "active" : ""} href={`/community/rooms?channel=${channel}&sort=new`}>Newest</Link><Link className={sort === "top" ? "active" : ""} href={`/community/rooms?channel=${channel}&sort=top`}>Top</Link></nav></header><CommunityFeed posts={discussions} viewerId={viewer?.id || null} showMature variant="discussion" emptyTitle={`No posts in ${selected[1]} yet.`} emptyText="Start the first conversation in this room." /></section>
      </div>
    </main>
  );
}
