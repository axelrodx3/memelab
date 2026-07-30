"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const CHANNELS = [
  ["general", "General"],
  ["meme-talk", "Meme Talk"],
  ["studio-help", "Studio Help"],
  ["ideas", "Ideas & Feedback"],
  ["off-topic", "Off Topic"]
];

export default function DiscussionForm({ viewer, initialChannel }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const { data, error } = await createClient()
      .from("posts")
      .insert({
        author_id: viewer.id,
        source_label: viewer.display_name || viewer.username,
        title: String(form.get("title") || "").trim(),
        caption: String(form.get("body") || "").trim(),
        image_url: null,
        post_kind: "discussion",
        channel_slug: form.get("channel"),
        is_mature: false
      })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    window.location.assign(`/community/${data.id}`);
  };

  return (
    <form className="discussion-create-card glass" onSubmit={submit}>
      <label>Channel<select name="channel" defaultValue={initialChannel}>{CHANNELS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Title<input name="title" required maxLength={140} placeholder="What do you want to talk about?" /></label>
      <label>Body<textarea name="body" required maxLength={2000} rows={10} placeholder="Add context, explain the idea, or ask the community…" /></label>
      {message && <p role="alert">{message}</p>}
      <button className="primary-cta" disabled={busy}>{busy ? "Publishing…" : "Publish discussion"} {!busy && <Send size={16} />}</button>
    </form>
  );
}
