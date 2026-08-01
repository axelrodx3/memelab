"use client";

import { ArrowLeft, LoaderCircle, LockKeyhole, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function CircleCreateForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/circles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), description: form.get("description") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your Circle could not be created.");
      window.location.assign(`/circles/${result.slug}`);
    } catch (error) {
      setMessage(error.message || "Your Circle could not be created.");
      setBusy(false);
    }
  };

  return <section className="circle-create-shell shell"><Link className="back-to-feed" href="/circles"><ArrowLeft size={15} /> Back to Circles</Link><header><span className="section-label">NEW PRIVATE SPACE</span><h1>Start a <span>Circle.</span></h1><p>Every Circle begins private. You’ll invite members and choose your own staff after it opens.</p></header><form className="circle-create-card glass" onSubmit={submit}><span className="circle-create-lock"><LockKeyhole size={19} /></span><label>Circle name<input name="name" required minLength={3} maxLength={48} placeholder="Late Night Lab" autoFocus /></label><label>Description <small>Optional · shown only to invited members</small><textarea name="description" maxLength={360} rows={5} placeholder="What is this space for?" /></label><button className="primary-cta" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} /> Building…</> : <><Plus size={16} /> Create private Circle</>}</button>{message && <p role="status">{message}</p>}</form></section>;
}
