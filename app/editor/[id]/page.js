"use client";

import {
  ArrowLeft, Check, Cloud, Download, FolderKanban, ImagePlus, LoaderCircle,
  RotateCcw, Sparkles, Type, Upload, X
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

const DEFAULT_STATE = {
  topText: "WHEN YOU FIND THE PERFECT TEMPLATE",
  bottomText: "AND MEMELAB DOES THE REST",
  fontSize: 48,
  textColor: "#ffffff",
  overlayX: 50,
  overlayY: 55,
  overlaySize: 30,
  overlayPath: null
};

function wrapText(context, text, maxWidth) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawCaption(context, text, y, maxWidth, size, color, alignBottom = false) {
  if (!text.trim()) return;
  context.font = `900 ${size}px Impact, Arial Black, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = color;
  context.strokeStyle = "#000000";
  context.lineWidth = Math.max(3, size * 0.09);
  context.lineJoin = "round";
  const lines = wrapText(context, text.toUpperCase(), maxWidth);
  const lineHeight = size * 1.03;
  const startY = alignBottom ? y - lines.length * lineHeight : y;
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    context.strokeText(line, context.canvas.width / 2, lineY, maxWidth);
    context.fillText(line, context.canvas.width / 2, lineY, maxWidth);
  });
}

function normalizeEditorState(value = {}) {
  return {
    ...DEFAULT_STATE,
    topText: typeof value.topText === "string" ? value.topText.slice(0, 500) : DEFAULT_STATE.topText,
    bottomText: typeof value.bottomText === "string" ? value.bottomText.slice(0, 500) : DEFAULT_STATE.bottomText,
    fontSize: Math.min(84, Math.max(24, Number(value.fontSize) || DEFAULT_STATE.fontSize)),
    textColor: /^#[0-9a-f]{6}$/i.test(value.textColor || "") ? value.textColor : DEFAULT_STATE.textColor,
    overlayX: Math.min(100, Math.max(0, Number(value.overlayX) || DEFAULT_STATE.overlayX)),
    overlayY: Math.min(100, Math.max(0, Number(value.overlayY) || DEFAULT_STATE.overlayY)),
    overlaySize: Math.min(90, Math.max(8, Number(value.overlaySize) || DEFAULT_STATE.overlaySize)),
    overlayPath: typeof value.overlayPath === "string" ? value.overlayPath : null
  };
}

function localDraftKey(templateId) {
  return `memelab:draft:${templateId}`;
}

export default function MemeEditor() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const editedRef = useRef(false);
  const savingRef = useRef(false);
  const [template, setTemplate] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled meme");
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading…");
  const [saveError, setSaveError] = useState("");
  const [topText, setTopText] = useState(DEFAULT_STATE.topText);
  const [bottomText, setBottomText] = useState(DEFAULT_STATE.bottomText);
  const [fontSize, setFontSize] = useState(DEFAULT_STATE.fontSize);
  const [textColor, setTextColor] = useState(DEFAULT_STATE.textColor);
  const [overlay, setOverlay] = useState(null);
  const [overlayPath, setOverlayPath] = useState(null);
  const [overlayX, setOverlayX] = useState(DEFAULT_STATE.overlayX);
  const [overlayY, setOverlayY] = useState(DEFAULT_STATE.overlayY);
  const [overlaySize, setOverlaySize] = useState(DEFAULT_STATE.overlaySize);
  const [rendered, setRendered] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hydrateState = useCallback((state) => {
    const normalized = normalizeEditorState(state);
    setTopText(normalized.topText);
    setBottomText(normalized.bottomText);
    setFontSize(normalized.fontSize);
    setTextColor(normalized.textColor);
    setOverlayX(normalized.overlayX);
    setOverlayY(normalized.overlayY);
    setOverlaySize(normalized.overlaySize);
    setOverlayPath(normalized.overlayPath);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const initialize = async () => {
      const [templateResponse, userResponse] = await Promise.all([
        fetch("/api/templates").then((response) => response.json()),
        supabase.auth.getUser()
      ]);
      if (!active) return;

      const selected = (templateResponse.templates || []).find((item) => item.id === id) || null;
      const user = userResponse.data?.user || null;
      const requestedProjectId = new URLSearchParams(window.location.search).get("project");
      setTemplate(selected);
      setViewer(user);
      setProjectName(selected ? `Untitled ${selected.name}`.slice(0, 80) : "Untitled meme");

      if (requestedProjectId && user) {
        const { data: project } = await supabase
          .from("projects")
          .select("id,name,template_id,editor_state")
          .eq("id", requestedProjectId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (project && project.template_id === id) {
          setProjectId(project.id);
          setProjectName(project.name);
          hydrateState(project.editor_state);
          if (project.editor_state?.overlayPath) {
            const { data } = await supabase.storage
              .from("project-assets")
              .createSignedUrl(project.editor_state.overlayPath, 60 * 60);
            if (data?.signedUrl) setOverlay(data.signedUrl);
          }
          setSaveStatus("Saved to your account");
        } else {
          setSaveError("That private project is unavailable.");
          setSaveStatus("New project");
        }
      } else if (requestedProjectId) {
        setSaveError("Sign in to open this private project.");
        setSaveStatus("Sign in required");
      } else {
        const stored = window.localStorage.getItem(localDraftKey(id));
        if (stored) {
          try {
            const draft = JSON.parse(stored);
            hydrateState(draft.editorState);
            setProjectName(draft.name || (selected ? `Untitled ${selected.name}`.slice(0, 80) : "Untitled meme"));
            if (draft.overlayDataUrl) setOverlay(draft.overlayDataUrl);
          } catch {}
        }
        setSaveStatus(user ? "Autosave ready" : "Saved on this device");
      }
      setReady(true);
    };

    initialize().catch(() => {
      if (!active) return;
      setSaveStatus("Editor unavailable");
      setSaveError("MemeLab could not load this project.");
      setReady(true);
    });
    return () => { active = false; };
  }, [hydrateState, id]);

  const editorState = useCallback(() => ({
    version: 1,
    topText,
    bottomText,
    fontSize,
    textColor,
    overlayX,
    overlayY,
    overlaySize,
    overlayPath
  }), [bottomText, fontSize, overlayPath, overlaySize, overlayX, overlayY, textColor, topText]);

  const markEdited = () => {
    editedRef.current = true;
    setSaveError("");
    setSaveStatus(viewer ? "Unsaved changes" : "Saving on this device…");
  };

  const saveProject = useCallback(async () => {
    if (!ready || !editedRef.current || savingRef.current) return;
    savingRef.current = true;
    const state = editorState();

    try {
      window.localStorage.setItem(localDraftKey(id), JSON.stringify({
        name: projectName,
        editorState: state,
        overlayDataUrl: viewer ? null : overlay
      }));

      if (!viewer) {
        editedRef.current = false;
        setSaveStatus("Saved on this device");
        return;
      }

      setSaveStatus("Saving…");
      const supabase = createClient();
      if (projectId) {
        const { error } = await supabase
          .from("projects")
          .update({ name: projectName.trim() || "Untitled meme", editor_state: state })
          .eq("id", projectId)
          .eq("user_id", viewer.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert({
            user_id: viewer.id,
            template_id: id,
            name: projectName.trim() || "Untitled meme",
            editor_state: state
          })
          .select("id")
          .single();
        if (error) throw error;
        setProjectId(data.id);
        const url = new URL(window.location.href);
        url.searchParams.set("project", data.id);
        window.history.replaceState(null, "", url);
      }
      editedRef.current = false;
      setSaveStatus("Saved to your account");
    } catch (error) {
      setSaveStatus("Save failed");
      setSaveError(error.message || "Your project could not be saved.");
    } finally {
      savingRef.current = false;
    }
  }, [editorState, id, overlay, projectId, projectName, ready, viewer]);

  useEffect(() => {
    if (!ready || !editedRef.current) return;
    const timeout = window.setTimeout(saveProject, 900);
    return () => window.clearTimeout(timeout);
  }, [
    bottomText, fontSize, overlay, overlayPath, overlaySize, overlayX, overlayY,
    projectName, ready, saveProject, textColor, topText
  ]);

  const renderCanvas = useCallback(async () => {
    if (!template || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const base = new window.Image();
    base.crossOrigin = "anonymous";
    base.src = template.url;
    await base.decode();

    const scale = Math.min(1, 1000 / base.naturalWidth);
    canvas.width = Math.round(base.naturalWidth * scale);
    canvas.height = Math.round(base.naturalHeight * scale);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0, canvas.width, canvas.height);

    if (overlay) {
      const layer = new window.Image();
      layer.crossOrigin = "anonymous";
      layer.src = overlay;
      await layer.decode();
      const width = canvas.width * (overlaySize / 100);
      const height = width * (layer.naturalHeight / layer.naturalWidth);
      const x = canvas.width * (overlayX / 100) - width / 2;
      const y = canvas.height * (overlayY / 100) - height / 2;
      context.drawImage(layer, x, y, width, height);
    }

    const resolvedFontSize = Math.max(24, Math.round(fontSize * (canvas.width / 600)));
    drawCaption(context, topText, canvas.height * 0.035, canvas.width * 0.91, resolvedFontSize, textColor);
    drawCaption(context, bottomText, canvas.height * 0.965, canvas.width * 0.91, resolvedFontSize, textColor, true);
    setRendered(true);
  }, [bottomText, fontSize, overlay, overlaySize, overlayX, overlayY, template, textColor, topText]);

  useEffect(() => {
    setRendered(false);
    renderCanvas().catch(() => setRendered(false));
  }, [renderCanvas]);

  const uploadOverlay = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setSaveError("Choose a PNG, JPEG, or WebP image under 10 MB.");
      return;
    }

    setUploading(true);
    setSaveError("");
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setOverlay(dataUrl);

    if (viewer) {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${viewer.id}/${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("project-assets").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false
      });
      if (error) {
        setSaveError("The image is previewing, but it could not be synced.");
      } else {
        setOverlayPath(path);
      }
    } else {
      setOverlayPath(null);
    }
    setUploading(false);
    markEdited();
    event.target.value = "";
  };

  const removeOverlay = () => {
    markEdited();
    setOverlay(null);
    setOverlayPath(null);
  };

  const resetEditor = () => {
    markEdited();
    hydrateState({ ...DEFAULT_STATE, topText: "", bottomText: "" });
    setOverlay(null);
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = `memelab-${template?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meme"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const StatusIcon = saveStatus === "Saving…"
    ? LoaderCircle
    : saveStatus.startsWith("Saved")
      ? Check
      : Cloud;

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/templates" className="editor-back"><ArrowLeft size={18} /> MemeLab</Link>
        <div className="editor-project-status" title={saveError || saveStatus}>
          <StatusIcon size={13} className={saveStatus === "Saving…" ? "spin" : ""} />
          <span>{saveError || saveStatus}</span>
        </div>
        <div className="editor-header-actions">
          <Link href="/projects"><FolderKanban size={16} /> Projects</Link>
          <button onClick={download} disabled={!rendered}><Download size={17} /> Export PNG</button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel">
          <div className="editor-title">
            <span>MEMELAB STUDIO</span>
            <input
              className="project-name-input"
              value={projectName}
              maxLength={80}
              aria-label="Project name"
              onChange={(event) => { markEdited(); setProjectName(event.target.value); }}
            />
            <p>{template?.name || "Loading template…"}</p>
          </div>

          <section className="control-section">
            <div className="control-heading"><Type size={16} /> Captions</div>
            <label>Top text<textarea value={topText} onChange={(event) => { markEdited(); setTopText(event.target.value); }} rows={2} /></label>
            <label>Bottom text<textarea value={bottomText} onChange={(event) => { markEdited(); setBottomText(event.target.value); }} rows={2} /></label>
            <div className="control-row">
              <label>Size<input type="range" min="24" max="84" value={fontSize} onChange={(event) => { markEdited(); setFontSize(Number(event.target.value)); }} /></label>
              <label className="color-control">Color<input type="color" value={textColor} onChange={(event) => { markEdited(); setTextColor(event.target.value); }} /></label>
            </div>
          </section>

          <section className="control-section">
            <div className="control-heading"><ImagePlus size={16} /> Character or logo</div>
            {!overlay ? (
              <button
                className="overlay-upload"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
                {uploading ? "Uploading…" : "Choose an image"}
              </button>
            ) : (
              <>
                <button className="remove-overlay" onClick={removeOverlay}><X size={15} /> Remove image</button>
                <label>Horizontal<input type="range" min="0" max="100" value={overlayX} onChange={(event) => { markEdited(); setOverlayX(Number(event.target.value)); }} /></label>
                <label>Vertical<input type="range" min="0" max="100" value={overlayY} onChange={(event) => { markEdited(); setOverlayY(Number(event.target.value)); }} /></label>
                <label>Image size<input type="range" min="8" max="90" value={overlaySize} onChange={(event) => { markEdited(); setOverlaySize(Number(event.target.value)); }} /></label>
              </>
            )}
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadOverlay}
            />
          </section>

          {!viewer && (
            <Link className="editor-sync-callout" href={`/auth?next=/editor/${id}`}>
              <Cloud size={15} />
              <span><strong>Sync across devices</strong>Sign in to save projects to your account.</span>
            </Link>
          )}

          <button className="reset-editor" onClick={resetEditor}>
            <RotateCcw size={15} /> Reset canvas
          </button>
        </aside>

        <section className="canvas-workspace">
          <div className="workspace-pill"><Sparkles size={13} /> Live preview</div>
          <div className="canvas-shell">
            {!template && <div className="canvas-loading">Loading template…</div>}
            <canvas ref={canvasRef} />
          </div>
        </section>
      </div>
    </main>
  );
}
