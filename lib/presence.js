"use client";

import { createClient } from "./supabase/client";

export const PRESENCE_CHANNEL = "memelab-community-online";

let client;
let channel;
let subscribed = false;
let syncTask = Promise.resolve();
const listeners = new Set();
const trackers = new Map();

export function onlineUserIds(activeChannel = channel) {
  const ids = new Set();
  if (!activeChannel) return ids;

  Object.values(activeChannel.presenceState()).flat().forEach((presence) => {
    if (presence?.user_id) ids.add(presence.user_id);
  });
  return ids;
}

function notifySync() {
  const ids = onlineUserIds();
  listeners.forEach(({ onSync }) => onSync?.(ids));
}

function notifyError(error) {
  listeners.forEach(({ onError }) => onError?.(error));
}

function trackedUserId() {
  return trackers.keys().next().value || null;
}

function queueTrackingUpdate() {
  const activeChannel = channel;
  if (!activeChannel || !subscribed) return syncTask;

  syncTask = syncTask
    .catch(() => undefined)
    .then(async () => {
      if (channel !== activeChannel || !subscribed) return;
      const userId = trackedUserId();
      if (userId) {
        await activeChannel.track({ user_id: userId, online_at: new Date().toISOString() });
      } else {
        await activeChannel.untrack();
      }
      notifySync();
    })
    .catch((error) => {
      notifyError(error);
    });

  return syncTask;
}

function ensureChannel() {
  if (channel) return channel;

  client = createClient();
  channel = client
    .channel(PRESENCE_CHANNEL)
    .on("presence", { event: "sync" }, notifySync)
    .subscribe((status, error) => {
      subscribed = status === "SUBSCRIBED";
      if (subscribed) {
        void queueTrackingUpdate();
        notifySync();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        notifyError(error || new Error(`Presence channel ${status.toLowerCase()}`));
      }
    });

  return channel;
}

async function closeChannelIfUnused() {
  if (listeners.size || trackers.size || !channel) return;

  const activeClient = client;
  const activeChannel = channel;
  channel = undefined;
  client = undefined;
  subscribed = false;

  try {
    await syncTask;
    await activeClient.removeChannel(activeChannel);
  } catch (error) {
    notifyError(error);
  }
}

export function subscribeToPresence({ userId = null, track = false, onSync, onError } = {}) {
  ensureChannel();
  const listener = { onSync, onError };
  listeners.add(listener);
  onSync?.(onlineUserIds());

  if (track && userId) {
    trackers.set(userId, (trackers.get(userId) || 0) + 1);
    void queueTrackingUpdate();
  }

  return async () => {
    listeners.delete(listener);
    if (track && userId) {
      const remaining = (trackers.get(userId) || 1) - 1;
      if (remaining > 0) trackers.set(userId, remaining);
      else trackers.delete(userId);
      await queueTrackingUpdate();
    }
    await closeChannelIfUnused();
  };
}
