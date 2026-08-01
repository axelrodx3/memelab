"use client";

import { useEffect, useState } from "react";
import { subscribeToPresence } from "../../lib/presence";
import { createClient } from "../../lib/supabase/client";

export default function PresenceStatus({ userId }) {
  const [online, setOnline] = useState(false);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    let active = true;
    const identifyViewer = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setIsViewer(user.id === userId);
    };
    void identifyViewer();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const cleanup = subscribeToPresence({
      onSync: (ids) => {
        if (active) setOnline(ids.has(userId));
      }
    });
    return () => {
      active = false;
      void cleanup();
    };
  }, [userId]);

  const visibleOnline = online || isViewer;
  return <span className={`presence-status ${visibleOnline ? "online" : "offline"}`}><i />{visibleOnline ? "Online" : "Offline"}</span>;
}
