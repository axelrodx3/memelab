"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function AuthControls({ compact = false }) {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    const loadProfile = async (nextUser) => {
      setUser(nextUser || null);
      if (!nextUser) return setProfile(null);
      const { data } = await supabase
        .from("profiles")
        .select("username,display_name,avatar_url")
        .eq("id", nextUser.id)
        .maybeSingle();
      setProfile(data || null);
    };
    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (user === undefined) return <span className="auth-control-loading" aria-hidden="true" />;

  if (!user) {
    return <Link className={compact ? "mobile-auth-link" : "login-button"} href="/auth">Log in</Link>;
  }

  const initial = (profile?.display_name || profile?.username || user.email || "M").charAt(0).toUpperCase();
  const avatar = profile?.avatar_url;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  return (
    <div className={compact ? "mobile-auth-controls" : "auth-controls"}>
      <Link className="account-chip" href="/account" aria-label="Open account">
        <span>{avatar ? <Image src={avatar} alt="" width={25} height={25} /> : initial}</span>
        {!compact && <strong>Account</strong>}
      </Link>
      <button type="button" className="signout-button" onClick={signOut} aria-label="Log out">
        <LogOut size={compact ? 16 : 15} />
        {compact && "Log out"}
      </button>
    </div>
  );
}
