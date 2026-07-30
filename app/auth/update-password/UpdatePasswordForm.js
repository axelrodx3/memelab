"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function UpdatePasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmation") || "")) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    window.location.assign("/account");
  };

  return (
    <form className="confirmation-card glass" onSubmit={submit}>
      <div className="confirmation-icon"><KeyRound size={32} /></div>
      <span className="section-label">SECURE YOUR ACCOUNT</span>
      <h1>Choose a new password.</h1>
      <p>Use at least eight characters and avoid passwords you use elsewhere.</p>
      <div className="password-reset-fields">
        <input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="New password" />
        <input name="confirmation" type="password" minLength={8} required autoComplete="new-password" placeholder="Confirm new password" />
      </div>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="primary-cta" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
