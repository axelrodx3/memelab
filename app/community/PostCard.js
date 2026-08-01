"use client";

import { AlertTriangle, ArrowBigDown, ArrowBigUp, Check, Clock3, Eye, Flag, MessageCircle, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RelativeTime from "../components/RelativeTime";
import ContentActionPortal from "../components/ContentActionPortal";
import { createClient } from "../../lib/supabase/client";

const EDIT_WINDOW_MS = 60 * 60 * 1000;

function authorLabel(post) {
  return post.author?.display_name || post.author?.username || post.sourceLabel;
}

function canEdit(createdAt) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= EDIT_WINDOW_MS;
}

export default function PostCard({ post, viewerId, showMature = false, detail = false }) {
  const [content, setContent] = useState(post);
  const [vote, setVote] = useState(post.viewerVote || 0);
  const [score, setScore] = useState(post.voteScore);
  const [revealed, setRevealed] = useState(showMature || !post.isMature);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const ownsPost = Boolean(viewerId && content.author?.id === viewerId);
  const editOpen = ownsPost && canEdit(content.createdAt);

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
      ? supabase.from("post_votes").delete().eq("post_id", content.id).eq("user_id", viewerId)
      : supabase.from("post_votes").upsert({ post_id: content.id, user_id: viewerId, value: next });
    const { error } = await operation;
    if (error) {
      setVote(previous);
      setScore((current) => current + previous - next);
    }
  };

  const openPanel = (nextPanel) => {
    setMenuOpen(false);
    setActionMessage("");
    setPanel(nextPanel);
  };

  const report = async (event) => {
    event.preventDefault();
    if (!viewerId) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setActionBusy(true);
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().from("reports").insert({
      reporter_id: viewerId,
      post_id: content.id,
      reason: form.get("reason"),
      details: String(form.get("details") || "")
    });
    setActionBusy(false);
    setActionMessage(error ? error.message : "Report sent to the moderation queue.");
  };

  const edit = async (event) => {
    event.preventDefault();
    if (!editOpen) return setActionMessage("The one-hour edit window has closed.");
    setActionBusy(true);
    const form = new FormData(event.currentTarget);
    const changes = {
      title: String(form.get("title") || "").trim(),
      caption: String(form.get("caption") || "").trim(),
      is_mature: form.get("mature") === "on"
    };
    const { data, error } = await createClient()
      .from("posts")
      .update(changes)
      .eq("id", content.id)
      .eq("author_id", viewerId)
      .select("title,caption,is_mature,edited_at")
      .single();
    setActionBusy(false);
    if (error) return setActionMessage(error.message || "The post could not be edited.");
    setContent((current) => ({ ...current, title: data.title, caption: data.caption, isMature: data.is_mature, editedAt: data.edited_at }));
    setPanel(null);
  };

  const deletePost = async () => {
    setActionBusy(true);
    const response = await fetch(`/api/community/posts/${content.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setActionBusy(false);
    if (!response.ok) return setActionMessage(result.error || "The post could not be deleted.");
    window.location.assign("/community");
  };

  const profileHref = content.author?.username ? `/u/${content.author.username}` : null;
  const avatarUrl = content.author?.avatar_url || null;
  const avatar = <>{avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="37px" /> : authorLabel(content).charAt(0).toUpperCase()}</>;

  return (
    <article className={`community-post glass ${detail ? "post-detail-card" : ""}`}>
      <header className="post-meta">
        {profileHref ? <Link href={profileHref} className={`post-avatar is-link ${avatarUrl ? "has-image" : ""}`} aria-label={`Open ${authorLabel(content)}'s profile`}>{avatar}</Link> : <div className={`post-avatar ${avatarUrl ? "has-image" : ""}`}>{avatar}</div>}
        <div>
          {profileHref ? <Link href={profileHref}>{authorLabel(content)}</Link> : <strong>{authorLabel(content)}</strong>}
          <span><RelativeTime value={content.createdAt} />{content.editedAt && <em className="edited-label">Edited</em>}{content.author?.karma ? ` · ${content.author.karma} karma` : ""}</span>
        </div>
        <div className="content-options">
          <button type="button" className="post-more" onClick={() => setMenuOpen((current) => !current)} aria-label="Post options" aria-expanded={menuOpen}><MoreHorizontal size={18} /></button>
          {menuOpen && (
            <div className="content-menu glass">
              {ownsPost ? (
                <>
                  <button type="button" onClick={() => openPanel("edit")} disabled={!editOpen}><Pencil size={15} /> {editOpen ? "Edit post" : "Edit window closed"}</button>
                  <button type="button" className="danger" onClick={() => openPanel("delete")}><Trash2 size={15} /> Delete post</button>
                </>
              ) : (
                <button type="button" className="danger" onClick={() => openPanel("report")}><Flag size={15} /> Report post</button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="post-copy">
        {content.channelSlug && <Link className="discussion-channel-chip" href={`/community/discuss?channel=${content.channelSlug}`}>{content.channelSlug.replace("-", " ")}</Link>}
        {detail ? <h1>{content.title}</h1> : <h2><Link href={`/community/${content.id}`}>{content.title}</Link></h2>}
        {content.caption && <p>{content.caption}</p>}
      </div>

      {content.imageUrl && <div className={`post-image-frame ${!revealed ? "mature-hidden" : ""}`}>
        <Image src={content.imageUrl} alt={revealed ? content.title : "Mature content hidden"} fill sizes={detail ? "(max-width: 900px) 100vw, 760px" : "(max-width: 900px) 100vw, 680px"} unoptimized={content.imageUrl.toLowerCase().includes(".gif")} />
        {!revealed && <div className="mature-gate"><AlertTriangle size={26} /><strong>Mature content</strong><p>The creator marked this post as potentially sensitive.</p><button type="button" onClick={() => setRevealed(true)}><Eye size={16} /> View post</button></div>}
      </div>}

      <footer className="post-actions">
        <div className="vote-control">
          <button type="button" className={vote === 1 ? "active up" : ""} onClick={() => castVote(1)} aria-label="Upvote"><ArrowBigUp size={20} /></button>
          <strong>{score}</strong>
          <button type="button" className={vote === -1 ? "active down" : ""} onClick={() => castVote(-1)} aria-label="Downvote"><ArrowBigDown size={20} /></button>
        </div>
        <Link className="comment-link" href={`/community/${content.id}#comments`}><MessageCircle size={17} /> {content.commentsCount} comments</Link>
        <span className="post-vote-detail">{content.upvotesCount} up · {content.downvotesCount} down</span>
      </footer>

      {panel === "report" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Report post"><form className="content-action-card glass" onSubmit={report}><button className="content-action-close" type="button" onClick={() => setPanel(null)} aria-label="Close"><X size={16} /></button><Flag size={19} /><span className="section-label">REPORT POST</span><h3>What’s going on?</h3><select name="reason" defaultValue="spam"><option value="illegal">Illegal content</option><option value="spam">Spam or manipulation</option><option value="harassment">Harassment</option><option value="mature_unmarked">Unmarked mature content</option><option value="other">Something else</option></select><textarea name="details" maxLength={2000} rows={3} placeholder="Optional details" /><button disabled={actionBusy}>{actionBusy ? "Sending…" : "Send report"}</button>{actionMessage && <p role="status"><Check size={14} />{actionMessage}</p>}</form></div></ContentActionPortal>}
      {panel === "edit" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Edit post"><form className="content-action-card glass content-edit-card" onSubmit={edit}><button className="content-action-close" type="button" onClick={() => setPanel(null)} aria-label="Close"><X size={16} /></button><Pencil size={19} /><span className="section-label">EDIT POST</span><h3>Refine your post.</h3><label>Title<input name="title" required maxLength={140} defaultValue={content.title} /></label><label>Caption<textarea name="caption" maxLength={2000} rows={4} defaultValue={content.caption} /></label><label className="content-check"><input name="mature" type="checkbox" defaultChecked={content.isMature} /> Mark as mature</label><button disabled={actionBusy}>{actionBusy ? "Saving…" : "Save changes"}</button>{actionMessage && <p role="status">{actionMessage}</p>}</form></div></ContentActionPortal>}
      {panel === "delete" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Delete post"><div className="content-action-card glass delete-confirmation"><Trash2 size={20} /><span className="section-label">DELETE POST</span><h3>Delete this post forever?</h3><p>Its image, comments, votes and activity will be permanently removed. This cannot be undone.</p><div><button type="button" onClick={() => setPanel(null)}>Keep post</button><button type="button" className="danger-action" onClick={deletePost} disabled={actionBusy}>{actionBusy ? "Deleting…" : "Delete forever"}</button></div>{actionMessage && <small role="status">{actionMessage}</small>}</div></div></ContentActionPortal>}
    </article>
  );
}
