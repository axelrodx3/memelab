"use client";

import { Clock3, MessageCircle, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfileSocialActions({ member, initialRelationship = "none" }) {
  const router = useRouter();
  const [relationship, setRelationship] = useState(initialRelationship);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const friendAction = async (action) => {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch("/api/social/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, targetUserId: member.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That friend action could not be completed.");
      setRelationship(result.relationship || "none");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "That friend action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  const friendControl = relationship === "friends"
    ? <button className="profile-social-secondary" type="button" onClick={() => friendAction("remove")} disabled={Boolean(busy)}><UserCheck size={14} /> Friends</button>
    : relationship === "outgoing"
      ? <button className="profile-social-secondary" type="button" onClick={() => friendAction("cancel")} disabled={Boolean(busy)}><Clock3 size={14} /> {busy ? "Working…" : "Request sent"}</button>
      : relationship === "incoming"
        ? <span className="profile-social-pair"><button className="profile-social-primary" type="button" onClick={() => friendAction("accept")} disabled={Boolean(busy)}><UserCheck size={14} /> {busy === "accept" ? "Accepting…" : "Accept"}</button><button className="profile-social-icon" type="button" onClick={() => friendAction("decline")} disabled={Boolean(busy)} aria-label="Decline friend request"><X size={15} /></button></span>
        : <button className="profile-social-primary" type="button" onClick={() => friendAction("send")} disabled={Boolean(busy)}><UserPlus size={14} /> {busy === "send" ? "Sending…" : "Add friend"}</button>;

  return (
    <div className="profile-social-actions">
      <Link className="profile-social-message" href={`/messages?with=${encodeURIComponent(member.username)}`}><MessageCircle size={14} /> Message</Link>
      {friendControl}
      {relationship === "friends" && <span className="profile-social-remove"><UserMinus size={12} /> Remove anytime</span>}
      {message && <span className="profile-social-feedback" role="status">{message}</span>}
    </div>
  );
}
