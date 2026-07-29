import { CalendarDays, ImageIcon, MessageCircle, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { getPublicProfile } from "../../../lib/community";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  return { title: profile ? `${profile.display_name || profile.username} — MemeLab` : "Profile not found — MemeLab" };
}

export default async function PublicProfilePage({ params }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  return (
    <main className="profile-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="profile-shell shell">
        <header className="profile-hero glass">
          <div className="profile-avatar">{(profile.display_name || profile.username).charAt(0).toUpperCase()}</div>
          <div>
            <span className="section-label">MEMELAB CREATOR</span>
            <h1>{profile.display_name || profile.username}</h1>
            <p>@{profile.username}</p>
            {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          </div>
          <div className="profile-stats">
            <span><TrendingUp size={16} /><strong>{profile.karma}</strong> karma</span>
            <span><ImageIcon size={16} /><strong>{profile.posts.length}</strong> posts</span>
            <span><CalendarDays size={16} />Joined {profile.created_at?.slice(0, 10)}</span>
          </div>
        </header>

        <div className="profile-section-heading">
          <div><span className="section-label">POST HISTORY</span><h2>Latest posts.</h2></div>
        </div>
        <div className="profile-post-grid">
          {profile.posts.map((post) => (
            <Link href={`/community/${post.id}`} className="profile-post-card glass" key={post.id}>
              <div><Image src={post.image_url} alt={post.title} fill sizes="(max-width: 700px) 100vw, 33vw" /></div>
              <h3>{post.title}</h3>
              <span><TrendingUp size={14} /> {post.vote_score} <MessageCircle size={14} /> {post.comments_count}</span>
            </Link>
          ))}
          {!profile.posts.length && <div className="profile-empty glass">No posts yet.</div>}
        </div>
      </section>
    </main>
  );
}
