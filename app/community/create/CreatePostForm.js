"use client";

import { AlertTriangle, ImagePlus, Send, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 25 * 1024 * 1024;

function extensionFor(file) {
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return byType[file.type] || "jpg";
}

export default function CreatePostForm({ viewer }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const chooseFile = (nextFile) => {
    setMessage("");
    if (!nextFile) return;
    if (!ACCEPTED_TYPES.has(nextFile.type)) return setMessage("Use a PNG, JPG, WEBP or GIF image.");
    if (nextFile.size > MAX_BYTES) return setMessage("Images must be 25MB or smaller.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return setMessage("Choose an image before publishing.");
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const path = `${viewer.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage.from("community").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (uploadError) {
      setBusy(false);
      setMessage(uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("community").getPublicUrl(path);
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        author_id: viewer.id,
        source_label: viewer.display_name || viewer.username,
        title: String(form.get("title") || "").trim(),
        caption: String(form.get("caption") || "").trim(),
        image_url: publicUrl.publicUrl,
        storage_path: path,
        is_mature: form.get("mature") === "on"
      })
      .select("id")
      .single();

    if (postError) {
      await supabase.storage.from("community").remove([path]);
      setBusy(false);
      setMessage(postError.message);
      return;
    }
    window.location.assign(`/community/${post.id}`);
  };

  return (
    <form className="create-post-card glass" onSubmit={submit}>
      <div
        className={`post-upload-zone ${preview ? "has-preview" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          chooseFile(event.dataTransfer.files?.[0]);
        }}
      >
        {preview ? (
          <>
            <Image src={preview} alt="Post preview" fill unoptimized />
            <button type="button" className="remove-post-image" onClick={() => { setFile(null); setPreview(""); }}>
              <X size={16} /> Remove
            </button>
          </>
        ) : (
          <>
            <div className="upload-icon"><ImagePlus size={30} /></div>
            <strong>Drop an image here</strong>
            <span>PNG, JPG, WEBP or GIF · Up to 25MB</span>
            <button type="button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Choose an image</button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </div>

      <div className="create-post-fields">
        <label>Title<input name="title" required maxLength={140} placeholder="Give people a reason to stop scrolling" /></label>
        <label>Caption<textarea name="caption" maxLength={2000} rows={4} placeholder="Optional context, story or punchline" /></label>
        <label className="mature-switch">
          <input type="checkbox" name="mature" />
          <span><AlertTriangle size={17} /><span><strong>Mark as mature</strong><small>Viewers will approve a warning before the image appears.</small></span></span>
        </label>
        {message && <p className="create-post-message" role="status">{message}</p>}
        <button className="primary-cta publish-post" disabled={busy}>
          {busy ? "Publishing…" : "Publish to MemeLab"} {!busy && <Send size={16} />}
        </button>
      </div>
    </form>
  );
}
