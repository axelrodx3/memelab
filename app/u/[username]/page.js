import {
  CalendarDays, EyeOff, Heart, ImageIcon, MessageCircle, TrendingUp
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { getPublicProfile } from "../../../lib/community";
import { templateHref } from "../../../lib/template-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  return { title: profile ? `${profile.display_name || profile.username} — MemeLab` : "Profile not found — MemeLab" };
}

const PROFILE_TABS = [
  ["posts", "Posts"],
  ["comments", "Comments"],
  ["favorites", "Favorites"]
];

export default async function PublicProfilePage({ params, searchParams }) {
  const { username } = await params;
  const query = await searchParams;
  const requestedTab = query?.tab || "posts";
  const activeTab = PROFILE_TABS.some(([value]) => value === requestedTab) ? requestedTab : "posts";
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  return (
    <main className="profile-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="profile-shell shell">
        <header className="profile-hero glass">
          {profile.banner_url && <div className="profile-banner"><Image src={profile.banner_url} alt="" fill priority sizes="1200px" /></div>}
          <div className="profile-avatar">
            {profile.avatar_url
              ? <Image src={profile.avatar_url} alt={`${profile.display_name || profile.username}'s profile`} fill priority sizes="105px" />
              : (profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="section-label">MEMELAB CREATOR</span>
            <h1>{profile.display_name || profile.username}</h1>
            <p>@{profile.username}</p>
            {!profile.isPrivate && profile.bio && <div className="profile-bio">{profile.bio}</div>}
          </div>
          <div className="profile-stats">
            <span><TrendingUp size={16} /><strong>{profile.karma}</strong> karma</span>
            {!profile.isPrivate && profile.show_activity && <span><ImageIcon size={16} /><strong>{profile.posts.length}</strong> posts</span>}
            <span><CalendarDays size={16} />Joined {profile.created_at?.slice(0, 10)}</span>
          </div>
        </header>

        {profile.isPrivate ? (
          <div className="profile-private glass"><EyeOff size={25} /><strong>This profile is private.</strong><span>Only the creator can see their activity.</span></div>
        ) : profile.show_activity ? (
          <>
            <nav className="profile-tabs glass" aria-label="Profile activity">
              {PROFILE_TABS.map(([value, label]) => (
                <Link
                  href={value === "posts" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${value}`}
                  className={activeTab === value ? "active" : ""}
                  key={value}
                >
                  {label}
                  <span>{profile[value]?.length || 0}</span>
                </Link>
              ))}
            </nav>

            {activeTab === "posts" && (
              <div className="profile-post-grid">
                {profile.posts.map((post) => (
                  <Link href={`/community/${post.id}`} className="profile-post-card glass" key={post.id}>
                    <div><Image src={post.image_url} alt={post.title} fill sizes="(max-width: 700px) 100vw, 33vw" /></div>
                    <h3>{post.title}</h3>
                    <span><TrendingUp size={14} /> {post.vote_score} <MessageCircle size={14} /> {post.comments_count}</span>
                  </Link>
                ))}
                {!profile.posts.length && <div className="profile-empty glass"><ImageIcon size={23} /><strong>No posts yet</strong><span>Published community posts will appear here.</span></div>}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="profile-comment-list">
                {profile.comments.map((comment) => (
                  <Link className="profile-comment-card glass" href={`/community/${comment.post?.id}`} key={comment.id}>
                    <div><MessageCircle size={17} /><span>Commented on <strong>{comment.post?.title || "a community post"}</strong></span><time>{comment.created_at?.slice(0, 10)}</time></div>
                    <p>{comment.body}</p>
                    <span><TrendingUp size={13} /> {comment.score} score</span>
                  </Link>
                ))}
                {!profile.comments.length && <div className="profile-empty glass"><MessageCircle size={23} /><strong>No comments yet</strong><span>Public conversation activity will appear here.</span></div>}
              </div>
            )}

            {activeTab === "favorites" && (
              <div className="profile-favorite-grid">
                {profile.favorites.map((template) => (
                  <Link className="profile-favorite-card glass" href={templateHref(template)} key={template.id}>
                    <div><Image src={template.image_url} alt={template.name} fill sizes="(max-width: 700px) 50vw, 25vw" /></div>
                    <span><Heart size={13} fill="currentColor" /> Saved template</span>
                    <h3>{template.name}</h3>
                  </Link>
                ))}
                {!profile.favorites.length && <div className="profile-empty glass"><Heart size={23} /><strong>No saved templates yet</strong><span>Favorites saved while signed in will appear here.</span></div>}
              </div>
            )}

          </>
        ) : (
          <div className="profile-private glass"><EyeOff size={25} /><strong>Post history is hidden.</strong></div>
        )}
      </section>
    </main>
  );
}
