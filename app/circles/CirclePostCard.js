"use client";

import { ArrowBigDown, ArrowBigUp, MessageCircle, MoreHorizontal, Pin, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContentActionPortal from "../components/ContentActionPortal";
import RelativeTime from "../components/RelativeTime";

function authorLabel(post) {
  return post.author?.display_name || post.author?.username || "Deleted member";
}

function MemberAvatar({ member, size = 36 }) {
  const label = member?.display_name || member?.username || "?";
  return <span className="circle-member-avatar" style={{ width: size, height: size }}>{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes={`${size}px`} /> : label.charAt(0).toUpperCase()}</span>;
}

export default function CirclePostCard({ post, viewer, viewerRole, slug, detail = false, basePath = "/community/circles" }) {
  const router = useRouter();
  const [vote, setVote] = useState(post.viewerVote || 0);
  const [score, setScore] = useState(post.vote_score || 0);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const author = authorLabel(post);
  const profileHref = post.author?.username ? `/u/${post.author.username}` : null;
  const canDelete = post.author_id === viewer?.id || ["owner", "admin", "moderator"].includes(viewerRole);

  const castVote = async (value) => {
    if (!viewer) return window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
    if (busy) return;
    const previous = vote;
    const next = previous === value ? 0 : value;
    setVote(next);
    setScore((current) => current - previous + next);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/circles/posts/${post.id}/vote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your vote could not be saved.");
      setVote(result.value);
      setScore(result.score);
    } catch (error) {
      setVote(previous);
      setScore((current) => current + previous - next);
      setMessage(error.message || "Your vote could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/circles/posts/${post.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The Circle post could not be deleted.");
      if (detail) window.location.assign(`${basePath}/${slug}`);
      else router.refresh();
    } catch (error) {
      setMessage(error.message || "The Circle post could not be deleted.");
      setBusy(false);
    }
  };

  return (
    <article className={`circle-post glass ${detail ? "circle-post-detail" : ""}`}>
      <header className="circle-post-meta">
        {profileHref ? <Link href={profileHref} aria-label={`Open ${author}'s profile`}><MemberAvatar member={post.author} /></Link> : <MemberAvatar member={post.author} />}
        <div>
          {profileHref ? <Link href={profileHref}>{author}</Link> : <strong>{author}</strong>}
          <span><RelativeTime value={post.created_at} />{post.edited_at && <em className="edited-label">Edited</em>}</span>
        </div>
        {post.is_pinned && <span className="circle-pinned"><Pin size={13} /> Pinned</span>}
        {canDelete && <div className="circle-post-options"><button type="button" onClick={() => setMenuOpen((current) => !current)} aria-label="Circle post options"><MoreHorizontal size={18} /></button>{menuOpen && <button type="button" className="circle-post-remove" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}><Trash2 size={14} /> {post.author_id === viewer?.id ? "Delete post" : "Remove post"}</button>}</div>}
      </header>

      <div className="circle-post-copy">
        {detail ? <h1>{post.title}</h1> : <h2><Link href={`${basePath}/${slug}/posts/${post.id}`}>{post.title}</Link></h2>}
        {post.body && <p>{post.body}</p>}
      </div>

      <footer className="circle-post-actions">
        <div className="circle-vote-control">
          <button type="button" className={vote === 1 ? "active up" : ""} disabled={busy} onClick={() => castVote(1)} aria-label="Upvote Circle post"><ArrowBigUp size={19} /></button>
          <strong>{score}</strong>
          <button type="button" className={vote === -1 ? "active down" : ""} disabled={busy} onClick={() => castVote(-1)} aria-label="Downvote Circle post"><ArrowBigDown size={19} /></button>
        </div>
        {!detail && <Link href={`${basePath}/${slug}/posts/${post.id}#circle-comments`}><MessageCircle size={16} /> {post.comments_count} {post.comments_count === 1 ? "comment" : "comments"}</Link>}
      </footer>
      {message && <p className="circle-post-message" role="status">{message}</p>}

      {confirmDelete && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Delete Circle post"><div className="content-action-card glass delete-confirmation"><button className="content-action-close" type="button" onClick={() => setConfirmDelete(false)} aria-label="Close"><X size={16} /></button><Trash2 size={20} /><span className="section-label">DELETE CIRCLE POST</span><h3>Delete this post forever?</h3><p>Its Circle comments and votes will be permanently removed. This cannot be undone.</p><div><button type="button" onClick={() => setConfirmDelete(false)}>Keep post</button><button type="button" className="danger-action" onClick={deletePost} disabled={busy}>{busy ? "Deleting…" : "Delete forever"}</button></div>{message && <small role="status">{message}</small>}</div></div></ContentActionPortal>}
    </article>
  );
}
