"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("notifications")
        .select("id,message,post_id,read_at,created_at,actor:profiles!notifications_actor_id_fkey(username,display_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (active) setNotifications(data || []);
    };
    load();
    return () => { active = false; };
  }, []);

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
              <Link className={item.read_at ? "" : "unread"} href={item.post_id ? `/community/${item.post_id}#comments` : "/community"} key={item.id} onClick={() => setOpen(false)}>
                <i />
                <span><strong>{item.actor?.display_name || item.actor?.username || "A MemeLab member"}</strong> {item.message}<small>{new Date(item.created_at).toLocaleDateString()}</small></span>
              </Link>
            ))}
            {!notifications.length && <p>You’re all caught up.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
