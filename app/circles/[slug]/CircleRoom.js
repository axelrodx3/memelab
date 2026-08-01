"use client";

import { Crown, LockKeyhole, MessageSquareText, MoreHorizontal, Send, ShieldCheck, UserPlus, Users, VolumeX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CirclePostCard from "../CirclePostCard";

const roleRank = { member: 0, moderator: 1, admin: 2, owner: 3 };

function labelFor(member) {
  return member?.display_name || member?.username || "Deleted member";
}

function Avatar({ member }) {
  const label = labelFor(member);
  return <span className="circle-member-avatar">{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="38px" /> : label.charAt(0).toUpperCase()}</span>;
}

function RoleChip({ role }) {
  return <span className={`circle-role circle-role-${role}`}>{role}</span>;
}

export default function CircleRoom({ circle, membership, members, bannedMembers = [], posts, viewer }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const muted = membership.muted_until && new Date(membership.muted_until).getTime() > Date.now();
  const canInvite = roleRank[membership.role] >= roleRank.admin;
  const canModerate = roleRank[membership.role] >= roleRank.moderator;

  const refreshAfter = async (request, failMessage) => {
    try {
      const response = await request();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || failMessage);
      router.refresh();
      return result;
    } catch (error) {
      setMessage(error.message || failMessage);
      return null;
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    if (!canInvite) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    if (!username.trim()) return;
    setBusy("invite");
    setMessage("");
    const result = await refreshAfter(() => fetch(`/api/circles/${circle.slug}/invites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username }) }), "The Circle invite could not be sent.");
    if (result) event.currentTarget.reset();
    setBusy("");
  };

  const publish = async (event) => {
    event.preventDefault();
    if (muted) return;
    const form = new FormData(event.currentTarget);
    setBusy("publish");
    setMessage("");
    const result = await refreshAfter(() => fetch(`/api/circles/${circle.slug}/posts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), body: form.get("body") }) }), "The Circle post could not be published.");
    if (result) event.currentTarget.reset();
    setBusy("");
  };

  const manage = async (action, targetUserId, extra = {}) => {
    setBusy(`${action}-${targetUserId}`);
    setMessage("");
    await refreshAfter(() => fetch(`/api/circles/${circle.slug}/members`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, targetUserId, ...extra }) }), "That Circle member could not be updated.");
    setBusy("");
  };

  return <section className="circle-room-shell shell"><header className="circle-room-hero glass"><div className="circle-room-mark"><LockKeyhole size={23} /></div><div className="circle-room-copy"><span className="section-label">PRIVATE MEMELAB CIRCLE</span><h1>{circle.name}</h1><p>{circle.description || "A private space for the people inside it."}</p></div><div className="circle-room-meta"><span><Users size={15} /> {circle.member_count} members</span><RoleChip role={membership.role} /></div></header>{message && <p className="social-message" role="status">{message}</p>}
    <div className="circle-room-layout"><section className="circle-main-column"><header className="circle-feed-heading"><div><span className="section-label">THE CIRCLE FEED</span><h2>What’s happening inside.</h2></div><MessageSquareText size={21} /></header>{muted ? <div className="circle-muted-notice glass"><VolumeX size={17} /><span>Your posting is paused until {new Date(membership.muted_until).toLocaleString()}.</span></div> : <form className="circle-composer glass" onSubmit={publish}><input name="title" required maxLength={140} placeholder="Start a conversation…" /><textarea name="body" maxLength={4000} rows={3} placeholder="Share the context, the meme, the thought." /><button type="submit" disabled={busy === "publish"}>{busy === "publish" ? "Posting…" : <><Send size={15} /> Post to Circle</>}</button></form>}<div className="circle-post-feed">{posts.map((post) => <CirclePostCard key={post.id} post={post} viewer={viewer} viewerRole={membership.role} slug={circle.slug} />)}{!posts.length && <div className="circle-feed-empty glass"><MessageSquareText size={25} /><strong>Nothing here yet.</strong><span>Start the first conversation in your Circle.</span></div>}</div></section>
      <aside className="circle-members-card glass"><header><div><span className="section-label">MEMBERS</span><h2>{members.length} inside</h2></div><Users size={19} /></header>{canInvite && <form className="circle-invite-form" onSubmit={invite}><input name="username" required placeholder="Invite by username" /><button type="submit" disabled={busy === "invite"}><UserPlus size={15} /> {busy === "invite" ? "Sending…" : "Invite"}</button></form>}<div className="circle-member-list">{members.map((member) => { const person = member.member; const canManage = canModerate && member.user_id !== viewer.id && roleRank[membership.role] > roleRank[member.role]; const mutedMember = member.muted_until && new Date(member.muted_until).getTime() > Date.now(); return <article className="circle-member-row" key={member.user_id}><Link href={person?.username ? `/u/${person.username}` : "#"}><Avatar member={person} /></Link><div><Link href={person?.username ? `/u/${person.username}` : "#"}>{labelFor(person)}</Link><span><RoleChip role={member.role} />{mutedMember && <em><VolumeX size={11} /> muted</em>}</span></div>{canManage && <details className="circle-member-actions"><summary aria-label={`Manage ${labelFor(person)}`}><MoreHorizontal size={17} /></summary><div>{membership.role !== "moderator" && <select defaultValue={member.role} onChange={(event) => manage("role", member.user_id, { role: event.target.value })} disabled={busy.includes(member.user_id)}><option value="member">Member</option><option value="moderator">Moderator</option>{membership.role === "owner" && <option value="admin">Admin</option>}</select>}{mutedMember ? <button type="button" onClick={() => manage("unmute", member.user_id)}><VolumeX size={13} /> Unmute</button> : <button type="button" onClick={() => manage("mute", member.user_id, { hours: 1 })}><VolumeX size={13} /> Mute 1h</button>}<button type="button" onClick={() => manage("kick", member.user_id)}><X size={13} /> Remove</button>{["owner", "admin"].includes(membership.role) && <button type="button" className="danger" onClick={() => manage("ban", member.user_id)}><ShieldCheck size={13} /> Ban</button>}</div></details>}</article>; })}</div>{bannedMembers.length > 0 && <section className="circle-banned-list"><header><span className="section-label">BANNED</span><span>{bannedMembers.length}</span></header>{bannedMembers.map((member) => <article className="circle-banned-row" key={member.user_id}><Avatar member={member.member} /><div><strong>{labelFor(member.member)}</strong><span>Outside this Circle</span></div><button type="button" disabled={busy === `unban-${member.user_id}`} onClick={() => manage("unban", member.user_id)}>{busy === `unban-${member.user_id}` ? "Restoring…" : "Restore"}</button></article>)}</section>}<footer className="circle-staff-key"><Crown size={14} /><span>Owners, admins and moderators only manage this Circle—not a member’s wider MemeLab account.</span></footer></aside></div></section>;
}
