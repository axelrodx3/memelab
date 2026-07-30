"use client";

import { ArrowRight, AtSign, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function AuthForm({ nextPath }) {
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const username = String(form.get("username") || "").trim();
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          data: { username, display_name: username }
        }
      });
      setBusy(false);
      if (error) return setMessage(error.message);
      if (!data.session) return setMessage("Check your inbox for the MemeLab confirmation email. The link will verify your account and bring you back here.");
      window.location.assign(nextPath);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message);
    window.location.assign(nextPath);
  };

  return (
    <div className="auth-card glass">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Log in</button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
      </div>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <label>
            Username
            <span><UserRound size={16} /><input name="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required placeholder="your_handle" /></span>
          </label>
        )}
        <label>
          Email
          <span><AtSign size={16} /><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span>
        </label>
        <label>
          Password
          <span><LockKeyhole size={16} /><input name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required placeholder="8+ characters" /></span>
        </label>

        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="primary-cta auth-submit" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Create my account" : "Enter MemeLab"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      <p className="auth-fine-print">By continuing, you agree to keep MemeLab legal and respect the community.</p>
    </div>
  );
}
