"use client";

import { ArrowLeft, Download, ImagePlus, RotateCcw, Sparkles, Type, Upload, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

export default function MemeEditor() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const [topText, setTopText] = useState("WHEN YOU FIND THE PERFECT TEMPLATE");
  const [bottomText, setBottomText] = useState("AND MEMELAB DOES THE REST");
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlay, setOverlay] = useState(null);
  const [overlayX, setOverlayX] = useState(50);
  const [overlayY, setOverlayY] = useState(55);
  const [overlaySize, setOverlaySize] = useState(30);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((response) => response.json())
      .then((payload) => setTemplate((payload.templates || []).find((item) => item.id === id) || null));
  }, [id]);

  const renderCanvas = useCallback(async () => {
    if (!template || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const base = new window.Image();
    base.src = `/api/image?url=${encodeURIComponent(template.url)}`;
    await base.decode();

    const scale = Math.min(1, 1000 / base.naturalWidth);
    canvas.width = Math.round(base.naturalWidth * scale);
    canvas.height = Math.round(base.naturalHeight * scale);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0, canvas.width, canvas.height);

    if (overlay) {
      const layer = new window.Image();
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
    renderCanvas().catch(() => setRendered(false));
  }, [renderCanvas]);

  const uploadOverlay = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOverlay(reader.result);
    reader.readAsDataURL(file);
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = `memelab-${template?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meme"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/" className="editor-back"><ArrowLeft size={18} /> MemeLab</Link>
        <div><span className="status-dot" /> Saved locally</div>
        <button onClick={download} disabled={!rendered}><Download size={17} /> Export PNG</button>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel">
          <div className="editor-title"><span>MEME EDITOR</span><h1>{template?.name || "Loading template…"}</h1></div>

          <section className="control-section">
            <div className="control-heading"><Type size={16} /> Captions</div>
            <label>Top text<textarea value={topText} onChange={(event) => setTopText(event.target.value)} rows={2} /></label>
            <label>Bottom text<textarea value={bottomText} onChange={(event) => setBottomText(event.target.value)} rows={2} /></label>
            <div className="control-row">
              <label>Size<input type="range" min="24" max="84" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
              <label className="color-control">Color<input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
            </div>
          </section>

          <section className="control-section">
            <div className="control-heading"><ImagePlus size={16} /> Character or logo</div>
            {!overlay ? (
              <label className="overlay-upload"><Upload size={18} /> Upload transparent PNG<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadOverlay} /></label>
            ) : (
              <>
                <button className="remove-overlay" onClick={() => setOverlay(null)}><X size={15} /> Remove image</button>
                <label>Horizontal<input type="range" min="0" max="100" value={overlayX} onChange={(event) => setOverlayX(Number(event.target.value))} /></label>
                <label>Vertical<input type="range" min="0" max="100" value={overlayY} onChange={(event) => setOverlayY(Number(event.target.value))} /></label>
                <label>Image size<input type="range" min="8" max="90" value={overlaySize} onChange={(event) => setOverlaySize(Number(event.target.value))} /></label>
              </>
            )}
          </section>

          <button className="reset-editor" onClick={() => { setTopText(""); setBottomText(""); setOverlay(null); setTextColor("#ffffff"); setFontSize(48); }}>
            <RotateCcw size={15} /> Reset canvas
          </button>
        </aside>

        <section className="canvas-workspace">
          <div className="workspace-pill"><Sparkles size={13} /> Live preview</div>
          <div className="canvas-shell">
            {!template && <div className="canvas-loading">Loading template…</div>}
            <canvas ref={canvasRef} />
          </div>
          {template && <a className="editor-attribution" href={template.sourceUrl} target="_blank" rel="noreferrer">Template via Imgflip</a>}
        </section>
      </div>
    </main>
  );
}
