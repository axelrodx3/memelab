"use client";

import { useEffect, useState } from "react";
import { subscribeToPresence } from "../../lib/presence";

export default function PresenceStatus({ userId }) {
  const [online, setOnline] = useState(false);

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

  return <span className={`presence-status ${online ? "online" : "offline"}`}><i />{online ? "Online" : "Offline"}</span>;
}
