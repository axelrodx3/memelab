"use client";

import { AlertTriangle, ArrowBigDown, ArrowBigUp, Eye, Flag, MessageCircle, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RelativeTime from "../components/RelativeTime";
import { createClient } from "../../lib/supabase/client";

function authorLabel(post) {
  return post.author?.display_name || post.author?.username || post.sourceLabel;
}

export default function PostCard({ post, viewerId, showMature = false, detail = false }) {
  const [vote, setVote] = useState(post.viewerVote || 0);
  const [score, setScore] = useState(post.voteScore);
  const [revealed, setRevealed] = useState(showMature || !post.isMature);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const castVote = async (value) => {
    if (!viewerId) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const previous = vote;
    const next = previous === value ? 0 : value;
    setVote(next);
    setScore((current) => current - previous + next);

    const supabase = createClient();
    const operation = next === 0
      ? supabase.from("post_votes").delete().eq("post_id", post.id).eq("user_id", viewerId)
      : supabase.from("post_votes").upsert({
        post_id: post.id,
        user_id: viewerId,
        value: next
      });
    const { error } = await operation;
    if (error) {
      setVote(previous);
      setScore((current) => current + previous - next);
    }
  };

  const report = async (event) => {
    event.preventDefault();
    if (!viewerId) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({
      reporter_id: viewerId,
      post_id: post.id,
      reason: form.get("reason"),
      details: String(form.get("details") || "")
    });
    setReportMessage(error ? error.message : "Report sent to the moderation queue.");
  };

  const profileHref = post.author?.username ? `/u/${post.author.username}` : null;
  const avatarUrl = post.author?.avatar_url || null;

  return (
    <article className={`community-post glass ${detail ? "post-detail-card" : ""}`}>
      <header className="post-meta">
        <div className={`post-avatar ${avatarUrl ? "has-image" : ""}`}>
          {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="37px" /> : authorLabel(post).charAt(0).toUpperCase()}
        </div>
        <div>
          {profileHref ? <Link href={profileHref}>{authorLabel(post)}</Link> : <strong>{authorLabel(post)}</strong>}
          <span><RelativeTime value={post.createdAt} />{post.author?.karma ? ` · ${post.author.karma} karma` : ""}</span>
        </div>
        <button type="button" className="post-more" onClick={() => setReportOpen((current) => !current)} aria-label="Post options">
          <MoreHorizontal size={18} />
        </button>
      </header>

      <div className="post-copy">
        {post.channelSlug && <Link className="discussion-channel-chip" href={`/community/discuss?channel=${post.channelSlug}`}>{post.channelSlug.replace("-", " ")}</Link>}
        {detail ? <h1>{post.title}</h1> : <h2><Link href={`/community/${post.id}`}>{post.title}</Link></h2>}
        {post.caption && <p>{post.caption}</p>}
      </div>

      {post.imageUrl && <div className={`post-image-frame ${!revealed ? "mature-hidden" : ""}`}>
        <Image
          src={post.imageUrl}
          alt={revealed ? post.title : "Mature content hidden"}
          fill
          sizes={detail ? "(max-width: 900px) 100vw, 760px" : "(max-width: 900px) 100vw, 680px"}
          unoptimized={post.imageUrl.toLowerCase().includes(".gif")}
        />
        {!revealed && (
          <div className="mature-gate">
            <AlertTriangle size={26} />
            <strong>Mature content</strong>
            <p>The creator marked this post as potentially sensitive.</p>
            <button type="button" onClick={() => setRevealed(true)}><Eye size={16} /> View post</button>
          </div>
        )}
      </div>}

      <footer className="post-actions">
        <div className="vote-control">
          <button type="button" className={vote === 1 ? "active up" : ""} onClick={() => castVote(1)} aria-label="Upvote">
            <ArrowBigUp size={20} />
          </button>
          <strong>{score}</strong>
          <button type="button" className={vote === -1 ? "active down" : ""} onClick={() => castVote(-1)} aria-label="Downvote">
            <ArrowBigDown size={20} />
          </button>
        </div>
        <Link className="comment-link" href={`/community/${post.id}#comments`}>
          <MessageCircle size={17} /> {post.commentsCount} comments
        </Link>
        <span className="post-vote-detail">{post.upvotesCount} up · {post.downvotesCount} down</span>
      </footer>

      {reportOpen && (
        <form className="report-panel" onSubmit={report}>
          <div><Flag size={15} /><strong>Report this post</strong></div>
          <select name="reason" defaultValue="spam">
            <option value="illegal">Illegal content</option>
            <option value="spam">Spam or manipulation</option>
            <option value="harassment">Harassment</option>
            <option value="mature_unmarked">Unmarked mature content</option>
            <option value="other">Something else</option>
          </select>
          <textarea name="details" maxLength={2000} rows={2} placeholder="Optional details" />
          <button type="submit">Send report</button>
          {reportMessage && <span role="status">{reportMessage}</span>}
        </form>
      )}
    </article>
  );
}
