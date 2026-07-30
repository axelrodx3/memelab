"use client";

import { useEffect } from "react";
import { createClient } from "../../lib/supabase/client";
import { subscribeToPresence } from "../../lib/presence";

export default function PresenceBeacon() {
  useEffect(() => {
    let cleanup;
    let cancelled = false;

    const connect = async (override) => {
      await cleanup?.();
      cleanup = undefined;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      let enabled = override;
      if (typeof enabled !== "boolean") {
        const { data: settings } = await supabase
          .from("account_settings")
          .select("show_online_status")
          .eq("user_id", user.id)
          .maybeSingle();
        enabled = settings?.show_online_status !== false;
      }
      if (cancelled || !enabled) return;
      cleanup = subscribeToPresence({ userId: user.id, track: true });
    };

    connect();
    const update = (event) => connect(event.detail?.enabled);
    window.addEventListener("memelab:presence-settings", update);
    return () => {
      cancelled = true;
      window.removeEventListener("memelab:presence-settings", update);
      cleanup?.();
    };
  }, []);

  return null;
}
