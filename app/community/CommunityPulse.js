"use client";

import { Activity, MessageCircle, Radio, Sparkles, Users, Vote } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToPresence } from "../../lib/presence";

const METRICS = [
  ["online", Radio, "online now"],
  ["postsToday", Sparkles, "posts today"],
  ["commentsToday", MessageCircle, "comments today"],
  ["votesToday", Vote, "votes today"],
  ["members", Users, "members"]
];

export default function CommunityPulse({ stats }) {
  const [online, setOnline] = useState(0);
  useEffect(() => {
    const cleanup = subscribeToPresence({ onSync: (ids) => setOnline(ids.size) });
    return () => { void cleanup(); };
  }, []);
  const values = { ...stats, online };

  return (
    <div className="community-about community-pulse glass">
      <div className="pulse-heading"><span className="section-label">COMMUNITY PULSE</span><Activity size={17} /></div>
      <h2>Alive right now.</h2>
      <p>A live look at what’s happening across MemeLab.</p>
      <div className="community-stat-grid">
        {METRICS.map(([key, Icon, label]) => <span key={key}><Icon size={13} /><strong>{values[key]}</strong>{label}</span>)}
      </div>
    </div>
  );
}
