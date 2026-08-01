"use client";

import { MessageCircle, Send, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContentActionPortal from "../../../../components/ContentActionPortal";
import RelativeTime from "../../../../components/RelativeTime";
import CirclePostCard from "../../../CirclePostCard";

function labelFor(member) {
  return member?.display_name || member?.username || "Deleted member";
}

function Avatar({ member }) {
  const label = labelFor(member);
  return <span className="circle-member-avatar">{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="34px" /> : label.charAt(0).toUpperCase()}</span>;
}

export default function CirclePostThread({ circle, membership, post, comments, viewer }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [commentToDelete, setCommentToDelete] = useState(null);
  const muted = membership.muted_until && new Date(membership.muted_until).getTime() > Date.now();
  const canModerate = ["owner", "admin", "moderator"].includes(membership.role);

  const comment = async (event) => {
    event.preventDefault();
    if (muted) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/circles/posts/${post.id}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: form.get("body") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The Circle comment could not be posted.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setMessage(error.message || "The Circle comment could not be posted.");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (id) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/circles/comments/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The Circle comment could not be deleted.");
      setCommentToDelete(null);
      router.refresh();
    } catch (error) {
      setMessage(error.message || "The Circle comment could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="circle-thread-shell shell"><Link className="back-to-feed" href={`/circles/${circle.slug}`}>← Back to {circle.name}</Link><CirclePostCard post={post} viewer={viewer} viewerRole={membership.role} slug={circle.slug} detail /><section className="circle-comments glass" id="circle-comments"><header><MessageCircle size={19} /><h2>{comments.length} {comments.length === 1 ? "comment" : "comments"}</h2></header>{muted ? <p className="circle-comments-muted">Your Circle commenting is temporarily muted.</p> : <form onSubmit={comment}><textarea name="body" required maxLength={4000} rows={3} placeholder="Add to the Circle conversation…" /><button disabled={busy}>{busy ? "Posting…" : <><Send size={14} /> Comment</>}</button></form>}{message && <p className="circle-thread-message" role="status">{message}</p>}<div className="circle-comment-list">{comments.map((item) => { const removable = item.author_id === viewer.id || canModerate; return <article className="circle-comment" key={item.id}><Link href={item.author?.username ? `/u/${item.author.username}` : "#"}><Avatar member={item.author} /></Link><div><header><Link href={item.author?.username ? `/u/${item.author.username}` : "#"}>{labelFor(item.author)}</Link><span><RelativeTime value={item.created_at} />{item.edited_at && <em className="edited-label">Edited</em>}</span>{removable && <button type="button" disabled={busy} onClick={() => setCommentToDelete(item.id)} aria-label="Delete Circle comment"><Trash2 size={14} /></button>}</header><p>{item.body}</p></div></article>; })}{!comments.length && <p className="circle-no-comments">Be the first person to say something in this Circle.</p>}</div></section>{commentToDelete && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Delete Circle comment"><div className="content-action-card glass delete-confirmation"><button className="content-action-close" type="button" onClick={() => setCommentToDelete(null)} disabled={busy} aria-label="Close"><X size={16} /></button><Trash2 size={20} /><span className="section-label">DELETE CIRCLE COMMENT</span><h3>Delete this comment forever?</h3><p>This cannot be undone.</p><div><button type="button" onClick={() => setCommentToDelete(null)} disabled={busy}>Keep comment</button><button type="button" className="danger-action" onClick={() => deleteComment(commentToDelete)} disabled={busy}>{busy ? "Deleting…" : "Delete forever"}</button></div>{message && <small role="status">{message}</small>}</div></div></ContentActionPortal>}</section>;
}
