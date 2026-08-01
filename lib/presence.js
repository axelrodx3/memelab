"use client";

import { createClient } from "./supabase/client";

export const PRESENCE_CHANNEL = "memelab-community-online";

// Supabase returns the same Realtime channel for a given topic. Presence is
// consumed in several places (the site beacon, profile badges, and the
// community pulse), so this module owns one channel and fans updates out to
// each React consumer. Creating a fresh listener after another consumer had
// subscribed caused Realtime to reject it and, in turn, could trip the route
// error boundary.
let presenceChannel;
let presenceSubscribed = false;
let trackedUserId = null;
let requestedTrackedUserId = null;
let trackingQueue = Promise.resolve();
const presenceListeners = new Set();

function stablePresenceKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `memelab-${Math.random().toString(36).slice(2)}`;
}

export function onlineUserIds(channel) {
  const ids = new Set();
  Object.values(channel.presenceState()).flat().forEach((presence) => {
    if (presence?.user_id) ids.add(presence.user_id);
  });
  return ids;
}

function emitPresence() {
  if (!presenceChannel) return;
  const ids = onlineUserIds(presenceChannel);
  presenceListeners.forEach((listener) => listener(ids));
}

function scheduleTracking() {
  trackingQueue = trackingQueue
    .catch(() => {})
    .then(async () => {
      if (!presenceChannel || !presenceSubscribed) return;
      const nextUserId = requestedTrackedUserId;

      if (nextUserId && trackedUserId !== nextUserId) {
        await presenceChannel.track({ user_id: nextUserId, online_at: new Date().toISOString() });
        trackedUserId = nextUserId;
      } else if (!nextUserId && trackedUserId) {
        await presenceChannel.untrack();
        trackedUserId = null;
      }
    });

  return trackingQueue;
}

function ensurePresenceChannel() {
  if (presenceChannel) return;

  const supabase = createClient();
  presenceChannel = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: stablePresenceKey() } }
  });

  presenceChannel
    .on("presence", { event: "sync" }, emitPresence)
    .subscribe((status) => {
      presenceSubscribed = status === "SUBSCRIBED";
      if (presenceSubscribed) {
        void scheduleTracking().catch(() => {});
        emitPresence();
      }
    });
}

export function subscribeToPresence({ userId = null, track = false, onSync }) {
  ensurePresenceChannel();

  const listener = (ids) => onSync?.(ids);
  presenceListeners.add(listener);
  listener(onlineUserIds(presenceChannel));

  if (track && userId) {
    requestedTrackedUserId = userId;
    void scheduleTracking().catch(() => {});
  }

  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    presenceListeners.delete(listener);

    if (track && userId && requestedTrackedUserId === userId) {
      requestedTrackedUserId = null;
      await scheduleTracking();
    }
  };
}
