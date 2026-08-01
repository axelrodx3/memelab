"use client";

import { ArrowLeft, Inbox, MessageCircle, Send, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PresenceStatus from "../components/PresenceStatus";
import { createClient } from "../../lib/supabase/client";

function MemberAvatar({ member, className = "" }) {
  const label = member?.display_name || member?.username || "M";
  return <span className={`message-avatar ${className}`}>{member?.avatar_url ? <Image src={member.avatar_url} alt="" fill sizes="48px" /> : label.charAt(0).toUpperCase()}</span>;
}

function previewTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationRow({ conversation, active }) {
  const member = conversation.member;
  return (
    <Link className={`message-conversation ${active ? "active" : ""}`} href={`/messages/${conversation.id}`}>
      <MemberAvatar member={member} />
      <span><strong>{member?.display_name || member?.username || "MemeLab member"}</strong><small>{conversation.last_message_preview || "Start the conversation."}</small></span>
      <time>{previewTime(conversation.last_message_at || conversation.created_at)}</time>
    </Link>
  );
}

export default function MessagesShell({ viewer, conversations, selectedConversation = null, startTarget = null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState(selectedConversation?.messages || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const conversationId = selectedConversation?.id || null;
  const target = selectedConversation?.member || startTarget;

  useEffect(() => {
    setMessages(selectedConversation?.messages || []);
    setError("");
  }, [selectedConversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!conversationId) return undefined;
    const supabase = createClient();
    const channel = supabase
      .channel(`memelab-dm-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const next = payload.new;
        if (!next?.id) return;
        setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark-read", conversationId })
    });
  }, [conversationId]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId: target.id, body })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The message could not be sent.");
      setBody("");
      if (result.message) setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      if (result.conversationId !== conversationId) {
        router.replace(`/messages/${result.conversationId}`);
      } else {
        router.refresh();
      }
    } catch (sendError) {
      setError(sendError.message || "The message could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="messages-shell shell">
      <header className="messages-hero"><div><span className="section-label">PRIVATE MESSAGES</span><h1>Your MemeLab inbox.</h1><p>One-to-one conversations, controlled by every member’s privacy settings.</p></div><Link className="messages-friends-link" href="/friends"><MessageCircle size={15} /> Friends</Link></header>
      <div className="messages-layout glass">
        <aside className="messages-sidebar">
          <header><strong>Inbox</strong><span>{conversations.length}</span></header>
          <div className="messages-conversations">
            {conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === conversationId} />)}
            {!conversations.length && <div className="messages-empty-list"><Inbox size={20} /><span>No conversations yet.</span></div>}
          </div>
        </aside>
        <section className="messages-pane">
          {!target && <div className="messages-start"><Inbox size={30} /><h2>Your inbox is ready.</h2><p>Open a creator’s profile and choose Message to begin a private conversation.</p><Link href="/friends">Find friends</Link></div>}
          {target && <>
            <header className="message-thread-header">
              {conversationId && <Link href="/messages" className="message-back" aria-label="Back to messages"><ArrowLeft size={17} /></Link>}
              <MemberAvatar member={target} className="large" />
              <div><strong>{target.display_name || target.username}</strong><span>@{target.username}</span></div>
              <PresenceStatus userId={target.id} />
            </header>
            <div className="message-thread" aria-live="polite">
              {!messages.length && <div className="message-thread-empty"><MessageCircle size={21} /><strong>Start something good.</strong><span>Your message is private between you and @{target.username}.</span></div>}
              {messages.map((message) => {
                const mine = message.sender_id === viewer.id;
                return <div className={`message-bubble-row ${mine ? "mine" : "theirs"}`} key={message.id}><div className="message-bubble"><p>{message.body}</p><time>{previewTime(message.created_at)}</time></div></div>;
              })}
              <div ref={endRef} />
            </div>
            <form className="message-compose" onSubmit={sendMessage}>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={2} placeholder={`Message @${target.username}`} disabled={busy} />
              <button type="submit" disabled={busy || !body.trim()}><Send size={16} /> {busy ? "Sending…" : "Send"}</button>
            </form>
            {error && <p className="message-send-error" role="status"><ShieldAlert size={15} /> {error}</p>}
          </>}
        </section>
      </div>
    </section>
  );
}
