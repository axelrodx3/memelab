"use client";

import { ArrowBigDown, ArrowBigUp, MessageCircle, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RelativeTime from "../../components/RelativeTime";
import { createClient } from "../../../lib/supabase/client";

function Comment({ comment, viewer }) {
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

  const author = comment.author?.display_name || comment.author?.username || "Deleted member";
  const avatarUrl = comment.author?.avatar_url || null;
  const avatar = (
    <>
      {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="34px" /> : author.charAt(0).toUpperCase()}
    </>
  );
  return (
    <article className="comment-card">
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
        </div>
      </div>
    </article>
  );
}

export default function CommentSection({ postId, comments, viewer }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      body: String(form.get("body") || "").trim()
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    formElement.reset();
    setMessage("");
    router.refresh();
  };

  return (
    <section className="comments-section glass" id="comments">
      <header><MessageCircle size={19} /><h2>{comments.length} comments</h2></header>
      <form className="comment-composer" onSubmit={submit}>
        <textarea name="body" required maxLength={4000} rows={3} placeholder={viewer ? "Add to the conversation…" : "Log in to join the conversation"} />
        <button disabled={busy}>{busy ? "Posting…" : "Comment"} {!busy && <Send size={14} />}</button>
        {message && <span role="status">{message}</span>}
      </form>
      <div className="comment-list">
        {comments.map((comment) => <Comment key={comment.id} comment={comment} viewer={viewer} />)}
        {!comments.length && <p className="no-comments">Be the first person to say something.</p>}
      </div>
    </section>
  );
}
