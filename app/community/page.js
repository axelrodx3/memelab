import { Flame, ImagePlus, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { getCommunityPosts, getCommunityStats } from "../../lib/community";
import { getViewer } from "../../lib/supabase/server";
import CommunityFeed from "./CommunityFeed";
import CommunityPulse from "./CommunityPulse";

export const metadata = {
  title: "Community | MemeLab",
  description: "Discover images, memes and conversations from the MemeLab community."
};
export const dynamic = "force-dynamic";

const validSorts = new Set(["hot", "new", "top"]);

export default async function CommunityPage({ searchParams }) {
  const params = await searchParams;
  const sort = validSorts.has(params.sort) ? params.sort : "hot";
  const viewer = await getViewer();
  const [posts, stats] = await Promise.all([getCommunityPosts(sort, viewer?.id), getCommunityStats()]);

  return (
    <main className="community-page">
      <div className="ambient ambient-one" />
      <SiteHeader />

      <section className="community-hero community-hero-quiet shell">
        <h1>Stream</h1>
        <Link className="primary-cta" href={viewer ? "/community/create" : "/auth?next=/community/create"}>
          <ImagePlus size={18} /> Post
        </Link>
      </section>

      <nav className="community-mode-nav shell glass" aria-label="Community areas">
        <Link className="active" href="/community">Stream</Link>
        <Link href="/community/rooms">Rooms</Link>
        <Link href="/community/circles">Circles</Link>
      </nav>

      <div className="community-layout shell">
        <section className="feed-column">
          <nav className="feed-tabs glass" aria-label="Community sorting">
            <Link className={sort === "hot" ? "active" : ""} href="/community?sort=hot"><Flame size={16} /> Hot</Link>
            <Link className={sort === "new" ? "active" : ""} href="/community?sort=new"><Sparkles size={16} /> New</Link>
            <Link className={sort === "top" ? "active" : ""} href="/community?sort=top"><TrendingUp size={16} /> Top</Link>
          </nav>
          <CommunityFeed
            posts={posts}
            viewerId={viewer?.id || null}
            showMature={viewer?.mature_content_enabled || false}
          />
        </section>

        <aside className="community-sidebar">
          <CommunityPulse stats={stats} />
          <div className="community-standards glass">
            <h3>Guidelines</h3>
            <ol>
              <li>Keep everything legal.</li>
              <li>Mark mature content clearly.</li>
              <li>Do not spam or manipulate votes.</li>
              <li>Report illegal or abusive activity.</li>
            </ol>
          </div>
          <Link className="studio-sidebar-card" href="/studio">
            <span>Studio</span>
            <strong>Open Studio</strong>
          </Link>
        </aside>
      </div>
    </main>
  );
}
