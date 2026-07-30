"use client";

import { ArrowRight, AtSign, LockKeyhole, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function AuthForm({ nextPath }) {
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("idle");

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (mode !== "signup") return undefined;
    const candidate = username.trim();
    if (!candidate) {
      setUsernameStatus("idle");
      return undefined;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(candidate)) {
      setUsernameStatus("invalid");
      return undefined;
    }

    setUsernameStatus("checking");
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_username_available", {
        candidate_username: candidate
      });
      if (error) {
        setUsernameStatus("error");
        return;
      }
      setUsernameStatus(data ? "available" : "taken");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mode, username]);

  const checkUsername = async (candidate) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("is_username_available", {
      candidate_username: candidate
    });
    return { available: data === true, error };
  };

  const resendConfirmation = async () => {
    if (!pendingEmail || resendBusy || resendCooldown) return;
    setResendBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    });
    setResendBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("rate limit")) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setMessage("Email sending is temporarily limited. Wait a minute before trying again. If you already used an earlier link, try logging in instead.");
        return;
      }
      setMessage(error.message);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setMessage("If this email belongs to an unverified MemeLab account, a fresh confirmation link has been sent.");
  };

  const showAuthError = (error) => {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("rate limit")) {
      setMessage("Email sending is temporarily limited. Please wait before requesting another message, or try logging in—your earlier link may have already verified the account.");
      return;
    }
    if (errorMessage.includes("already registered") || error.code === "user_already_exists") {
      setMessage("An account already exists for this email. Log in instead, or use Resend confirmation if the account is still unverified.");
      return;
    }
    setMessage(error.message);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const requestedUsername = String(form.get("username") || "").trim();
    const supabase = createClient();

    if (mode === "signup") {
      const availability = await checkUsername(requestedUsername);
      if (availability.error) {
        setBusy(false);
        setMessage("We couldn’t check that username right now. Please try again.");
        return;
      }
      if (!availability.available) {
        setBusy(false);
        setPendingEmail(email);
        setUsernameStatus("taken");
        setMessage("That username is already taken. Try another one. If it belongs to your unverified account, resend its confirmation email below.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          data: { username: requestedUsername, display_name: requestedUsername }
        }
      });
      if (error) {
        setBusy(false);
        setPendingEmail(email);
        const latestAvailability = await checkUsername(requestedUsername);
        if (!latestAvailability.error && !latestAvailability.available) {
          setUsernameStatus("taken");
          setMessage("That username was just claimed. Try a different one.");
          return;
        }
        showAuthError(error);
        return;
      }
      if (!data.session) {
        setPendingEmail(email);
        setBusy(false);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setMessage("Check your inbox for a confirmation link. If this email is already verified, switch to Log in instead.");
        return;
      }
      setBusy(false);
      window.location.assign(nextPath);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) setPendingEmail(email);
      showAuthError(error);
      return;
    }
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
            <span><UserRound size={16} /><input name="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required autoComplete="username" placeholder="your_handle" value={username} onChange={(event) => setUsername(event.target.value)} aria-describedby="username-status" /></span>
            <small id="username-status" className={`username-status ${usernameStatus}`}>
              {usernameStatus === "checking" && "Checking availability…"}
              {usernameStatus === "available" && "Username available"}
              {usernameStatus === "taken" && "Username taken — try a different one"}
              {usernameStatus === "invalid" && "Use 3–20 letters, numbers, or underscores"}
              {usernameStatus === "error" && "Couldn’t check availability yet"}
            </small>
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
        {pendingEmail && (
          <button className="resend-confirmation" type="button" onClick={resendConfirmation} disabled={resendBusy || resendCooldown > 0}>
            <RefreshCw size={14} /> {resendBusy ? "Sending…" : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend confirmation email"}
          </button>
        )}
        <button className="primary-cta auth-submit" disabled={busy}>
          {busy ? "Working…" : mode === "signup" ? "Create my account" : "Enter MemeLab"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      <p className="auth-fine-print">By continuing, you agree to keep MemeLab legal and respect the community.</p>
    </div>
  );
}
