"use client";

import { useEffect } from "react";
import { reportClientError } from "../../lib/client-error-report";
import { createClient } from "../../lib/supabase/client";
import { subscribeToPresence } from "../../lib/presence";

export default function PresenceBeacon() {
  useEffect(() => {
    let cleanup;
    let cancelled = false;

    const connect = async (override) => {
      try {
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
      } catch (error) {
        if (!cancelled) reportClientError({ type: "presence-connect", error });
      }
    };

    void connect();
    const update = (event) => { void connect(event.detail?.enabled); };
    window.addEventListener("memelab:presence-settings", update);
    return () => {
      cancelled = true;
      window.removeEventListener("memelab:presence-settings", update);
      const dispose = cleanup;
      cleanup = undefined;
      if (dispose) {
        void dispose().catch((error) => reportClientError({ type: "presence-cleanup", error }));
      }
    };
  }, []);

  return null;
}
