"use client";

import { Check, Clock3, MessageCircle, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function MemberAvatar({ member }) {
  const label = member.display_name || member.username;
  return <span className="social-avatar">{member.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="52px" /> : label.charAt(0).toUpperCase()}</span>;
}

function FriendCard({ item, mode, onAction, busy }) {
  const member = item.member;
  if (!member) return null;
  const waiting = busy === member.id;

  return (
    <article className="friend-card glass">
      <Link href={`/u/${member.username}`} className="friend-card-member">
        <MemberAvatar member={member} />
        <span><strong>{member.display_name || member.username}</strong><small>@{member.username}</small></span>
      </Link>
      <div className="friend-card-actions">
        {mode === "incoming" && <><button className="friend-accept" type="button" onClick={() => onAction("accept", member.id)} disabled={waiting}><Check size={14} /> {waiting ? "Working…" : "Accept"}</button><button className="friend-icon" type="button" onClick={() => onAction("decline", member.id)} disabled={waiting} aria-label="Decline request"><X size={15} /></button></>}
        {mode === "outgoing" && <button className="friend-muted" type="button" onClick={() => onAction("cancel", member.id)} disabled={waiting}><Clock3 size={14} /> {waiting ? "Working…" : "Request sent"}</button>}
        {mode === "friends" && <><Link className="friend-message" href={`/messages?with=${encodeURIComponent(member.username)}`}><MessageCircle size={14} /> Message</Link><button className="friend-icon" type="button" onClick={() => onAction("remove", member.id)} disabled={waiting} aria-label="Remove friend"><UserMinus size={15} /></button></>}
      </div>
    </article>
  );
}

function FriendSection({ eyebrow, title, description, icon: Icon, items, mode, onAction, busy, empty }) {
  return (
    <section className="social-section">
      <header><div><span className="section-label">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><Icon size={22} /></header>
      <div className="friend-grid">
        {items.map((item) => <FriendCard key={item.id} item={item} mode={mode} onAction={onAction} busy={busy} />)}
        {!items.length && <div className="social-empty glass"><Icon size={24} /><strong>{empty.title}</strong><span>{empty.copy}</span></div>}
      </div>
    </section>
  );
}

export default function FriendsCenter({ groups }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const friendTitle = `${groups.friends.length} ${groups.friends.length === 1 ? "friend" : "friends"}`;

  const onAction = async (action, targetUserId) => {
    setBusy(targetUserId);
    setMessage("");
    try {
      const response = await fetch("/api/social/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, targetUserId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That friend action could not be completed.");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "That friend action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="social-shell shell">
      <header className="social-hero"><div><span className="section-label">YOUR SOCIAL SPACE</span><h1>Friends, in one place.</h1><p>Keep up with the people behind the posts, projects and conversations you like.</p></div><Link className="social-hero-link" href="/messages"><MessageCircle size={16} /> Open messages</Link></header>
      {message && <p className="social-message" role="status">{message}</p>}
      <FriendSection eyebrow="REQUESTS" title="Waiting for you" description="Accept someone new or pass for now." icon={UserPlus} items={groups.incoming} mode="incoming" onAction={onAction} busy={busy} empty={{ title: "No incoming requests", copy: "When someone wants to connect, they’ll land here." }} />
      <FriendSection eyebrow="YOUR FRIENDS" title={friendTitle} description="Your accepted MemeLab connections." icon={Users} items={groups.friends} mode="friends" onAction={onAction} busy={busy} empty={{ title: "Your friend list is open", copy: "Add a creator from their profile when you find someone worth following." }} />
      <FriendSection eyebrow="OUTGOING" title="Requests you sent" description="You can cancel a pending request at any time." icon={Clock3} items={groups.outgoing} mode="outgoing" onAction={onAction} busy={busy} empty={{ title: "No pending requests", copy: "Friend requests you send will stay here until they’re answered." }} />
    </section>
  );
}
