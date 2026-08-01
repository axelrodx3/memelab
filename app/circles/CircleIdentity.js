"use client";

import { ImageIcon, Pencil, Save, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import ContentActionPortal from "../components/ContentActionPortal";
import { createClient } from "../../lib/supabase/client";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extensionFor(file) {
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

export function CircleAvatar({ circle, size = 64, className = "" }) {
  const label = circle?.name?.trim()?.charAt(0)?.toUpperCase() || "C";
  return <span className={`circle-identity-avatar ${className}`} style={{ width: size, height: size }}>{circle?.avatar_url ? <Image src={circle.avatar_url} alt="" fill sizes={`${size}px`} /> : <span>{label}</span>}</span>;
}

export function CircleCover({ circle }) {
  return <div className="circle-identity-cover" aria-hidden="true">{circle?.banner_url && <Image src={circle.banner_url} alt="" fill sizes="(max-width: 760px) 100vw, 920px" priority />}<span /></div>;
}

function UploadControl({ kind, label, hint, preview, onChoose, waiting }) {
  const inputRef = useRef(null);
  return <div className="circle-media-control"><div className="circle-media-preview">{preview ? <Image src={preview} alt="" fill sizes="120px" /> : <ImageIcon size={19} />}</div><div><strong>{label}</strong><small>{hint}</small><button type="button" onClick={() => inputRef.current?.click()} disabled={waiting}><Upload size={13} /> {waiting ? "Uploading…" : `Change ${kind}`}</button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onChoose(event.target.files?.[0], kind)} /></div></div>;
}

export default function CircleIdentityEditor({ circle, viewer, onClose, onSaved }) {
  const [name, setName] = useState(circle.name || "");
  const [description, setDescription] = useState(circle.description || "");
  const [avatarUrl, setAvatarUrl] = useState(circle.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(circle.banner_url || "");
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const choose = async (file, kind) => {
    setMessage("");
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) return setMessage("Use a PNG, JPG, or WEBP image.");
    if (file.size > MAX_BYTES) return setMessage("Circle images must be 5MB or smaller.");
    setUploading(kind);
    try {
      const supabase = createClient();
      const path = `${viewer.id}/circles/${circle.id}/${kind}-${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (kind === "avatar") setAvatarUrl(data.publicUrl);
      else setBannerUrl(data.publicUrl);
    } catch (error) {
      setMessage(error.message || "That Circle image could not be uploaded.");
    } finally {
      setUploading("");
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/circles/${circle.slug}/identity`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, avatarUrl, bannerUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your Circle identity could not be saved.");
      onSaved(result);
    } catch (error) {
      setMessage(error.message || "Your Circle identity could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <ContentActionPortal><div className="content-action-overlay circle-identity-overlay" role="dialog" aria-modal="true" aria-label="Customize Circle"><form className="circle-identity-editor glass" onSubmit={save}><button className="content-action-close" type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={16} /></button><header><span className="circle-editor-icon"><Pencil size={19} /></span><div><span className="section-label">CIRCLE IDENTITY</span><h2>Make it yours.</h2><p>Give your Circle a recognizable look for the people inside it.</p></div></header><div className="circle-media-grid"><UploadControl kind="avatar" label="Circle avatar" hint="Square · 800 × 800" preview={avatarUrl} onChoose={choose} waiting={uploading === "avatar"} /><UploadControl kind="banner" label="Circle banner" hint="Wide · 1600 × 500" preview={bannerUrl} onChoose={choose} waiting={uploading === "banner"} /></div><label>Circle name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={48} /></label><label>Bio <small>Shown to invited members</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={360} rows={5} placeholder="What is this Circle for?" /></label>{message && <p className="circle-identity-message" role="status">{message}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-cta" disabled={saving || Boolean(uploading)}>{saving ? "Saving…" : <><Save size={15} /> Save Circle</>}</button></footer></form></div></ContentActionPortal>;
}
