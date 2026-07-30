"use client";

import { useEffect, useState } from "react";
import { subscribeToPresence } from "../../lib/presence";

export default function PresenceStatus({ userId }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const cleanup = subscribeToPresence({ onSync: (ids) => setOnline(ids.has(userId)) });
    return () => { cleanup(); };
  }, [userId]);

  return <span className={`presence-status ${online ? "online" : "offline"}`}><i />{online ? "Online" : "Offline"}</span>;
}
