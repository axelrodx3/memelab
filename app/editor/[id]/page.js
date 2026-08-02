"use client";

import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp,
  Check, ChevronDown, Cloud, Copy, Crop, Download, Eye, EyeOff,
  FolderKanban, ImagePlus, Layers3, LoaderCircle, Lock, Maximize2,
  Minus, Palette, Plus, Redo2, RotateCcw, SlidersHorizontal, Sparkles,
  Trash2, Type, Undo2, Unlock, WandSparkles, X, ZoomIn
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { loadCustomBase } from "../../../lib/custom-base";

const MAX_TEXT = 500;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;
const MAX_PREVIEW_PIXELS = 16_777_216;
const MAX_PREVIEW_DIMENSION = 4096;
const MAX_EXPORT_PIXELS = 24_000_000;
const MAX_EXPORT_DIMENSION = 6144;
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_OUTLINE_COLOR = "#000000";
const FONT_OPTIONS = [
  { label: "Impact", value: "Impact" },
  { label: "Arial Black", value: "Arial Black" },
  { label: "Manrope", value: "Manrope" },
  { label: "DM Sans", value: "DM Sans" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Verdana", value: "Verdana" },
  { label: "Trebuchet", value: "Trebuchet MS" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" },
  { label: "Comic Sans", value: "Comic Sans MS" },
  { label: "Brush Script", value: "Brush Script MT" }
];
const FRAME_OPTIONS = [
  { label: "Original", value: "original" },
  { label: "Square", value: "1:1" },
  { label: "Portrait", value: "4:5" },
  { label: "Wide", value: "16:9" }
];
const FILTER_PRESETS = [
  { label: "Original", values: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, hue: 0 } },
  { label: "Punch", values: { brightness: 103, contrast: 118, saturation: 128, grayscale: 0, sepia: 0, hue: 0 } },
  { label: "Mono", values: { brightness: 104, contrast: 116, saturation: 0, grayscale: 100, sepia: 0, hue: 0 } },
  { label: "Warm", values: { brightness: 104, contrast: 106, saturation: 116, grayscale: 0, sepia: 18, hue: -7 } },
  { label: "Cool", values: { brightness: 101, contrast: 108, saturation: 112, grayscale: 0, sepia: 0, hue: 14 } }
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function boundedCanvasSize(width, height, { maxPixels, maxDimension }) {
  const pixelScale = Math.sqrt(maxPixels / Math.max(1, width * height));
  const dimensionScale = Math.min(maxDimension / width, maxDimension / height);
  const scale = Math.min(1, pixelScale, dimensionScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`;
}

function createTextLayer({ id = makeId("text"), text = "NEW TEXT", x = 50, y = 50 } = {}) {
  return {
    id,
    kind: "text",
    text,
    x,
    y,
    width: 86,
    fontSize: 48,
    fontFamily: "Impact",
    fontWeight: 900,
    textColor: DEFAULT_TEXT_COLOR,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    outlineWidth: 7,
    align: "center",
    uppercase: true,
    backgroundColor: "#000000",
    backgroundOpacity: 0,
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowX: 0,
    shadowY: 3,
    opacity: 1,
    rotation: 0,
    visible: true,
    locked: false
  };
}

function createImageLayer({ id = makeId("image"), src = null, name = "Image", assetPath = null, width = 62 } = {}) {
  return {
    id,
    kind: "image",
    name,
    src,
    assetPath,
    x: 50,
    y: 50,
    width,
    frameAspect: "original",
    cropZoom: 1,
    focusX: 50,
    focusY: 50,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    hue: 0,
    cornerRadius: 0,
    opacity: 1,
    rotation: 0,
    visible: true,
    locked: false
  };
}

function defaultLayers() {
  return [
    createTextLayer({ id: "top-caption", text: "WHEN YOU FIND THE PERFECT TEMPLATE", y: 11 }),
    createTextLayer({ id: "bottom-caption", text: "AND MEMELAB DOES THE REST", y: 88 })
  ];
}

function normalizeNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
}

function normalizeLayer(layer) {
  const kind = layer?.kind === "image" ? "image" : "text";
  const base = kind === "image"
    ? createImageLayer({ id: layer?.id || makeId("image"), name: layer?.name || "Image", src: layer?.src || null, assetPath: layer?.assetPath || null })
    : createTextLayer({ id: layer?.id || makeId("text"), text: typeof layer?.text === "string" ? layer.text : "NEW TEXT" });
  return {
    ...base,
    ...layer,
    id: layer?.id || base.id,
    kind,
    x: normalizeNumber(layer?.x, base.x, 0, 100),
    y: normalizeNumber(layer?.y, base.y, 0, 100),
    width: normalizeNumber(layer?.width, base.width, 8, kind === "image" ? 200 : 100),
    opacity: normalizeNumber(layer?.opacity, 1, 0, 1),
    rotation: normalizeNumber(layer?.rotation, 0, -180, 180),
    visible: layer?.visible !== false,
    locked: layer?.locked === true,
    ...(kind === "text" ? {
      text: typeof layer?.text === "string" ? layer.text.slice(0, MAX_TEXT) : base.text,
      fontSize: normalizeNumber(layer?.fontSize, base.fontSize, 12, 180),
      fontFamily: typeof layer?.fontFamily === "string" ? layer.fontFamily : base.fontFamily,
      fontWeight: normalizeNumber(layer?.fontWeight, base.fontWeight, 400, 900),
      textColor: /^#[0-9a-f]{6}$/i.test(layer?.textColor || "") ? layer.textColor : base.textColor,
      outlineColor: /^#[0-9a-f]{6}$/i.test(layer?.outlineColor || "") ? layer.outlineColor : base.outlineColor,
      outlineWidth: normalizeNumber(layer?.outlineWidth, base.outlineWidth, 0, 24),
      align: ["left", "center", "right"].includes(layer?.align) ? layer.align : base.align,
      uppercase: layer?.uppercase !== false,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(layer?.backgroundColor || "") ? layer.backgroundColor : base.backgroundColor,
      backgroundOpacity: normalizeNumber(layer?.backgroundOpacity, 0, 0, 1),
      shadowColor: /^#[0-9a-f]{6}$/i.test(layer?.shadowColor || "") ? layer.shadowColor : base.shadowColor,
      shadowBlur: normalizeNumber(layer?.shadowBlur, 0, 0, 30),
      shadowX: normalizeNumber(layer?.shadowX, 0, -30, 30),
      shadowY: normalizeNumber(layer?.shadowY, 3, -30, 30)
    } : {
      frameAspect: FRAME_OPTIONS.some((option) => option.value === layer?.frameAspect) ? layer.frameAspect : base.frameAspect,
      cropZoom: normalizeNumber(layer?.cropZoom, 1, 1, 4),
      focusX: normalizeNumber(layer?.focusX, 50, 0, 100),
      focusY: normalizeNumber(layer?.focusY, 50, 0, 100),
      brightness: normalizeNumber(layer?.brightness, 100, 0, 200),
      contrast: normalizeNumber(layer?.contrast, 100, 0, 200),
      saturation: normalizeNumber(layer?.saturation, 100, 0, 250),
      blur: normalizeNumber(layer?.blur, 0, 0, 16),
      grayscale: normalizeNumber(layer?.grayscale, 0, 0, 100),
      sepia: normalizeNumber(layer?.sepia, 0, 0, 100),
      hue: normalizeNumber(layer?.hue, 0, -180, 180),
      cornerRadius: normalizeNumber(layer?.cornerRadius, 0, 0, 50)
    })
  };
}

function normalizeEditorState(value = {}) {
  let layers;
  if (Array.isArray(value.layers) && value.layers.length) {
    layers = value.layers.map(normalizeLayer);
  } else {
    const hasLegacyText = Object.hasOwn(value, "topText") || Object.hasOwn(value, "bottomText") || Object.hasOwn(value, "overlayPath");
    const defaults = defaultLayers();
    layers = [
      createTextLayer({ id: "top-caption", text: typeof value.topText === "string" ? value.topText : (hasLegacyText ? "" : defaults[0].text), y: 11 }),
      createTextLayer({ id: "bottom-caption", text: typeof value.bottomText === "string" ? value.bottomText : (hasLegacyText ? "" : defaults[1].text), y: 88 })
    ];
    if (value.overlayPath) layers.push(createImageLayer({ id: "overlay", assetPath: value.overlayPath }));
  }
  return { layers: layers.map(normalizeLayer) };
}

function localDraftKey(templateId) {
  return `memelab:draft:${templateId}`;
}

function resolvedText(layer) {
  return layer.uppercase ? layer.text.toUpperCase() : layer.text;
}

function wrapText(context, text, maxWidth) {
  const words = text.trim().split(/\s+/).filter(Boolean);
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

function textBounds(context, layer, width) {
  const size = Math.max(10, Math.round(layer.fontSize * (width / 600)));
  const maxWidth = width * (layer.width / 100);
  context.font = `${layer.fontWeight} ${size}px ${layer.fontFamily}, Arial, sans-serif`;
  const lines = wrapText(context, resolvedText(layer), maxWidth);
  const lineHeight = size * 1.06;
  return { size, maxWidth, lines, lineHeight, boxWidth: maxWidth, boxHeight: Math.max(lineHeight, lines.length * lineHeight) };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  context.rect(x, y, width, height);
}

function drawTextLayer(context, layer, width, height) {
  if (!layer.text.trim()) return null;
  const metrics = textBounds(context, layer, width);
  const centerX = width * (layer.x / 100);
  const centerY = height * (layer.y / 100);
  const left = centerX - metrics.boxWidth / 2;
  const top = centerY - metrics.boxHeight / 2;
  const textX = layer.align === "left" ? left : layer.align === "right" ? left + metrics.boxWidth : centerX;
  const scale = width / 600;
  context.save();
  context.globalAlpha = layer.opacity;
  context.translate(centerX, centerY);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);
  if (layer.backgroundOpacity > 0) {
    const padding = Math.max(5, metrics.size * 0.22);
    context.save();
    context.globalAlpha = layer.opacity * layer.backgroundOpacity;
    context.fillStyle = layer.backgroundColor;
    roundedRect(context, left - padding, top - padding, metrics.boxWidth + padding * 2, metrics.boxHeight + padding * 2, Math.max(4, metrics.size * 0.14));
    context.fill();
    context.restore();
  }
  context.font = `${layer.fontWeight} ${metrics.size}px ${layer.fontFamily}, Arial, sans-serif`;
  context.textAlign = layer.align;
  context.textBaseline = "top";
  context.lineJoin = "round";
  context.strokeStyle = layer.outlineColor;
  context.lineWidth = Math.max(0, layer.outlineWidth * scale);
  context.fillStyle = layer.textColor;
  context.shadowColor = layer.shadowColor;
  context.shadowBlur = layer.shadowBlur * scale;
  context.shadowOffsetX = layer.shadowX * scale;
  context.shadowOffsetY = layer.shadowY * scale;
  metrics.lines.forEach((line, index) => {
    const lineY = top + index * metrics.lineHeight;
    if (context.lineWidth > 0) context.strokeText(line, textX, lineY, metrics.maxWidth);
    context.fillText(line, textX, lineY, metrics.maxWidth);
  });
  context.restore();
  return { x: left, y: top, width: metrics.boxWidth, height: metrics.boxHeight };
}

function frameAspect(layer, image) {
  if (layer.frameAspect === "1:1") return 1;
  if (layer.frameAspect === "4:5") return 4 / 5;
  if (layer.frameAspect === "16:9") return 16 / 9;
  return image.naturalWidth / image.naturalHeight;
}

function imageGeometry(layer, image, canvasWidth) {
  const aspect = frameAspect(layer, image);
  const width = canvasWidth * (layer.width / 100);
  const height = width / aspect;
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  let baseWidth;
  let baseHeight;
  if (sourceAspect > aspect) {
    baseHeight = image.naturalHeight;
    baseWidth = baseHeight * aspect;
  } else {
    baseWidth = image.naturalWidth;
    baseHeight = baseWidth / aspect;
  }
  const sourceWidth = baseWidth / layer.cropZoom;
  const sourceHeight = baseHeight / layer.cropZoom;
  const sourceX = (image.naturalWidth - sourceWidth) * (layer.focusX / 100);
  const sourceY = (image.naturalHeight - sourceHeight) * (layer.focusY / 100);
  return { width, height, sourceX, sourceY, sourceWidth, sourceHeight };
}

function imageFilter(layer, canvasWidth) {
  const blur = layer.blur * (canvasWidth / 600);
  return `brightness(${layer.brightness}%) contrast(${layer.contrast}%) saturate(${layer.saturation}%) blur(${blur}px) grayscale(${layer.grayscale}%) sepia(${layer.sepia}%) hue-rotate(${layer.hue}deg)`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared.")), type, quality);
  });
}

async function createMagicCutoutBlob(image, tolerance) {
  const maxDimension = 2048;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const total = canvas.width * canvas.height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const cornerIndexes = [0, canvas.width - 1, (canvas.height - 1) * canvas.width, total - 1];
  const targets = cornerIndexes.map((index) => {
    const offset = index * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  });
  const threshold = tolerance * tolerance;
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (index < 0 || index >= total || visited[index]) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < canvas.width; x += 1) {
    enqueue(x);
    enqueue((canvas.height - 1) * canvas.width + x);
  }
  for (let y = 1; y < canvas.height - 1; y += 1) {
    enqueue(y * canvas.width);
    enqueue(y * canvas.width + canvas.width - 1);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const matchesBackground = targets.some(([targetRed, targetGreen, targetBlue]) => {
      const redDistance = red - targetRed;
      const greenDistance = green - targetGreen;
      const blueDistance = blue - targetBlue;
      return redDistance * redDistance + greenDistance * greenDistance + blueDistance * blueDistance <= threshold;
    });
    if (!matchesBackground) continue;
    pixels[offset + 3] = 0;
    const x = index % canvas.width;
    if (x > 0) enqueue(index - 1);
    if (x < canvas.width - 1) enqueue(index + 1);
    if (index >= canvas.width) enqueue(index - canvas.width);
    if (index < total - canvas.width) enqueue(index + canvas.width);
  }
  context.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, "image/png");
}

function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closePicker = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithKeyboard = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closePicker);
    window.addEventListener("keydown", closeWithKeyboard);
    return () => {
      window.removeEventListener("pointerdown", closePicker);
      window.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [open]);

  return (
    <div className="font-picker" ref={pickerRef}>
      <button
        type="button"
        className="font-picker-trigger"
        aria-label="Choose a font"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ fontFamily: value }}>{FONT_OPTIONS.find((font) => font.value === value)?.label || value}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="font-picker-menu" role="listbox" aria-label="Choose a font">
          {FONT_OPTIONS.map((font) => (
            <button
              type="button"
              role="option"
              aria-selected={font.value === value}
              className={font.value === value ? "active" : ""}
              style={{ fontFamily: font.value }}
              onClick={() => { onChange(font.value); setOpen(false); }}
              key={font.value}
            >
              <span>{font.label}</span>
              {font.value === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RangeControl({ label, value, min, max, step = 1, suffix = "", onChange }) {
  return (
    <div className="editor-range-control">
      <div><span>{label}</span><output>{value}{suffix}</output></div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function EmptyInspector({ icon: Icon, title, copy }) {
  return (
    <div className="editor-inspector-empty">
      <span><Icon size={18} /></span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export default function MemeEditor() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const canvasViewportRef = useRef(null);
  const fileInputRef = useRef(null);
  const exportRef = useRef(null);
  const editedRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const editVersionRef = useRef(0);
  const layersRef = useRef([]);
  const layerBoundsRef = useRef(new Map());
  const imageCacheRef = useRef(new Map());
  const pointerRef = useRef(null);
  const historyRef = useRef({ entries: [], index: -1 });
  const pendingAssetIdsRef = useRef(new Set());
  const zoomModeRef = useRef("fit");
  const zoomInputRef = useRef(null);
  const [template, setTemplate] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled meme");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [panelTab, setPanelTab] = useState("layers");
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading…");
  const [saveError, setSaveError] = useState("");
  const [rendered, setRendered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [effectBusy, setEffectBusy] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomDraft, setZoomDraft] = useState("");
  const [cutoutTolerance, setCutoutTolerance] = useState(58);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [exporting, setExporting] = useState(false);

  const selectedLayer = useMemo(() => layers.find((layer) => layer.id === selectedLayerId) || null, [layers, selectedLayerId]);

  const markEdited = useCallback(() => {
    editedRef.current = true;
    editVersionRef.current += 1;
    setSaveError("");
    setSaveStatus(viewer ? "Unsaved changes" : "Saving on this device…");
  }, [viewer]);

  const resetHistory = useCallback((nextLayers) => {
    historyRef.current = { entries: [JSON.stringify(nextLayers)], index: 0 };
    setHistoryTick((value) => value + 1);
  }, []);

  const recordHistory = useCallback((nextLayers) => {
    const snapshot = JSON.stringify(nextLayers);
    const history = historyRef.current;
    if (history.entries[history.index] === snapshot) return;
    history.entries = history.entries.slice(0, history.index + 1);
    history.entries.push(snapshot);
    history.index = history.entries.length - 1;
    if (history.entries.length > 60) {
      history.entries.shift();
      history.index -= 1;
    }
    setHistoryTick((value) => value + 1);
  }, []);

  const setLayerState = useCallback((nextLayers, { history = true, edited = true } = {}) => {
    const normalized = nextLayers.map(normalizeLayer);
    layersRef.current = normalized;
    setLayers(normalized);
    if (history) recordHistory(normalized);
    if (edited) markEdited();
  }, [markEdited, recordHistory]);

  const updateLayer = useCallback((layerId, patch, options = {}) => {
    setLayerState(layersRef.current.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer), options);
  }, [setLayerState]);

  const hydrateState = useCallback((value) => {
    const normalized = normalizeEditorState(value);
    layersRef.current = normalized.layers;
    setLayers(normalized.layers);
    setSelectedLayerId(normalized.layers.find((layer) => layer.visible)?.id || normalized.layers[0]?.id || null);
    resetHistory(normalized.layers);
    return normalized.layers;
  }, [resetHistory]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const initialize = async () => {
      const [templateResponse, userResponse, customBase] = await Promise.all([
        fetch("/api/templates").then((response) => response.json()),
        supabase.auth.getUser(),
        id === "custom" ? loadCustomBase() : Promise.resolve(null)
      ]);
      if (!active) return;
      const selected = id === "custom" && customBase?.file
        ? { id: "custom", name: customBase.name || "Custom image", url: URL.createObjectURL(customBase.file) }
        : (templateResponse.templates || []).find((item) => item.id === id) || null;
      const user = userResponse.data?.user || null;
      const requestedProjectId = new URLSearchParams(window.location.search).get("project");
      setTemplate(selected);
      setViewer(user);
      setProjectName(selected ? `Untitled ${selected.name}`.slice(0, 80) : "Untitled meme");

      if (requestedProjectId && user && id !== "custom") {
        const { data: project } = await supabase
          .from("projects")
          .select("id,name,template_id,editor_state")
          .eq("id", requestedProjectId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (project && project.template_id === id) {
          setProjectId(project.id);
          setProjectName(project.name);
          const loadedLayers = hydrateState(project.editor_state);
          const signedLayers = await Promise.all(loadedLayers.map(async (layer) => {
            if (layer.kind !== "image" || !layer.assetPath) return layer;
            const { data } = await supabase.storage.from("project-assets").createSignedUrl(layer.assetPath, 60 * 60);
            return data?.signedUrl ? { ...layer, src: data.signedUrl } : layer;
          }));
          if (active) {
            layersRef.current = signedLayers;
            setLayers(signedLayers);
            resetHistory(signedLayers);
          }
          setSaveStatus("Saved to your account");
        } else {
          setSaveError("That private project is unavailable.");
          hydrateState({});
          setSaveStatus("New project");
        }
      } else if (requestedProjectId) {
        hydrateState({});
        setSaveError("Sign in to open this private project.");
        setSaveStatus("Sign in required");
      } else {
        let draft = null;
        try {
          const stored = window.localStorage.getItem(localDraftKey(id));
          draft = stored ? JSON.parse(stored) : null;
        } catch {}
        const loadedLayers = hydrateState(draft?.editorState || {});
        if (draft?.overlayDataUrl && !loadedLayers.some((layer) => layer.kind === "image")) {
          const imageLayer = createImageLayer({ src: draft.overlayDataUrl, name: "Uploaded image" });
          const withImage = [...loadedLayers, imageLayer];
          layersRef.current = withImage;
          setLayers(withImage);
          setSelectedLayerId(imageLayer.id);
          resetHistory(withImage);
        }
        if (draft?.name) setProjectName(draft.name);
        setSaveStatus(user && id !== "custom" ? "Autosave ready" : "Saved on this device");
      }
      setReady(true);
    };
    initialize().catch(() => {
      if (!active) return;
      hydrateState({});
      setSaveStatus("Editor unavailable");
      setSaveError("MemeLab could not load this project.");
      setReady(true);
    });
    return () => { active = false; };
  }, [hydrateState, id, resetHistory]);

  const editorState = useCallback((includeLocalAssets = false) => {
    const serializableLayers = layersRef.current.map((layer) => {
      const copy = { ...layer };
      if (!includeLocalAssets || copy.assetPath) delete copy.src;
      return copy;
    });
    const textLayers = serializableLayers.filter((layer) => layer.kind === "text");
    return {
      version: 3,
      topText: textLayers[0]?.text || "",
      bottomText: textLayers[1]?.text || "",
      layers: serializableLayers
    };
  }, []);

  const saveProject = useCallback(async () => {
    if (!ready || !editedRef.current) return;
    if (viewer && id !== "custom" && pendingAssetIdsRef.current.size > 0) {
      pendingSaveRef.current = true;
      setSaveStatus("Syncing image…");
      return;
    }
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    const saveVersion = editVersionRef.current;
    try {
      window.localStorage.setItem(localDraftKey(id), JSON.stringify({
        name: projectName,
        editorState: editorState(!viewer || id === "custom")
      }));
      if (!viewer || id === "custom") {
        const current = saveVersion === editVersionRef.current;
        editedRef.current = !current;
        pendingSaveRef.current ||= !current;
        setSaveStatus(current ? "Saved on this device" : "Unsaved changes");
        return;
      }
      setSaveStatus("Saving…");
      const supabase = createClient();
      const state = editorState(false);
      if (projectId) {
        const { error } = await supabase.from("projects").update({ name: projectName.trim() || "Untitled meme", editor_state: state }).eq("id", projectId).eq("user_id", viewer.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("projects").insert({ user_id: viewer.id, template_id: id, name: projectName.trim() || "Untitled meme", editor_state: state }).select("id").single();
        if (error) throw error;
        setProjectId(data.id);
        const url = new URL(window.location.href);
        url.searchParams.set("project", data.id);
        window.history.replaceState(null, "", url);
      }
      const current = saveVersion === editVersionRef.current;
      editedRef.current = !current;
      pendingSaveRef.current ||= !current;
      setSaveStatus(current ? "Saved to your account" : "Unsaved changes");
    } catch (error) {
      setSaveStatus("Save failed");
      setSaveError(error.message || "Your project could not be saved.");
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        setHistoryTick((value) => value + 1);
      }
    }
  }, [editorState, id, projectId, projectName, ready, viewer]);

  useEffect(() => {
    if (!ready || !editedRef.current) return undefined;
    const timeout = window.setTimeout(saveProject, 800);
    return () => window.clearTimeout(timeout);
  }, [historyTick, layers, projectName, ready, saveProject]);

  const loadImage = useCallback(async (source) => {
    if (!source) return null;
    if (imageCacheRef.current.has(source)) return imageCacheRef.current.get(source);
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    const loaded = new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("An image used by this project could not be loaded."));
    });
    image.src = source;
    try {
      await image.decode();
    } catch {
      await loaded;
    }
    imageCacheRef.current.set(source, image);
    return image;
  }, []);

  const drawScene = useCallback(async (context, width, height, showSelection = true) => {
    if (!template) return;
    const base = await loadImage(template.url);
    if (!base) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.filter = "none";
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(base, 0, 0, width, height);
    const bounds = new Map();
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      if (layer.kind === "text") {
        const box = drawTextLayer(context, layer, width, height);
        if (box) bounds.set(layer.id, box);
        continue;
      }
      const image = await loadImage(layer.src);
      if (!image) continue;
      const geometry = imageGeometry(layer, image, width);
      const centerX = width * (layer.x / 100);
      const centerY = height * (layer.y / 100);
      context.save();
      context.globalAlpha = layer.opacity;
      context.filter = imageFilter(layer, width);
      context.translate(centerX, centerY);
      context.rotate((layer.rotation * Math.PI) / 180);
      if (layer.cornerRadius > 0) {
        const radius = Math.min(geometry.width, geometry.height) * (layer.cornerRadius / 100) * 0.5;
        roundedRect(context, -geometry.width / 2, -geometry.height / 2, geometry.width, geometry.height, radius);
        context.clip();
      }
      context.drawImage(
        image,
        geometry.sourceX,
        geometry.sourceY,
        geometry.sourceWidth,
        geometry.sourceHeight,
        -geometry.width / 2,
        -geometry.height / 2,
        geometry.width,
        geometry.height
      );
      context.restore();
      bounds.set(layer.id, { x: centerX - geometry.width / 2, y: centerY - geometry.height / 2, width: geometry.width, height: geometry.height });
    }
    layerBoundsRef.current = bounds;
    if (showSelection && selectedLayerId && bounds.has(selectedLayerId)) {
      const box = bounds.get(selectedLayerId);
      context.save();
      context.filter = "none";
      context.strokeStyle = "rgba(191, 170, 255, .95)";
      context.lineWidth = Math.max(1, width / 600);
      context.setLineDash([7, 5]);
      context.strokeRect(box.x - 5, box.y - 5, box.width + 10, box.height + 10);
      context.setLineDash([]);
      context.restore();
    }
  }, [loadImage, selectedLayerId, template]);

  const renderCanvas = useCallback(async (showSelection = true) => {
    if (!template || !canvasRef.current) return;
    const base = await loadImage(template.url);
    if (!base) return;
    const canvas = canvasRef.current;
    const documentWidth = base.naturalWidth;
    const documentHeight = base.naturalHeight;
    const maximumPreview = boundedCanvasSize(documentWidth, documentHeight, {
      maxPixels: MAX_PREVIEW_PIXELS,
      maxDimension: MAX_PREVIEW_DIMENSION
    });
    const deviceScale = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const requestedScale = Math.max(1, zoom * deviceScale);
    const renderScale = Math.min(requestedScale, maximumPreview.scale);
    const width = Math.max(1, Math.round(documentWidth * renderScale));
    const height = Math.max(1, Math.round(documentHeight * renderScale));
    canvas.width = width;
    canvas.height = height;
    setCanvasSize((current) => current.width === documentWidth && current.height === documentHeight ? current : { width: documentWidth, height: documentHeight });
    await drawScene(canvas.getContext("2d"), width, height, showSelection);
    setRendered(true);
  }, [drawScene, loadImage, template, zoom]);

  useEffect(() => {
    setRendered(false);
    renderCanvas().catch(() => setRendered(false));
  }, [renderCanvas, layers, selectedLayerId]);

  const fitCanvas = useCallback(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || !canvasSize.width || !canvasSize.height) return;
    const availableWidth = Math.max(180, viewport.clientWidth - 80);
    const availableHeight = Math.max(160, viewport.clientHeight - 80);
    const nextZoom = clamp(Math.min(availableWidth / canvasSize.width, availableHeight / canvasSize.height), MIN_ZOOM, MAX_ZOOM);
    zoomModeRef.current = "fit";
    setZoom(Number(nextZoom.toFixed(2)));
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    if (!canvasSize.width || !canvasViewportRef.current) return undefined;
    fitCanvas();
    const observer = new ResizeObserver(() => {
      if (zoomModeRef.current === "fit") fitCanvas();
    });
    observer.observe(canvasViewportRef.current);
    return () => observer.disconnect();
  }, [canvasSize.width, fitCanvas]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = (event) => {
      if (!exportRef.current?.contains(event.target)) setExportOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [exportOpen]);

  const changeZoom = (amount) => {
    zoomModeRef.current = "manual";
    setZoom((current) => Number(clamp(current + amount, MIN_ZOOM, MAX_ZOOM).toFixed(2)));
  };

  const beginZoomEditing = () => {
    setZoomDraft(String(Math.round(zoom * 100)));
    setZoomEditing(true);
  };

  const applyZoomDraft = () => {
    const requestedPercent = Number(zoomDraft);
    if (Number.isFinite(requestedPercent)) {
      zoomModeRef.current = "manual";
      setZoom(Number(clamp(requestedPercent / 100, MIN_ZOOM, MAX_ZOOM).toFixed(2)));
    }
    setZoomEditing(false);
  };

  useEffect(() => {
    if (!zoomEditing) return;
    zoomInputRef.current?.focus();
    zoomInputRef.current?.select();
  }, [zoomEditing]);

  const syncAsset = useCallback(async (blob, type) => {
    if (!viewer || id === "custom") return null;
    const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const path = `${viewer.id}/${makeId("asset")}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("project-assets").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    return path;
  }, [id, viewer]);

  const addTextLayer = () => {
    const layer = createTextLayer({ text: "NEW TEXT", y: 50 });
    setLayerState([...layersRef.current, layer]);
    setSelectedLayerId(layer.id);
    setPanelTab("style");
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setSaveError("Choose a PNG, JPEG, or WebP image under 10 MB.");
      return;
    }
    setUploading(true);
    setSaveError("");
    const layerId = makeId("image");
    try {
      const dataUrl = await blobToDataUrl(file);
      const image = await loadImage(dataUrl);
      const canvas = canvasRef.current;
      const aspect = image.naturalWidth / image.naturalHeight;
      const fittedWidth = canvas?.width && canvas?.height
        ? clamp(72 * (canvas.height / canvas.width) * aspect, 34, 72)
        : 62;
      const layer = createImageLayer({ id: layerId, src: dataUrl, name: file.name, width: fittedWidth });
      if (viewer && id !== "custom") pendingAssetIdsRef.current.add(layer.id);
      setLayerState([...layersRef.current, layer]);
      setSelectedLayerId(layer.id);
      setPanelTab("style");
      if (viewer && id !== "custom") {
        const assetPath = await syncAsset(file, file.type);
        updateLayer(layer.id, { assetPath }, { history: false });
      }
    } catch (error) {
      setSaveError(error.message || "That image could not be added to the canvas.");
    } finally {
      pendingAssetIdsRef.current.delete(layerId);
      setHistoryTick((value) => value + 1);
      setUploading(false);
    }
  };

  const removeSelected = () => {
    if (!selectedLayer || selectedLayer.locked) return;
    setLayerState(layersRef.current.filter((layer) => layer.id !== selectedLayer.id));
    setSelectedLayerId(null);
  };

  const duplicateSelected = () => {
    if (!selectedLayer) return;
    const duplicate = {
      ...selectedLayer,
      id: makeId(selectedLayer.kind),
      x: Math.min(92, selectedLayer.x + 4),
      y: Math.min(92, selectedLayer.y + 4),
      name: selectedLayer.kind === "image" ? `${selectedLayer.name || "Image"} copy` : undefined
    };
    setLayerState([...layersRef.current, duplicate]);
    setSelectedLayerId(duplicate.id);
  };

  const moveSelected = (direction) => {
    if (!selectedLayer) return;
    const index = layersRef.current.findIndex((layer) => layer.id === selectedLayer.id);
    const nextIndex = direction === "up" ? Math.min(layersRef.current.length - 1, index + 1) : Math.max(0, index - 1);
    if (index === nextIndex) return;
    const next = [...layersRef.current];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setLayerState(next);
  };

  const undo = () => {
    const history = historyRef.current;
    if (history.index <= 0) return;
    history.index -= 1;
    const next = JSON.parse(history.entries[history.index]);
    layersRef.current = next;
    setLayers(next);
    setSelectedLayerId(next.find((layer) => layer.id === selectedLayerId)?.id || next[0]?.id || null);
    markEdited();
    setHistoryTick((value) => value + 1);
  };

  const redo = () => {
    const history = historyRef.current;
    if (history.index >= history.entries.length - 1) return;
    history.index += 1;
    const next = JSON.parse(history.entries[history.index]);
    layersRef.current = next;
    setLayers(next);
    setSelectedLayerId(next.find((layer) => layer.id === selectedLayerId)?.id || next[0]?.id || null);
    markEdited();
    setHistoryTick((value) => value + 1);
  };

  const canvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handlePointerDown = (event) => {
    if (!canvasRef.current) return;
    const point = canvasPoint(event);
    const hit = [...layersRef.current].reverse().find((layer) => {
      const box = layerBoundsRef.current.get(layer.id);
      return layer.visible && box && point.x >= box.x - 8 && point.x <= box.x + box.width + 8 && point.y >= box.y - 8 && point.y <= box.y + box.height + 8;
    });
    if (!hit) {
      setSelectedLayerId(null);
      pointerRef.current = null;
      return;
    }
    setSelectedLayerId(hit.id);
    if (hit.locked) return;
    pointerRef.current = { id: hit.id, startX: point.x, startY: point.y, x: hit.x, y: hit.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || !canvasRef.current) return;
    const point = canvasPoint(event);
    const nextX = clamp(pointer.x + ((point.x - pointer.startX) / canvasRef.current.width) * 100, 0, 100);
    const nextY = clamp(pointer.y + ((point.y - pointer.startY) / canvasRef.current.height) * 100, 0, 100);
    const next = layersRef.current.map((layer) => layer.id === pointer.id ? { ...layer, x: nextX, y: nextY } : layer);
    layersRef.current = next;
    setLayers(next);
    markEdited();
  };

  const handlePointerUp = () => {
    if (!pointerRef.current) return;
    recordHistory(layersRef.current);
    pointerRef.current = null;
  };

  const fitSelectedImage = async (mode) => {
    if (!selectedLayer || selectedLayer.kind !== "image" || !canvasRef.current) return;
    const image = await loadImage(selectedLayer.src);
    if (!image) return;
    const aspect = frameAspect(selectedLayer, image);
    const canvas = canvasRef.current;
    const width = mode === "fill"
      ? clamp(Math.max(100, 100 * (canvas.height / canvas.width) * aspect), 100, 200)
      : clamp(Math.min(78, 78 * (canvas.height / canvas.width) * aspect), 14, 78);
    updateLayer(selectedLayer.id, { x: 50, y: 50, width });
  };

  const applyMagicCutout = async () => {
    if (!selectedLayer || selectedLayer.kind !== "image" || !selectedLayer.src) return;
    const layerId = selectedLayer.id;
    const originalSource = selectedLayer.src;
    setEffectBusy(true);
    setSaveError("");
    try {
      const image = await loadImage(originalSource);
      const blob = await createMagicCutoutBlob(image, cutoutTolerance);
      const dataUrl = await blobToDataUrl(blob);
      imageCacheRef.current.delete(originalSource);
      if (viewer && id !== "custom") pendingAssetIdsRef.current.add(layerId);
      updateLayer(layerId, { src: dataUrl, assetPath: null, name: `${selectedLayer.name || "Image"} cutout`, frameAspect: "original" });
      if (viewer && id !== "custom") {
        const assetPath = await syncAsset(blob, "image/png");
        updateLayer(layerId, { assetPath }, { history: false });
      }
    } catch (error) {
      setSaveError(error.message || "Magic cutout could not process this image.");
    } finally {
      pendingAssetIdsRef.current.delete(layerId);
      setHistoryTick((value) => value + 1);
      setEffectBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName;
      const editingField = activeTag === "TEXTAREA" || activeTag === "INPUT" || activeTag === "SELECT" || document.activeElement?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (event.key === "Escape") {
        setExportOpen(false);
        setSelectedLayerId(null);
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedLayer && !editingField) {
        event.preventDefault();
        removeSelected();
      }
      if (selectedLayer && !selectedLayer.locked && !editingField && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 1 : 0.25;
        const patch = {};
        if (event.key === "ArrowLeft") patch.x = clamp(selectedLayer.x - amount, 0, 100);
        if (event.key === "ArrowRight") patch.x = clamp(selectedLayer.x + amount, 0, 100);
        if (event.key === "ArrowUp") patch.y = clamp(selectedLayer.y - amount, 0, 100);
        if (event.key === "ArrowDown") patch.y = clamp(selectedLayer.y + amount, 0, 100);
        updateLayer(selectedLayer.id, patch);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const resetEditor = () => {
    const next = defaultLayers();
    setLayerState(next);
    setSelectedLayerId(next[0].id);
    setPanelTab("layers");
  };

  const download = async () => {
    if (!template || !canvasRef.current) return;
    setExporting(true);
    try {
      const base = await loadImage(template.url);
      if (!base) throw new Error("The original image could not be loaded for export.");
      const exportSize = boundedCanvasSize(base.naturalWidth, base.naturalHeight, {
        maxPixels: MAX_EXPORT_PIXELS,
        maxDimension: MAX_EXPORT_DIMENSION
      });
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportSize.width;
      exportCanvas.height = exportSize.height;
      await drawScene(exportCanvas.getContext("2d"), exportCanvas.width, exportCanvas.height, false);
      const isJpeg = exportFormat === "jpg";
      const mimeType = isJpeg ? "image/jpeg" : "image/png";
      const blob = await canvasToBlob(exportCanvas, mimeType, isJpeg ? exportQuality / 100 : undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `memelab-${template.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meme"}.${exportFormat}`;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportOpen(false);
    } catch (error) {
      setSaveError(error.message || "MemeLab could not export this image.");
    } finally {
      setExporting(false);
    }
  };

  const StatusIcon = saveStatus === "Saving…" || saveStatus === "Syncing image…" ? LoaderCircle : saveStatus.startsWith("Saved") ? Check : Cloud;
  const history = historyRef.current;
  const canUndo = history.index > 0;
  const canRedo = history.index >= 0 && history.index < history.entries.length - 1;
  const displayWidth = Math.max(1, Math.round(canvasSize.width * zoom));
  const displayHeight = Math.max(1, Math.round(canvasSize.height * zoom));

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/studio" className="editor-back"><ArrowLeft size={18} /> MemeLab Studio</Link>
        <div className="editor-project-status" title={saveError || saveStatus}><StatusIcon size={13} className={saveStatus === "Saving…" || saveStatus === "Syncing image…" ? "spin" : ""} /><span>{saveError || saveStatus}</span></div>
        <div className="editor-header-actions">
          <button type="button" className="editor-icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
          <button type="button" className="editor-icon-button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
          <Link href="/projects"><FolderKanban size={16} /> Projects</Link>
          <div className="editor-export" ref={exportRef}>
            <button type="button" onClick={() => setExportOpen((current) => !current)} disabled={!rendered} aria-expanded={exportOpen}><Download size={17} /> Export</button>
            {exportOpen ? (
              <div className="editor-export-menu">
                <header><span>EXPORT PROJECT</span><strong>Ready to share.</strong></header>
                <div className="editor-export-formats">
                  <button type="button" className={exportFormat === "png" ? "active" : ""} onClick={() => setExportFormat("png")}><strong>PNG</strong><span>Best quality</span></button>
                  <button type="button" className={exportFormat === "jpg" ? "active" : ""} onClick={() => setExportFormat("jpg")}><strong>JPG</strong><span>Smaller file</span></button>
                </div>
                {exportFormat === "jpg" ? <RangeControl label="Quality" value={exportQuality} min={60} max={100} suffix="%" onChange={setExportQuality} /> : null}
                <div className="editor-export-meta"><span>{canvasSize.width} × {canvasSize.height}px</span><span>No watermark</span></div>
                <button type="button" className="editor-export-download" onClick={download} disabled={exporting}>{exporting ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} Download {exportFormat.toUpperCase()}</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel">
          <div className="editor-panel-top">
            <div className="editor-title">
              <span>MEMELAB STUDIO</span>
              <input className="project-name-input" value={projectName} maxLength={80} aria-label="Project name" onChange={(event) => { markEdited(); setProjectName(event.target.value); }} />
              <p>{template?.name || "Loading template…"}</p>
            </div>
            <div className="editor-add-grid">
              <button type="button" onClick={addTextLayer}><Type size={16} /> Text</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />} Image</button>
            </div>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} />
            <nav className="editor-panel-tabs" aria-label="Editor tools">
              <button type="button" className={panelTab === "layers" ? "active" : ""} onClick={() => setPanelTab("layers")}><Layers3 size={14} /> Layers</button>
              <button type="button" className={panelTab === "style" ? "active" : ""} onClick={() => setPanelTab("style")}><Palette size={14} /> Style</button>
              <button type="button" className={panelTab === "adjust" ? "active" : ""} onClick={() => setPanelTab("adjust")}><SlidersHorizontal size={14} /> Adjust</button>
            </nav>
          </div>

          <div className="editor-panel-scroll">
            {panelTab === "layers" ? (
              <>
                <section className="editor-inspector-section editor-layers-section">
                  <div className="control-heading"><Layers3 size={16} /> Layers <span>{layers.length}</span></div>
                  <div className="editor-layer-list">
                    {[...layers].reverse().map((layer) => (
                      <button type="button" className={`editor-layer-row${selectedLayerId === layer.id ? " selected" : ""}`} key={layer.id} onClick={() => setSelectedLayerId(layer.id)}>
                        <span className="editor-layer-kind">{layer.kind === "text" ? <Type size={13} /> : <ImagePlus size={13} />}</span>
                        <span className="editor-layer-name">{layer.kind === "text" ? (layer.text || "Empty text") : (layer.name || "Image")}</span>
                        <span className="editor-layer-state">{layer.locked ? <Lock size={12} /> : layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}</span>
                      </button>
                    ))}
                    {!layers.length ? <p className="editor-no-layers">Add text or an image to begin.</p> : null}
                  </div>
                </section>
                {selectedLayer ? (
                  <section className="editor-inspector-section">
                    <div className="control-heading"><Sparkles size={15} /> Layer actions</div>
                    <div className="editor-layer-actions">
                      <button type="button" onClick={() => updateLayer(selectedLayer.id, { visible: !selectedLayer.visible })}>{selectedLayer.visible ? <EyeOff size={14} /> : <Eye size={14} />} {selectedLayer.visible ? "Hide" : "Show"}</button>
                      <button type="button" onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}>{selectedLayer.locked ? <Unlock size={14} /> : <Lock size={14} />} {selectedLayer.locked ? "Unlock" : "Lock"}</button>
                      <button type="button" onClick={duplicateSelected}><Copy size={14} /> Duplicate</button>
                      <button type="button" onClick={removeSelected} disabled={selectedLayer.locked}><Trash2 size={14} /> Delete</button>
                      <button type="button" onClick={() => moveSelected("up")}><ArrowUp size={13} /> Forward</button>
                      <button type="button" onClick={() => moveSelected("down")}><ArrowDown size={13} /> Back</button>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {panelTab === "style" ? (
              selectedLayer ? (
                <>
                  <div className="editor-selected-label"><span>{selectedLayer.kind === "text" ? <Type size={13} /> : <ImagePlus size={13} />}</span><div><strong>{selectedLayer.kind === "text" ? "Text layer" : "Image layer"}</strong><small>{selectedLayer.kind === "text" ? "Typography and appearance" : "Crop, frame and cutout"}</small></div></div>
                  {selectedLayer.kind === "text" ? (
                    <>
                      <section className="editor-inspector-section editor-properties-section">
                        <label>Text<textarea value={selectedLayer.text} maxLength={MAX_TEXT} rows={3} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} /></label>
                        <div className="editor-field"><span>Font</span><FontPicker value={selectedLayer.fontFamily} onChange={(fontFamily) => updateLayer(selectedLayer.id, { fontFamily })} /></div>
                        <div className="editor-segmented editor-weight-control">
                          {[400, 700, 900].map((weight) => <button type="button" className={selectedLayer.fontWeight === weight ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { fontWeight: weight })} key={weight}>{weight === 400 ? "Regular" : weight === 700 ? "Bold" : "Heavy"}</button>)}
                        </div>
                        <RangeControl label="Size" value={selectedLayer.fontSize} min={12} max={180} onChange={(fontSize) => updateLayer(selectedLayer.id, { fontSize })} />
                        <RangeControl label="Outline" value={selectedLayer.outlineWidth} min={0} max={24} onChange={(outlineWidth) => updateLayer(selectedLayer.id, { outlineWidth })} />
                        <div className="editor-style-grid"><label>Fill<input type="color" value={selectedLayer.textColor} onChange={(event) => updateLayer(selectedLayer.id, { textColor: event.target.value })} /></label><label>Outline<input type="color" value={selectedLayer.outlineColor} onChange={(event) => updateLayer(selectedLayer.id, { outlineColor: event.target.value })} /></label></div>
                        <div className="editor-text-toolbar">
                          <div className="editor-align-buttons"><button type="button" className={selectedLayer.align === "left" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "left" })} aria-label="Align left"><AlignLeft size={14} /></button><button type="button" className={selectedLayer.align === "center" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "center" })} aria-label="Align center"><AlignCenter size={14} /></button><button type="button" className={selectedLayer.align === "right" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "right" })} aria-label="Align right"><AlignRight size={14} /></button></div>
                          <button type="button" className={`editor-case-button${selectedLayer.uppercase ? " active" : ""}`} onClick={() => updateLayer(selectedLayer.id, { uppercase: !selectedLayer.uppercase })}>AA</button>
                        </div>
                      </section>
                      <section className="editor-inspector-section">
                        <div className="control-heading"><Sparkles size={15} /> Depth</div>
                        <div className="editor-style-grid"><label>Text box<input type="color" value={selectedLayer.backgroundColor} onChange={(event) => updateLayer(selectedLayer.id, { backgroundColor: event.target.value })} /></label><label>Shadow<input type="color" value={selectedLayer.shadowColor} onChange={(event) => updateLayer(selectedLayer.id, { shadowColor: event.target.value })} /></label></div>
                        <RangeControl label="Text box" value={Math.round(selectedLayer.backgroundOpacity * 100)} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { backgroundOpacity: value / 100 })} />
                        <RangeControl label="Shadow blur" value={selectedLayer.shadowBlur} min={0} max={30} onChange={(shadowBlur) => updateLayer(selectedLayer.id, { shadowBlur })} />
                        <RangeControl label="Shadow distance" value={selectedLayer.shadowY} min={-30} max={30} onChange={(shadowY) => updateLayer(selectedLayer.id, { shadowY })} />
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="editor-inspector-section">
                        <div className="control-heading"><Maximize2 size={15} /> Canvas fit</div>
                        <div className="editor-fit-actions"><button type="button" onClick={() => fitSelectedImage("fit")}><Maximize2 size={14} /> Fit</button><button type="button" onClick={() => fitSelectedImage("fill")}><ZoomIn size={14} /> Fill</button></div>
                        <p className="editor-tool-note">Fit keeps the full layer visible. Fill covers the canvas edge to edge.</p>
                      </section>
                      <section className="editor-inspector-section">
                        <div className="control-heading"><Crop size={15} /> Crop and frame</div>
                        <div className="editor-frame-options">{FRAME_OPTIONS.map((option) => <button type="button" className={selectedLayer.frameAspect === option.value ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { frameAspect: option.value, cropZoom: 1, focusX: 50, focusY: 50 })} key={option.value}>{option.label}</button>)}</div>
                        <RangeControl label="Image zoom" value={selectedLayer.cropZoom} min={1} max={4} step={0.05} suffix="×" onChange={(cropZoom) => updateLayer(selectedLayer.id, { cropZoom })} />
                        <RangeControl label="Focus left to right" value={selectedLayer.focusX} min={0} max={100} suffix="%" onChange={(focusX) => updateLayer(selectedLayer.id, { focusX })} />
                        <RangeControl label="Focus top to bottom" value={selectedLayer.focusY} min={0} max={100} suffix="%" onChange={(focusY) => updateLayer(selectedLayer.id, { focusY })} />
                        <RangeControl label="Rounded corners" value={selectedLayer.cornerRadius} min={0} max={50} suffix="%" onChange={(cornerRadius) => updateLayer(selectedLayer.id, { cornerRadius })} />
                      </section>
                      <section className="editor-inspector-section editor-magic-tool">
                        <div className="control-heading"><WandSparkles size={15} /> Magic cutout <span className="editor-tool-badge">BETA</span></div>
                        <p>Removes edge connected backgrounds directly in your browser. Best on logos, characters and simple backgrounds.</p>
                        <RangeControl label="Sensitivity" value={cutoutTolerance} min={18} max={140} onChange={setCutoutTolerance} />
                        <button type="button" className="editor-magic-button" onClick={applyMagicCutout} disabled={effectBusy}>{effectBusy ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />} {effectBusy ? "Removing background…" : "Remove background"}</button>
                      </section>
                    </>
                  )}
                </>
              ) : <EmptyInspector icon={Palette} title="Select a layer" copy="Choose a text or image layer to open its styling tools." />
            ) : null}

            {panelTab === "adjust" ? (
              selectedLayer ? (
                <>
                  <div className="editor-selected-label"><span><SlidersHorizontal size={13} /></span><div><strong>Adjust layer</strong><small>Position, scale and finishing</small></div></div>
                  <section className="editor-inspector-section">
                    <div className="control-heading"><Maximize2 size={15} /> Transform</div>
                    <RangeControl label="Horizontal" value={selectedLayer.x} min={0} max={100} step={0.25} suffix="%" onChange={(x) => updateLayer(selectedLayer.id, { x })} />
                    <RangeControl label="Vertical" value={selectedLayer.y} min={0} max={100} step={0.25} suffix="%" onChange={(y) => updateLayer(selectedLayer.id, { y })} />
                    <RangeControl label={selectedLayer.kind === "text" ? "Text width" : "Layer size"} value={selectedLayer.width} min={8} max={selectedLayer.kind === "image" ? 200 : 100} suffix="%" onChange={(width) => updateLayer(selectedLayer.id, { width })} />
                    <RangeControl label="Rotation" value={selectedLayer.rotation} min={-180} max={180} suffix="°" onChange={(rotation) => updateLayer(selectedLayer.id, { rotation })} />
                    <RangeControl label="Opacity" value={Math.round(selectedLayer.opacity * 100)} min={0} max={100} suffix="%" onChange={(value) => updateLayer(selectedLayer.id, { opacity: value / 100 })} />
                  </section>
                  {selectedLayer.kind === "image" ? (
                    <>
                      <section className="editor-inspector-section">
                        <div className="control-heading"><Sparkles size={15} /> Looks</div>
                        <div className="editor-filter-presets">{FILTER_PRESETS.map((preset) => <button type="button" onClick={() => updateLayer(selectedLayer.id, preset.values)} key={preset.label}>{preset.label}</button>)}</div>
                      </section>
                      <section className="editor-inspector-section">
                        <div className="control-heading"><SlidersHorizontal size={15} /> Image controls</div>
                        <RangeControl label="Brightness" value={selectedLayer.brightness} min={0} max={200} suffix="%" onChange={(brightness) => updateLayer(selectedLayer.id, { brightness })} />
                        <RangeControl label="Contrast" value={selectedLayer.contrast} min={0} max={200} suffix="%" onChange={(contrast) => updateLayer(selectedLayer.id, { contrast })} />
                        <RangeControl label="Saturation" value={selectedLayer.saturation} min={0} max={250} suffix="%" onChange={(saturation) => updateLayer(selectedLayer.id, { saturation })} />
                        <RangeControl label="Blur" value={selectedLayer.blur} min={0} max={16} onChange={(blur) => updateLayer(selectedLayer.id, { blur })} />
                        <RangeControl label="Grayscale" value={selectedLayer.grayscale} min={0} max={100} suffix="%" onChange={(grayscale) => updateLayer(selectedLayer.id, { grayscale })} />
                        <RangeControl label="Sepia" value={selectedLayer.sepia} min={0} max={100} suffix="%" onChange={(sepia) => updateLayer(selectedLayer.id, { sepia })} />
                        <RangeControl label="Hue" value={selectedLayer.hue} min={-180} max={180} suffix="°" onChange={(hue) => updateLayer(selectedLayer.id, { hue })} />
                      </section>
                    </>
                  ) : null}
                </>
              ) : <EmptyInspector icon={SlidersHorizontal} title="Nothing selected" copy="Select a layer to position, resize or adjust it." />
            ) : null}
          </div>

          <footer className="editor-panel-footer">
            {!viewer || id === "custom" ? <div className="editor-sync-compact"><Cloud size={14} /><span><strong>Saved on this device</strong><small>Sign in for private cloud sync.</small></span></div> : <div className="editor-sync-compact"><Cloud size={14} /><span><strong>Autosave is on</strong><small>Editable layers stay private.</small></span></div>}
            <button type="button" className="reset-editor" onClick={resetEditor}><RotateCcw size={14} /> Reset</button>
          </footer>
        </aside>

        <section className="canvas-workspace">
          <div className="editor-workspace-toolbar">
            <span><Sparkles size={13} /> Drag unlocked layers. Use arrow keys for precision.</span>
            <div className="editor-zoom-controls">
              <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out"><Minus size={14} /></button>
              {zoomEditing ? (
                <input
                  ref={zoomInputRef}
                  className="editor-zoom-value"
                  type="number"
                  min={MIN_ZOOM * 100}
                  max={MAX_ZOOM * 100}
                  value={zoomDraft}
                  inputMode="numeric"
                  aria-label="Set zoom percentage"
                  onChange={(event) => setZoomDraft(event.target.value)}
                  onBlur={applyZoomDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyZoomDraft();
                    if (event.key === "Escape") setZoomEditing(false);
                  }}
                />
              ) : (
                <button type="button" className="editor-zoom-value" onDoubleClick={beginZoomEditing} onClick={beginZoomEditing} aria-label="Edit zoom percentage">
                  {Math.round(zoom * 100)}%
                </button>
              )}
              <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in"><Plus size={14} /></button>
              <button type="button" className="editor-fit-canvas" onClick={fitCanvas}><Maximize2 size={13} /> Fit</button>
            </div>
          </div>
          <div className="canvas-viewport" ref={canvasViewportRef}>
            <div className="canvas-stage" style={{ minWidth: `${displayWidth + 80}px`, minHeight: `${displayHeight + 80}px` }}>
              <div className="canvas-shell" style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}>
                {!template ? <div className="canvas-loading">Loading template…</div> : null}
                <canvas
                  ref={canvasRef}
                  style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  aria-label="MemeLab editable canvas"
                />
              </div>
            </div>
          </div>
          {selectedLayer ? <div className="canvas-selection-hint"><span>{selectedLayer.kind === "text" ? "Text layer" : "Image layer"}</span><strong>{selectedLayer.locked ? "Locked" : "Drag to move"}</strong><button type="button" onClick={() => setSelectedLayerId(null)} aria-label="Deselect layer"><X size={13} /></button></div> : null}
        </section>
      </div>
    </main>
  );
}
