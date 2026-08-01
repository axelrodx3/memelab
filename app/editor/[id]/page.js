"use client";

import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp,
  Check, Cloud, Copy, Download, Eye, EyeOff, FolderKanban, ImagePlus,
  Layers3, LoaderCircle, Lock, Redo2, RotateCcw, Sparkles, Trash2, Type,
  Undo2, Unlock, Upload, X
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { loadCustomBase } from "../../../lib/custom-base";

const MAX_TEXT = 500;
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_OUTLINE_COLOR = "#000000";

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
    opacity: 1,
    rotation: 0,
    visible: true,
    locked: false
  };
}

function createImageLayer({ id = makeId("image"), src = null, name = "Image", assetPath = null } = {}) {
  return {
    id,
    kind: "image",
    name,
    src,
    assetPath,
    x: 50,
    y: 55,
    width: 30,
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
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function normalizeLayer(layer, index) {
  const kind = layer?.kind === "image" ? "image" : "text";
  const base = kind === "image" ? createImageLayer({ id: layer?.id || makeId("image"), name: layer?.name || "Image", src: layer?.src || null, assetPath: layer?.assetPath || null }) : createTextLayer({ id: layer?.id || makeId("text"), text: typeof layer?.text === "string" ? layer.text : "NEW TEXT" });
  return {
    ...base,
    ...layer,
    id: layer?.id || base.id,
    kind,
    x: normalizeNumber(layer?.x, base.x, 0, 100),
    y: normalizeNumber(layer?.y, base.y, 0, 100),
    width: normalizeNumber(layer?.width, base.width, 8, 100),
    opacity: normalizeNumber(layer?.opacity, 1, 0, 1),
    rotation: normalizeNumber(layer?.rotation, 0, -180, 180),
    visible: layer?.visible !== false,
    locked: layer?.locked === true,
    ...(kind === "text" ? {
      text: typeof layer?.text === "string" ? layer.text.slice(0, MAX_TEXT) : base.text,
      fontSize: normalizeNumber(layer?.fontSize, base.fontSize, 12, 150),
      fontFamily: typeof layer?.fontFamily === "string" ? layer.fontFamily : base.fontFamily,
      fontWeight: normalizeNumber(layer?.fontWeight, base.fontWeight, 400, 900),
      textColor: /^#[0-9a-f]{6}$/i.test(layer?.textColor || "") ? layer.textColor : base.textColor,
      outlineColor: /^#[0-9a-f]{6}$/i.test(layer?.outlineColor || "") ? layer.outlineColor : base.outlineColor,
      outlineWidth: normalizeNumber(layer?.outlineWidth, base.outlineWidth, 0, 24),
      align: ["left", "center", "right"].includes(layer?.align) ? layer.align : base.align
    } : {})
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

function textBounds(context, layer, width, height) {
  const size = Math.max(10, Math.round(layer.fontSize * (width / 600)));
  const maxWidth = width * (layer.width / 100);
  context.font = `${layer.fontWeight} ${size}px ${layer.fontFamily}, Arial, sans-serif`;
  const lines = wrapText(context, layer.text.toUpperCase(), maxWidth);
  const lineHeight = size * 1.04;
  return { size, maxWidth, lines, lineHeight, boxWidth: maxWidth, boxHeight: Math.max(lineHeight, lines.length * lineHeight) };
}

function drawTextLayer(context, layer, width, height) {
  if (!layer.text.trim()) return null;
  const metrics = textBounds(context, layer, width, height);
  const centerX = width * (layer.x / 100);
  const centerY = height * (layer.y / 100);
  const left = centerX - metrics.boxWidth / 2;
  const top = centerY - metrics.boxHeight / 2;
  const textX = layer.align === "left" ? left : layer.align === "right" ? left + metrics.boxWidth : centerX;
  context.save();
  context.globalAlpha = layer.opacity;
  context.translate(centerX, centerY);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);
  context.font = `${layer.fontWeight} ${metrics.size}px ${layer.fontFamily}, Arial, sans-serif`;
  context.textAlign = layer.align;
  context.textBaseline = "top";
  context.lineJoin = "round";
  context.strokeStyle = layer.outlineColor;
  context.lineWidth = Math.max(0, layer.outlineWidth * (width / 600));
  context.fillStyle = layer.textColor;
  metrics.lines.forEach((line, index) => {
    const lineY = top + index * metrics.lineHeight;
    if (context.lineWidth > 0) context.strokeText(line, textX, lineY, metrics.maxWidth);
    context.fillText(line, textX, lineY, metrics.maxWidth);
  });
  context.restore();
  return { x: left, y: top, width: metrics.boxWidth, height: metrics.boxHeight };
}

export default function MemeEditor() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const editedRef = useRef(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const editVersionRef = useRef(0);
  const layersRef = useRef([]);
  const layerBoundsRef = useRef(new Map());
  const imageCacheRef = useRef(new Map());
  const pointerRef = useRef(null);
  const historyRef = useRef({ entries: [], index: -1 });
  const [template, setTemplate] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled meme");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading…");
  const [saveError, setSaveError] = useState("");
  const [rendered, setRendered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

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
      version: 2,
      topText: textLayers[0]?.text || "",
      bottomText: textLayers[1]?.text || "",
      layers: serializableLayers
    };
  }, []);

  const saveProject = useCallback(async () => {
    if (!ready || !editedRef.current) return;
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
    image.src = source;
    await image.decode();
    imageCacheRef.current.set(source, image);
    return image;
  }, []);

  const drawScene = useCallback(async (context, width, height, showSelection = true) => {
    if (!template) return;
    const base = await loadImage(template.url);
    if (!base) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
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
      const imageWidth = width * (layer.width / 100);
      const imageHeight = imageWidth * (image.naturalHeight / image.naturalWidth);
      const centerX = width * (layer.x / 100);
      const centerY = height * (layer.y / 100);
      context.save();
      context.globalAlpha = layer.opacity;
      context.translate(centerX, centerY);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
      context.restore();
      bounds.set(layer.id, { x: centerX - imageWidth / 2, y: centerY - imageHeight / 2, width: imageWidth, height: imageHeight });
    }
    layerBoundsRef.current = bounds;
    if (showSelection && selectedLayerId && bounds.has(selectedLayerId)) {
      const box = bounds.get(selectedLayerId);
      context.save();
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
    const scale = Math.min(1, 1100 / base.naturalWidth);
    canvas.width = Math.max(1, Math.round(base.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(base.naturalHeight * scale));
    await drawScene(canvas.getContext("2d"), canvas.width, canvas.height, showSelection);
    setRendered(true);
  }, [drawScene, loadImage, template]);

  useEffect(() => {
    setRendered(false);
    renderCanvas().catch(() => setRendered(false));
  }, [renderCanvas, layers, selectedLayerId]);

  const addTextLayer = () => {
    const layer = createTextLayer({ text: "NEW TEXT", y: 50 });
    setLayerState([...layersRef.current, layer]);
    setSelectedLayerId(layer.id);
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
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const layer = createImageLayer({ src: dataUrl, name: file.name });
      setLayerState([...layersRef.current, layer]);
      setSelectedLayerId(layer.id);
      if (viewer && id !== "custom") {
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${viewer.id}/${makeId("asset")}.${extension}`;
        const supabase = createClient();
        const { error } = await supabase.storage.from("project-assets").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        updateLayer(layer.id, { assetPath: path });
      }
    } catch (error) {
      setSaveError(error.message || "That image could not be added to the canvas.");
    } finally {
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
    const duplicate = { ...selectedLayer, id: makeId(selectedLayer.kind), x: Math.min(92, selectedLayer.x + 4), y: Math.min(92, selectedLayer.y + 4), name: selectedLayer.kind === "image" ? `${selectedLayer.name || "Image"} copy` : undefined };
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
    const nextX = Math.min(100, Math.max(0, pointer.x + ((point.x - pointer.startX) / canvasRef.current.width) * 100));
    const nextY = Math.min(100, Math.max(0, pointer.y + ((point.y - pointer.startY) / canvasRef.current.height) * 100));
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if (event.key === "Escape") setSelectedLayerId(null);
      if ((event.key === "Backspace" || event.key === "Delete") && selectedLayer && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const resetEditor = () => {
    const next = defaultLayers();
    setLayerState(next);
    setSelectedLayerId(next[0].id);
  };

  const download = async () => {
    if (!template || !canvasRef.current) return;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasRef.current.width;
    exportCanvas.height = canvasRef.current.height;
    await drawScene(exportCanvas.getContext("2d"), exportCanvas.width, exportCanvas.height, false);
    const link = document.createElement("a");
    link.download = `memelab-${template.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "meme"}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const StatusIcon = saveStatus === "Saving…" ? LoaderCircle : saveStatus.startsWith("Saved") ? Check : Cloud;
  const history = historyRef.current;
  const canUndo = history.index > 0;
  const canRedo = history.index >= 0 && history.index < history.entries.length - 1;

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/studio" className="editor-back"><ArrowLeft size={18} /> MemeLab Studio</Link>
        <div className="editor-project-status" title={saveError || saveStatus}><StatusIcon size={13} className={saveStatus === "Saving…" ? "spin" : ""} /><span>{saveError || saveStatus}</span></div>
        <div className="editor-header-actions">
          <button type="button" className="editor-icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
          <button type="button" className="editor-icon-button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
          <Link href="/projects"><FolderKanban size={16} /> Projects</Link>
          <button type="button" onClick={download} disabled={!rendered}><Download size={17} /> Export PNG</button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-panel">
          <div className="editor-title">
            <span>MEMELAB STUDIO</span>
            <input className="project-name-input" value={projectName} maxLength={80} aria-label="Project name" onChange={(event) => { markEdited(); setProjectName(event.target.value); }} />
            <p>{template?.name || "Loading template…"}</p>
          </div>

          <section className="control-section editor-add-section">
            <div className="control-heading"><Sparkles size={16} /> Add to canvas</div>
            <div className="editor-add-grid">
              <button type="button" onClick={addTextLayer}><Type size={16} /> Text</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus size={16} /> Image</button>
            </div>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} />
          </section>

          <section className="control-section editor-layers-section">
            <div className="control-heading"><Layers3 size={16} /> Layers <span>{layers.length}</span></div>
            <div className="editor-layer-list">
              {[...layers].reverse().map((layer) => (
                <button type="button" className={`editor-layer-row${selectedLayerId === layer.id ? " selected" : ""}`} key={layer.id} onClick={() => setSelectedLayerId(layer.id)}>
                  <span className="editor-layer-kind">{layer.kind === "text" ? <Type size={13} /> : <ImagePlus size={13} />}</span>
                  <span className="editor-layer-name">{layer.kind === "text" ? (layer.text || "Empty text") : (layer.name || "Image")}</span>
                  <span className="editor-layer-state">{layer.locked ? <Lock size={12} /> : layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}</span>
                </button>
              ))}
              {!layers.length && <p className="editor-no-layers">Add text or an image to begin.</p>}
            </div>
          </section>

          {selectedLayer && <section className="control-section editor-properties-section">
            <div className="control-heading"><Layers3 size={16} /> Selected layer</div>
            <div className="editor-layer-actions">
              <button type="button" onClick={() => updateLayer(selectedLayer.id, { visible: !selectedLayer.visible })}>{selectedLayer.visible ? <EyeOff size={14} /> : <Eye size={14} />} {selectedLayer.visible ? "Hide" : "Show"}</button>
              <button type="button" onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}>{selectedLayer.locked ? <Unlock size={14} /> : <Lock size={14} />} {selectedLayer.locked ? "Unlock" : "Lock"}</button>
              <button type="button" onClick={duplicateSelected}><Copy size={14} /> Duplicate</button>
              <button type="button" onClick={removeSelected} disabled={selectedLayer.locked}><Trash2 size={14} /> Delete</button>
            </div>
            <div className="editor-layer-actions compact">
              <button type="button" onClick={() => moveSelected("up")}><ArrowUp size={13} /> Forward</button>
              <button type="button" onClick={() => moveSelected("down")}><ArrowDown size={13} /> Back</button>
            </div>

            {selectedLayer.kind === "text" && <>
              <label>Text<textarea value={selectedLayer.text} maxLength={MAX_TEXT} rows={3} onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })} /></label>
              <label>Font<select value={selectedLayer.fontFamily} onChange={(event) => updateLayer(selectedLayer.id, { fontFamily: event.target.value })}><option value="Impact">Impact</option><option value="Arial Black">Arial Black</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Courier New">Courier New</option></select></label>
              <div className="control-row"><label>Size<input type="range" min="12" max="150" value={selectedLayer.fontSize} onChange={(event) => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) })} /></label><output>{selectedLayer.fontSize}</output></div>
              <div className="control-row"><label>Outline<input type="range" min="0" max="24" value={selectedLayer.outlineWidth} onChange={(event) => updateLayer(selectedLayer.id, { outlineWidth: Number(event.target.value) })} /></label><output>{selectedLayer.outlineWidth}</output></div>
              <div className="editor-style-grid"><label>Fill<input type="color" value={selectedLayer.textColor} onChange={(event) => updateLayer(selectedLayer.id, { textColor: event.target.value })} /></label><label>Outline<input type="color" value={selectedLayer.outlineColor} onChange={(event) => updateLayer(selectedLayer.id, { outlineColor: event.target.value })} /></label></div>
              <div className="editor-align-buttons"><button type="button" className={selectedLayer.align === "left" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "left" })} aria-label="Align left"><AlignLeft size={14} /></button><button type="button" className={selectedLayer.align === "center" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "center" })} aria-label="Align center"><AlignCenter size={14} /></button><button type="button" className={selectedLayer.align === "right" ? "active" : ""} onClick={() => updateLayer(selectedLayer.id, { align: "right" })} aria-label="Align right"><AlignRight size={14} /></button></div>
            </>}

            <div className="editor-transform-grid"><label>Horizontal<input type="range" min="0" max="100" value={selectedLayer.x} onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.target.value) })} /></label><label>Vertical<input type="range" min="0" max="100" value={selectedLayer.y} onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.target.value) })} /></label><label>{selectedLayer.kind === "text" ? "Text width" : "Image size"}<input type="range" min="8" max="100" value={selectedLayer.width} onChange={(event) => updateLayer(selectedLayer.id, { width: Number(event.target.value) })} /></label><label>Rotation<input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(event) => updateLayer(selectedLayer.id, { rotation: Number(event.target.value) })} /></label><label>Opacity<input type="range" min="0" max="1" step=".05" value={selectedLayer.opacity} onChange={(event) => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) })} /></label></div>
          </section>}

          {!viewer || id === "custom" ? <div className="editor-sync-callout"><Cloud size={15} /><span><strong>Private to this device</strong>Sign in to sync projects across devices.</span></div> : <div className="editor-sync-callout"><Cloud size={15} /><span><strong>Autosave is on</strong>Your editable layers stay private to your account.</span></div>}
          <button type="button" className="reset-editor" onClick={resetEditor}><RotateCcw size={15} /> Reset canvas</button>
        </aside>

        <section className="canvas-workspace">
          <div className="workspace-pill"><Sparkles size={13} /> Drag any unlocked layer to position it</div>
          <div className="canvas-shell">
            {!template && <div className="canvas-loading">Loading template…</div>}
            <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="MemeLab editable canvas" />
          </div>
          {selectedLayer && <div className="canvas-selection-hint"><span>{selectedLayer.kind === "text" ? "Text layer" : "Image layer"}</span><strong>{selectedLayer.locked ? "Locked" : "Drag to move"}</strong><button type="button" onClick={() => setSelectedLayerId(null)} aria-label="Deselect layer"><X size={13} /></button></div>}
        </section>
      </div>
    </main>
  );
}
