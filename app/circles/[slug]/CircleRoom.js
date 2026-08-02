"use client";

import { Crown, MessageSquareText, MoreHorizontal, Pencil, Search, Send, ShieldCheck, Trash2, UserCheck, UserPlus, Users, VolumeX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CirclePostCard from "../CirclePostCard";
import CircleIdentityEditor, { CircleAvatar, CircleCover } from "../CircleIdentity";
import ContentActionPortal from "../../components/ContentActionPortal";

const roleRank = { member: 0, moderator: 1, admin: 2, owner: 3 };

function labelFor(member) {
  return member?.display_name || member?.username || "Deleted member";
}

function MemberAvatar({ member }) {
  const label = labelFor(member);
  return <span className="circle-member-avatar">{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="38px" /> : label.charAt(0).toUpperCase()}</span>;
}

function RoleChip({ role }) {
  return <span className={`circle-role circle-role-${role}`}>{role}</span>;
}

function MemberSearch({ circle, onInvite, busy }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/circles/${circle.slug}/members/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json();
        if (response.ok) setMatches(result.members || []);
      } catch (error) {
        if (error.name !== "AbortError") setMatches([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [circle.slug, open, query]);

  const select = async (member) => {
    const invited = await onInvite(member);
    if (invited) {
      setQuery("");
      setMatches([]);
      setOpen(false);
    }
  };

  return <div className="circle-member-search"><label><Search size={15} /><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="Invite by username" aria-label="Find a member to invite" /></label>{open && <div className="circle-search-results">{loading && <p>Finding members…</p>}{!loading && matches.map((member) => <button type="button" key={member.id} onClick={() => select(member)} disabled={busy}><MemberAvatar member={member} /><span><strong>{labelFor(member)}</strong><small>@{member.username}{member.isFriend ? " · Friend" : ""}</small></span><UserPlus size={15} /></button>)}{!loading && !matches.length && <p>{query ? "No invite matches yet." : "Friends appear here first."}</p>}</div>}</div>;
}

function ManagementActions({ membership, member, muted, onAction, busy }) {
  const owner = membership.role === "owner";
  const actions = [];
  if (owner && member.role !== "admin") actions.push(["role", "Make admin", { role: "admin" }]);
  if (member.role === "member") actions.push(["role", "Make moderator", { role: "moderator" }]);
  if (member.role === "moderator") actions.push(["role", "Make member", { role: "member" }]);
  if (owner && member.role === "admin") actions.push(["role", "Make moderator", { role: "moderator" }]);
  return <details className="circle-member-actions"><summary aria-label={`Manage ${labelFor(member.member)}`} title={`Manage ${labelFor(member.member)}`}><MoreHorizontal size={17} /></summary><div><span className="circle-member-actions-title">MEMBER TOOLS</span>{actions.map(([action, label, extra]) => <button type="button" key={label} onClick={() => onAction(action, member.user_id, extra)} disabled={busy}><UserCheck size={13} /> {label}</button>)}{muted ? <button type="button" onClick={() => onAction("unmute", member.user_id)} disabled={busy}><VolumeX size={13} /> Unmute</button> : <button type="button" onClick={() => onAction("mute", member.user_id, { hours: 1 })} disabled={busy}><VolumeX size={13} /> Mute 1 hour</button>}<button type="button" onClick={() => onAction("kick", member.user_id)} disabled={busy}><X size={13} /> Remove</button>{["owner", "admin"].includes(membership.role) && <button type="button" className="danger" onClick={() => onAction("ban", member.user_id)} disabled={busy}><ShieldCheck size={13} /> Ban from Circle</button>}</div></details>;
}

function CircleMembersPanel({ circle, membership, members, bannedMembers, viewer, canInvite, canModerate, onInvite, onManage, busy, onClose }) {
  return <section className="circle-members-card circle-members-dialog glass"><button className="content-action-close" type="button" onClick={onClose} aria-label="Close members"><X size={16} /></button><header><div><span className="section-label">MEMBERS</span><h2>{members.length} inside</h2></div><Users size={19} /></header>{canInvite && <MemberSearch circle={circle} onInvite={onInvite} busy={busy === "invite"} />}<div className="circle-member-list">{members.map((member) => { const person = member.member; const canManage = canModerate && member.user_id !== viewer.id && roleRank[membership.role] > roleRank[member.role]; const mutedMember = member.muted_until && new Date(member.muted_until).getTime() > Date.now(); return <article className="circle-member-row" key={member.user_id}><Link href={person?.username ? `/u/${person.username}` : "#"}><MemberAvatar member={person} /></Link><div><Link href={person?.username ? `/u/${person.username}` : "#"}>{labelFor(person)}</Link><span><RoleChip role={member.role} />{mutedMember && <em><VolumeX size={11} /> muted</em>}</span></div>{canManage && <ManagementActions membership={membership} member={member} muted={mutedMember} onAction={onManage} busy={busy.includes(member.user_id)} />}</article>; })}</div>{canModerate && <p className="circle-member-help">Use ⋯ beside a member to manage roles, mutes and access.</p>}{bannedMembers.length > 0 && <section className="circle-banned-list"><header><span className="section-label">BANNED</span><span>{bannedMembers.length}</span></header>{bannedMembers.map((member) => <article className="circle-banned-row" key={member.user_id}><MemberAvatar member={member.member} /><div><strong>{labelFor(member.member)}</strong><span>Outside this Circle</span></div><button type="button" disabled={busy === `unban-${member.user_id}`} onClick={() => onManage("unban", member.user_id)}>{busy === `unban-${member.user_id}` ? "Restoring…" : "Restore"}</button></article>)}</section>}<footer className="circle-staff-key"><Crown size={14} /><span>Circle staff only manage this Circle. A member’s wider MemeLab account is never affected.</span></footer></section>;
}

export default function CircleRoom({ circle, membership, members, bannedMembers = [], posts, viewer, basePath = "/community/circles" }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const muted = membership.muted_until && new Date(membership.muted_until).getTime() > Date.now();
  const canInvite = roleRank[membership.role] >= roleRank.admin;
  const canModerate = roleRank[membership.role] >= roleRank.moderator;
  const isOwner = membership.role === "owner";

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

  const inviteMember = async (member) => {
    if (!canInvite) return false;
    setBusy("invite");
    setMessage("");
    const result = await refreshAfter(() => fetch(`/api/circles/${circle.slug}/invites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: member.username }) }), "The Circle invite could not be sent.");
    setBusy("");
    return Boolean(result);
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

  const deleteCircle = async () => {
    setBusy("delete-circle");
    setMessage("");
    try {
      const response = await fetch(`/api/circles/${circle.slug}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "This Circle could not be deleted.");
      window.location.assign(basePath);
    } catch (error) {
      setMessage(error.message || "This Circle could not be deleted.");
      setBusy("");
      setDeleteOpen(false);
    }
  };

  return <section className="circle-room-shell shell"><header className="circle-room-hero glass"><CircleCover circle={circle} /><div className="circle-room-identity"><CircleAvatar circle={circle} size={82} /><div className="circle-room-copy"><span className="section-label">PRIVATE MEMELAB CIRCLE</span><h1>{circle.name}</h1><p>{circle.description || "A private space for the people inside it."}</p></div><div className="circle-room-meta"><button type="button" className="circle-member-count" onClick={() => setMembersOpen(true)}><Users size={15} /> {circle.member_count} members</button><RoleChip role={membership.role} /></div>{isOwner && <div className="circle-owner-controls"><button type="button" className="circle-customize-button" onClick={() => setIdentityOpen(true)}><Pencil size={14} /> Customize</button><button type="button" className="circle-members-button" onClick={() => setMembersOpen(true)}><Users size={14} /> Members</button><details className="circle-owner-menu"><summary aria-label="Circle owner options"><MoreHorizontal size={17} /></summary><div><button type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete Circle</button></div></details></div>}</div></header>{message && <p className="social-message" role="status">{message}</p>}
    <div className="circle-room-layout"><section className="circle-main-column"><header className="circle-feed-heading"><div><span className="section-label">THE CIRCLE FEED</span><h2>What’s happening inside.</h2></div><MessageSquareText size={21} /></header>{muted ? <div className="circle-muted-notice glass"><VolumeX size={17} /><span>Your posting is paused until {new Date(membership.muted_until).toLocaleString()}.</span></div> : <form className="circle-composer glass" onSubmit={publish}><input name="title" required maxLength={140} placeholder="Start a conversation…" /><textarea name="body" maxLength={4000} rows={3} placeholder="Share the context, the meme, the thought." /><button type="submit" disabled={busy === "publish"}>{busy === "publish" ? "Posting…" : <><Send size={15} /> Post to Circle</>}</button></form>}<div className="circle-post-feed">{posts.map((post) => <CirclePostCard key={post.id} post={post} viewer={viewer} viewerRole={membership.role} slug={circle.slug} basePath={basePath} />)}{!posts.length && <div className="circle-feed-empty glass"><MessageSquareText size={25} /><strong>Nothing here yet.</strong><span>Start the first conversation in your Circle.</span></div>}</div></section>
    </div>{membersOpen && <ContentActionPortal><div className="content-action-overlay circle-members-overlay" role="dialog" aria-modal="true" aria-label="Circle members"><CircleMembersPanel circle={circle} membership={membership} members={members} bannedMembers={bannedMembers} viewer={viewer} canInvite={canInvite} canModerate={canModerate} onInvite={inviteMember} onManage={manage} busy={busy} onClose={() => setMembersOpen(false)} /></div></ContentActionPortal>}{identityOpen && <CircleIdentityEditor circle={circle} viewer={viewer} onClose={() => setIdentityOpen(false)} onSaved={() => { setIdentityOpen(false); router.refresh(); }} />}{deleteOpen && <ContentActionPortal><div className="content-action-overlay" role="dialog" aria-modal="true" aria-label="Delete Circle"><div className="content-action-card glass delete-confirmation"><button className="content-action-close" type="button" onClick={() => setDeleteOpen(false)} disabled={busy === "delete-circle"} aria-label="Close"><X size={16} /></button><Trash2 size={20} /><span className="section-label">DELETE CIRCLE</span><h3>Delete this Circle forever?</h3><p>All Circle posts, comments, invites and member access will be permanently removed.</p><div><button type="button" onClick={() => setDeleteOpen(false)} disabled={busy === "delete-circle"}>Keep Circle</button><button type="button" className="danger-action" onClick={deleteCircle} disabled={busy === "delete-circle"}>{busy === "delete-circle" ? "Deleting…" : "Delete forever"}</button></div></div></div></ContentActionPortal>}</section>;
}
