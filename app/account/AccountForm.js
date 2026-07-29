"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function AccountForm({ profile }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim().toLowerCase();
    const displayName = String(form.get("displayName") || "").trim();
    const bio = String(form.get("bio") || "").trim();
    const mature = form.get("mature") === "on";
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        display_name: displayName,
        bio,
        mature_content_enabled: mature
      })
      .eq("id", profile.id);
    setBusy(false);
    setMessage(error ? error.message : "Profile saved.");
  };

  return (
    <form className="account-card glass" onSubmit={submit}>
      <div className="account-fields">
        <label>Username<input name="username" defaultValue={profile.username} pattern="[a-z0-9_]+" minLength={3} maxLength={24} required /></label>
        <label>Display name<input name="displayName" defaultValue={profile.display_name || ""} maxLength={50} required /></label>
        <label className="wide">Bio<textarea name="bio" defaultValue={profile.bio || ""} maxLength={240} rows={4} placeholder="Tell the community who you are." /></label>
        <label className="account-toggle wide">
          <input type="checkbox" name="mature" defaultChecked={profile.mature_content_enabled} />
          <span><strong>Show mature posts automatically</strong><small>Otherwise MemeLab displays a warning before revealing them.</small></span>
        </label>
      </div>
      {message && <p className="account-message" role="status">{message}</p>}
      <button className="primary-cta" disabled={busy}><Save size={16} /> {busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
