"use client";

import { ArrowBigDown, ArrowBigUp, Check, CornerUpLeft, Flag, MessageCircle, MoreHorizontal, Pencil, Send, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import RelativeTime from "../../components/RelativeTime";
import ContentActionPortal from "../../components/ContentActionPortal";
import { createClient } from "../../../lib/supabase/client";

const EDIT_WINDOW_MS = 60 * 60 * 1000;

function authorLabel(comment) {
  return comment.author?.display_name || comment.author?.username || "Deleted member";
}

function canEdit(createdAt) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= EDIT_WINDOW_MS;
}

function Comment({ comment, viewer, onReply, children, depth = 0, onRefresh }) {
  const [body, setBody] = useState(comment.body);
  const [editedAt, setEditedAt] = useState(comment.edited_at || null);
  const [vote, setVote] = useState(comment.viewerVote || 0);
  const [score, setScore] = useState(comment.score);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const ownsComment = Boolean(viewer?.id && comment.author?.id === viewer.id);
  const editOpen = ownsComment && canEdit(comment.created_at);

  const castVote = async (value) => {
    if (!viewer) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const previous = vote;
    const next = previous === value ? 0 : value;
    setVote(next);
    setScore((current) => current - previous + next);
    const supabase = createClient();
    const operation = next === 0
      ? supabase.from("comment_votes").delete().eq("comment_id", comment.id).eq("user_id", viewer.id)
      : supabase.from("comment_votes").upsert({ comment_id: comment.id, user_id: viewer.id, value: next });
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
    if (!viewer) return;
    setActionBusy(true);
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().from("reports").insert({
      reporter_id: viewer.id,
      comment_id: comment.id,
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
    const { data, error } = await createClient()
      .from("comments")
      .update({ body: String(form.get("body") || "").trim() })
      .eq("id", comment.id)
      .eq("author_id", viewer.id)
      .select("body,edited_at")
      .single();
    setActionBusy(false);
    if (error) return setActionMessage(error.message || "The comment could not be edited.");
    setBody(data.body);
    setEditedAt(data.edited_at);
    setPanel(null);
  };

  const deleteComment = async () => {
    setActionBusy(true);
    const { error } = await createClient().from("comments").delete().eq("id", comment.id).eq("author_id", viewer.id);
    setActionBusy(false);
    if (error) return setActionMessage(error.message || "The comment could not be deleted.");
    onRefresh();
  };

  const author = authorLabel(comment);
  const avatarUrl = comment.author?.avatar_url || null;
  const avatar = <>{avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="34px" /> : author.charAt(0).toUpperCase()}</>;
  return (
    <article className={`comment-card ${depth ? "comment-reply" : ""}`}>
      {comment.author?.username ? <Link href={`/u/${comment.author.username}`} className={`comment-avatar is-link ${avatarUrl ? "has-image" : ""}`} aria-label={`Open ${author}'s profile`}>{avatar}</Link> : <div className={`comment-avatar ${avatarUrl ? "has-image" : ""}`}>{avatar}</div>}
      <div className="comment-main">
        <header>
          {comment.author?.username ? <Link href={`/u/${comment.author.username}`}>{author}</Link> : <strong>{author}</strong>}
          <span><RelativeTime value={comment.created_at} />{editedAt && <em className="edited-label">Edited</em>}</span>
          <div className="content-options comment-options">
            <button className="comment-more" type="button" onClick={() => setMenuOpen((current) => !current)} aria-label="Comment options" aria-expanded={menuOpen}><MoreHorizontal size={16} /></button>
            {menuOpen && <div className="content-menu glass">{ownsComment ? <><button type="button" onClick={() => openPanel("edit")} disabled={!editOpen}><Pencil size={14} /> {editOpen ? "Edit comment" : "Edit window closed"}</button><button type="button" className="danger" onClick={() => openPanel("delete")}><Trash2 size={14} /> Delete comment</button></> : <button type="button" className="danger" onClick={() => openPanel("report")}><Flag size={14} /> Report comment</button>}</div>}
          </div>
        </header>
        <p>{body}</p>
        <div className="comment-actions">
          <button className={vote === 1 ? "active" : ""} onClick={() => castVote(1)} aria-label="Upvote comment"><ArrowBigUp size={16} /></button>
          <strong>{score}</strong>
          <button className={vote === -1 ? "active down" : ""} onClick={() => castVote(-1)} aria-label="Downvote comment"><ArrowBigDown size={16} /></button>
          {viewer && <button className="comment-reply-button" type="button" onClick={() => onReply(comment)}><CornerUpLeft size={14} /> Reply</button>}
        </div>
        {children?.length > 0 && <div className="comment-replies">{children}</div>}
      </div>

      {panel === "report" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Report comment"><form className="content-action-card glass compact-content-card" onSubmit={report}><button className="content-action-close" type="button" onClick={() => setPanel(null)} aria-label="Close"><X size={16} /></button><Flag size={18} /><span className="section-label">REPORT COMMENT</span><h3>What’s going on?</h3><select name="reason" defaultValue="spam"><option value="illegal">Illegal content</option><option value="spam">Spam or manipulation</option><option value="harassment">Harassment</option><option value="mature_unmarked">Unmarked mature content</option><option value="other">Something else</option></select><textarea name="details" maxLength={2000} rows={3} placeholder="Optional details" /><button disabled={actionBusy}>{actionBusy ? "Sending…" : "Send report"}</button>{actionMessage && <p role="status"><Check size={14} />{actionMessage}</p>}</form></div></ContentActionPortal>}
      {panel === "edit" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Edit comment"><form className="content-action-card glass compact-content-card" onSubmit={edit}><button className="content-action-close" type="button" onClick={() => setPanel(null)} aria-label="Close"><X size={16} /></button><Pencil size={18} /><span className="section-label">EDIT COMMENT</span><h3>Refine your comment.</h3><textarea name="body" required maxLength={4000} rows={5} defaultValue={body} /><button disabled={actionBusy}>{actionBusy ? "Saving…" : "Save changes"}</button>{actionMessage && <p role="status">{actionMessage}</p>}</form></div></ContentActionPortal>}
      {panel === "delete" && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Delete comment"><div className="content-action-card glass compact-content-card delete-confirmation"><Trash2 size={20} /><span className="section-label">DELETE COMMENT</span><h3>Delete this comment forever?</h3><p>Any replies underneath it will also be permanently removed.</p><div><button type="button" onClick={() => setPanel(null)}>Keep comment</button><button type="button" className="danger-action" onClick={deleteComment} disabled={actionBusy}>{actionBusy ? "Deleting…" : "Delete forever"}</button></div>{actionMessage && <small role="status">{actionMessage}</small>}</div></div></ContentActionPortal>}
    </article>
  );
}

function CommentThread({ comment, commentsByParent, viewer, onReply, depth = 0, seen = new Set(), onRefresh }) {
  if (seen.has(comment.id)) return null;
  const branchSeen = new Set(seen);
  branchSeen.add(comment.id);
  const replies = (commentsByParent.get(comment.id) || []).map((reply) => <CommentThread key={reply.id} comment={reply} commentsByParent={commentsByParent} viewer={viewer} onReply={onReply} depth={Math.min(depth + 1, 2)} seen={branchSeen} onRefresh={onRefresh} />);
  return <Comment comment={comment} viewer={viewer} onReply={onReply} depth={depth} onRefresh={onRefresh}>{replies}</Comment>;
}

export default function CommentSection({ postId, comments, viewer }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const textareaRef = useRef(null);
  const { roots, commentsByParent } = useMemo(() => {
    const knownIds = new Set(comments.map((comment) => comment.id));
    const nextRoots = [];
    const nextMap = new Map();
    comments.forEach((comment) => {
      if (!comment.parent_id || !knownIds.has(comment.parent_id)) return nextRoots.push(comment);
      const thread = nextMap.get(comment.parent_id) || [];
      thread.push(comment);
      nextMap.set(comment.parent_id, thread);
    });
    return { roots: nextRoots, commentsByParent: nextMap };
  }, [comments]);

  const beginReply = (comment) => {
    setReplyTo(comment);
    setMessage("");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!viewer) {
      window.location.assign(`/auth?next=${encodeURIComponent(window.location.pathname)}#comments`);
      return;
    }
    setBusy(true);
    const form = new FormData(formElement);
    const { error } = await createClient().from("comments").insert({ post_id: postId, author_id: viewer.id, body: String(form.get("body") || "").trim(), parent_id: replyTo?.id || null });
    setBusy(false);
    if (error) return setMessage(error.message);
    formElement.reset();
    setReplyTo(null);
    setMessage("");
    router.refresh();
  };

  return (
    <section className="comments-section glass" id="comments">
      <header><MessageCircle size={19} /><h2>{comments.length} comments</h2></header>
      <form className="comment-composer" onSubmit={submit}>
        {replyTo && <div className="reply-context"><span><CornerUpLeft size={13} /> Replying to <strong>{authorLabel(replyTo)}</strong></span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={14} /></button></div>}
        <textarea ref={textareaRef} name="body" required maxLength={4000} rows={3} placeholder={viewer ? (replyTo ? `Reply to ${authorLabel(replyTo)}…` : "Add to the conversation…") : "Log in to join the conversation"} />
        <button disabled={busy}>{busy ? "Posting…" : "Comment"} {!busy && <Send size={14} />}</button>
        {message && <span role="status">{message}</span>}
      </form>
      <div className="comment-list">{roots.map((comment) => <CommentThread key={comment.id} comment={comment} commentsByParent={commentsByParent} viewer={viewer} onReply={beginReply} onRefresh={() => router.refresh()} />)}{!comments.length && <p className="no-comments">Be the first person to say something.</p>}</div>
    </section>
  );
}
