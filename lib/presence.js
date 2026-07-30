"use client";

import { createClient } from "./supabase/client";

export const PRESENCE_CHANNEL = "memelab-community-online";

export function onlineUserIds(channel) {
  const ids = new Set();
  Object.values(channel.presenceState()).flat().forEach((presence) => {
    if (presence?.user_id) ids.add(presence.user_id);
  });
  return ids;
}

export function subscribeToPresence({ userId = null, track = false, onSync }) {
  const supabase = createClient();
  const channel = supabase.channel(PRESENCE_CHANNEL, {
    config: userId ? { presence: { key: userId } } : undefined
  });

  channel
    .on("presence", { event: "sync" }, () => onSync?.(onlineUserIds(channel)))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && track && userId) {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

  return async () => {
    if (track) await channel.untrack();
    await supabase.removeChannel(channel);
  };
}
