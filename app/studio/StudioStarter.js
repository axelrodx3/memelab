"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { saveCustomBase } from "../../lib/custom-base";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

export default function StudioStarter() {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const choose = async (file) => {
    if (!file) return;
    if (!TYPES.has(file.type)) return setMessage("Choose a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return setMessage("Custom images must be 15MB or smaller.");
    setBusy(true);
    setMessage("");
    try {
      await saveCustomBase(file);
      window.location.assign("/editor/custom");
    } catch {
      setMessage("Your browser could not prepare that image. Try a smaller file.");
      setBusy(false);
    }
  };

  return (
    <div className="studio-upload-card glass">
      <div className="studio-upload-icon"><Upload size={24} /></div>
      <h2>Upload an image</h2>
      <p>Add captions, layers and effects.</p>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload size={16} /> {busy ? "Preparing…" : "Upload an image"}
      </button>
      <small>{message || "PNG, JPG or WebP · Stored on this device"}</small>
      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} />
    </div>
  );
}
