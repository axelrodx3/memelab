"use client";

import { ArrowBigDown, ArrowBigUp, CornerUpLeft, MessageCircle, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import RelativeTime from "../../components/RelativeTime";
import { createClient } from "../../../lib/supabase/client";

function authorLabel(comment) {
  return comment.author?.display_name || comment.author?.username || "Deleted member";
}

function Comment({ comment, viewer, onReply, children, depth = 0 }) {
  const [vote, setVote] = useState(comment.viewerVote || 0);
  const [score, setScore] = useState(comment.score);

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

  const author = authorLabel(comment);
  const avatarUrl = comment.author?.avatar_url || null;
  const avatar = (
    <>
      {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="34px" /> : author.charAt(0).toUpperCase()}
    </>
  );
  return (
    <article className={`comment-card ${depth ? "comment-reply" : ""}`}>
      {comment.author?.username ? (
        <Link href={`/u/${comment.author.username}`} className={`comment-avatar is-link ${avatarUrl ? "has-image" : ""}`} aria-label={`Open ${author}'s profile`}>
          {avatar}
        </Link>
      ) : <div className={`comment-avatar ${avatarUrl ? "has-image" : ""}`}>{avatar}</div>}
      <div className="comment-main">
        <header>
          {comment.author?.username ? <Link href={`/u/${comment.author.username}`}>{author}</Link> : <strong>{author}</strong>}
          <span><RelativeTime value={comment.created_at} /></span>
        </header>
        <p>{comment.body}</p>
        <div className="comment-actions">
          <button className={vote === 1 ? "active" : ""} onClick={() => castVote(1)} aria-label="Upvote comment"><ArrowBigUp size={16} /></button>
          <strong>{score}</strong>
          <button className={vote === -1 ? "active down" : ""} onClick={() => castVote(-1)} aria-label="Downvote comment"><ArrowBigDown size={16} /></button>
          {viewer && <button className="comment-reply-button" type="button" onClick={() => onReply(comment)}><CornerUpLeft size={14} /> Reply</button>}
        </div>
        {children?.length > 0 && <div className="comment-replies">{children}</div>}
      </div>
    </article>
  );
}

function CommentThread({ comment, commentsByParent, viewer, onReply, depth = 0, seen = new Set() }) {
  if (seen.has(comment.id)) return null;
  const branchSeen = new Set(seen);
  branchSeen.add(comment.id);
  const replies = (commentsByParent.get(comment.id) || []).map((reply) => (
    <CommentThread
      key={reply.id}
      comment={reply}
      commentsByParent={commentsByParent}
      viewer={viewer}
      onReply={onReply}
      depth={Math.min(depth + 1, 2)}
      seen={branchSeen}
    />
  ));
  return <Comment comment={comment} viewer={viewer} onReply={onReply} depth={depth}>{replies}</Comment>;
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
      if (!comment.parent_id || !knownIds.has(comment.parent_id)) {
        nextRoots.push(comment);
        return;
      }
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
    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: viewer.id,
      body: String(form.get("body") || "").trim(),
      parent_id: replyTo?.id || null
    });
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
        {replyTo && (
          <div className="reply-context">
            <span><CornerUpLeft size={13} /> Replying to <strong>{authorLabel(replyTo)}</strong></span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={14} /></button>
          </div>
        )}
        <textarea ref={textareaRef} name="body" required maxLength={4000} rows={3} placeholder={viewer ? (replyTo ? `Reply to ${authorLabel(replyTo)}…` : "Add to the conversation…") : "Log in to join the conversation"} />
        <button disabled={busy}>{busy ? "Posting…" : "Comment"} {!busy && <Send size={14} />}</button>
        {message && <span role="status">{message}</span>}
      </form>
      <div className="comment-list">
        {roots.map((comment) => <CommentThread key={comment.id} comment={comment} commentsByParent={commentsByParent} viewer={viewer} onReply={beginReply} />)}
        {!comments.length && <p className="no-comments">Be the first person to say something.</p>}
      </div>
    </section>
  );
}
