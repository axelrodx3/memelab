"use client";

import { useEffect } from "react";
import { reportClientError } from "../../lib/client-error-report";
import { createClient } from "../../lib/supabase/client";
import { subscribeToPresence } from "../../lib/presence";

export default function PresenceBeacon() {
  useEffect(() => {
    let cleanup;
    let cancelled = false;
    let attempt = 0;
    const supabase = createClient();

    const disconnect = async () => {
      const dispose = cleanup;
      cleanup = undefined;
      if (!dispose) return;
      try {
        await dispose();
      } catch (error) {
        if (!cancelled) reportClientError({ type: "presence-cleanup", error });
      }
    };

    const connect = async (override) => {
      const currentAttempt = ++attempt;
      try {
        await disconnect();
        if (cancelled || currentAttempt !== attempt) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled || currentAttempt !== attempt) return;
        let enabled = override;
        if (typeof enabled !== "boolean") {
          const { data: settings } = await supabase
            .from("account_settings")
            .select("show_online_status")
            .eq("user_id", user.id)
            .maybeSingle();
          enabled = settings?.show_online_status !== false;
        }
        if (cancelled || currentAttempt !== attempt || !enabled) return;
        cleanup = subscribeToPresence({ userId: user.id, track: true });
      } catch (error) {
        if (!cancelled) reportClientError({ type: "presence-connect", error });
      }
    };

    void connect();
    const update = (event) => { void connect(event.detail?.enabled); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void connect(); });
    window.addEventListener("memelab:presence-settings", update);
    return () => {
      cancelled = true;
      attempt += 1;
      subscription.unsubscribe();
      window.removeEventListener("memelab:presence-settings", update);
      void disconnect();
    };
  }, []);

  return null;
}
