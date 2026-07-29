"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function AuthControls({ compact = false }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (user === undefined) return <span className="auth-control-loading" aria-hidden="true" />;

  if (!user) {
    return <Link className={compact ? "mobile-auth-link" : "login-button"} href="/auth">Log in</Link>;
  }

  const initial = (user.user_metadata?.display_name || user.email || "M").charAt(0).toUpperCase();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  return (
    <div className={compact ? "mobile-auth-controls" : "auth-controls"}>
      <Link className="account-chip" href="/account" aria-label="Open account">
        <span>{initial}</span>
        {!compact && <strong>Account</strong>}
      </Link>
      <button type="button" className="signout-button" onClick={signOut} aria-label="Log out">
        <LogOut size={compact ? 16 : 15} />
        {compact && "Log out"}
      </button>
    </div>
  );
}
