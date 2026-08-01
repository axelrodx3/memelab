"use client";

import { Bell, CheckCheck, MessageCircle, Reply, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

function notificationIcon(type) {
  return type === "reply" ? Reply : MessageCircle;
}

function notificationHref(item) {
  if (item.conversation_id) return `/messages/${item.conversation_id}`;
  if (item.post_id) return `/community/${item.post_id}#comments`;
  if (item.actor?.username) return `/u/${item.actor.username}`;
  return "/community";
}

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async (id) => {
    if (!id) return;
    const { data } = await createClient()
      .from("notifications")
      .select("id,type,message,post_id,conversation_id,read_at,created_at,actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_url)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(12);
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);
      await loadNotifications(user.id);
    };
    load();
    return () => { active = false; };
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return undefined;
    const refreshOnFocus = () => { void loadNotifications(userId); };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loadNotifications, userId]);

  useEffect(() => {
    if (open) void loadNotifications(userId);
  }, [loadNotifications, open, userId]);

  if (!userId) return null;
  const unread = notifications.filter((item) => !item.read_at).length;

  const markAllRead = async () => {
    if (!unread) return;
    const readAt = new Date().toISOString();
    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (!error) setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
  };

  const markRead = async (id) => {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || item.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read_at: readAt } : notification));
    const { error } = await createClient().from("notifications").update({ read_at: readAt }).eq("id", id).eq("user_id", userId);
    if (error) setNotifications((current) => current.map((notification) => notification.id === id ? item : notification));
  };

  return (
    <div className="notification-control">
      <button className="icon-button notification-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notification-panel glass">
          <header><strong>Notifications</strong><button type="button" onClick={markAllRead}><CheckCheck size={14} /> Mark read</button></header>
          <div>
            {notifications.map((item) => (
              <Link className={item.read_at ? "" : "unread"} href={notificationHref(item)} key={item.id} onClick={() => { void markRead(item.id); setOpen(false); }}>
                {(() => {
                  const Icon = item.type === "friend_request" || item.type === "friend_accepted" ? UserPlus : notificationIcon(item.type);
                  return <i><Icon size={12} /></i>;
                })()}
                <span><strong>{item.actor?.display_name || item.actor?.username || "A MemeLab member"}</strong> {item.message}<small>{new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small></span>
              </Link>
            ))}
            {!notifications.length && <p>You’re all caught up.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
