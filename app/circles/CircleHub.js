"use client";

import { Check, Clock3, LockKeyhole, Plus, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function Avatar({ member }) {
  const label = member?.display_name || member?.username || "?";
  return <span className="circle-mini-avatar">{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="32px" /> : label.charAt(0).toUpperCase()}</span>;
}

export default function CircleHub({ circles, invites }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const respond = async (inviteId, action) => {
    setBusy(inviteId);
    setMessage("");
    try {
      const response = await fetch(`/api/circles/invites/${inviteId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That Circle invite could not be updated.");
      if (action === "accept") return window.location.assign(`/circles/${result.slug || invites.find((invite) => invite.id === inviteId)?.circle?.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error.message || "That Circle invite could not be updated.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="circles-shell shell">
      <header className="circles-hero glass">
        <div><span className="section-label">MEMELAB CIRCLES</span><h1>Your people.<br /><span>Your corner.</span></h1><p>Private spaces for the friends, collaborators and conversations you actually want in one place.</p></div>
        <Link className="primary-cta" href="/circles/new"><Plus size={17} /> Create a Circle</Link>
      </header>
      {message && <p className="social-message" role="status">{message}</p>}

      <div className="circles-hub-layout">
        <section>
          <header className="circles-section-heading"><div><span className="section-label">PRIVATE SPACES</span><h2>Your Circles</h2><p>Only invited members can see a Circle’s people, posts and discussion.</p></div><span>{circles.length}</span></header>
          <div className="circle-card-grid">
            {circles.map((circle) => <Link className="circle-card glass" href={`/circles/${circle.slug}`} key={circle.id}><span className="circle-card-lock"><LockKeyhole size={14} /> Private Circle</span><h3>{circle.name}</h3><p>{circle.description || "A private MemeLab space."}</p><footer><span><Users size={14} /> {circle.member_count} {circle.member_count === 1 ? "member" : "members"}</span><strong>{circle.membership.role}</strong></footer></Link>)}
            {!circles.length && <div className="circle-empty glass"><Users size={25} /><strong>Start a Circle worth returning to.</strong><span>Invite your people, give the conversation a home, and make it yours.</span><Link href="/circles/new">Create your first Circle</Link></div>}
          </div>
        </section>

        <aside className="circles-hub-aside">
          <section className="circle-principles glass"><LockKeyhole size={19} /><span className="section-label">BUILT FOR YOUR INNER LOOP</span><strong>Private by default.</strong><p>Circle posts never surface in the public Stream. Every space has its own member roles and moderation controls.</p></section>
          <section className="circle-invites glass"><header><div><span className="section-label">INVITATIONS</span><h2>Waiting for you</h2></div><Clock3 size={18} /></header>{invites.map((invite) => <article key={invite.id}><Avatar member={invite.inviter} /><div><strong>{invite.circle?.name}</strong><small>{invite.inviter?.display_name || invite.inviter?.username || "A MemeLab member"} invited you</small></div><div className="circle-invite-actions"><button type="button" onClick={() => respond(invite.id, "accept")} disabled={busy === invite.id} aria-label="Accept Circle invite"><Check size={15} /></button><button type="button" onClick={() => respond(invite.id, "decline")} disabled={busy === invite.id} aria-label="Decline Circle invite"><X size={15} /></button></div></article>)}{!invites.length && <p className="circle-invites-empty">Private Circle invitations will land here.</p>}</section>
        </aside>
      </div>
    </section>
  );
}
