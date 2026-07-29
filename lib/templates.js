import { cache } from "react";

const CLASSICS = [
  "drake", "distracted boyfriend", "two buttons", "change my mind",
  "expanding brain", "success kid", "one does not simply", "disaster girl",
  "ancient aliens", "doge", "this is fine", "always has been"
];

function categorize(name, aliases = []) {
  const value = `${name} ${aliases.join(" ")}`.toLowerCase();
  if (/(doge|cat|dog|monkey|bear|bird|animal|seal|rabbit)/.test(value)) return "Animals";
  if (/(movie|star wars|batman|spider|avengers|matrix|lord of the rings|gru|simpsons|futurama|jurassic|marvel|disney|pixar)/.test(value)) return "Movies";
  if (/(drake|reaction|surprised|laugh|cry|sad|angry|face|side eye|fine)/.test(value)) return "Reaction";
  if (CLASSICS.some((classic) => value.includes(classic))) return "Classic";
  return "Trending";
}

async function getImgflipTemplates() {
  const response = await fetch("https://api.imgflip.com/get_memes?type=image", {
    next: { revalidate: 3600 }
  });
  if (!response.ok) throw new Error("Popular template request failed");

  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error_message || "Popular template request failed");

  return payload.data.memes.map((meme) => ({
    id: String(meme.id),
    name: meme.name,
    url: `/api/image?asset=${encodeURIComponent(new URL(meme.url).pathname.replace(/^\/+/, ""))}`,
    width: meme.width,
    height: meme.height,
    boxCount: meme.box_count,
    aliases: [],
    category: categorize(meme.name)
  }));
}

async function getMemeGenTemplates() {
  const response = await fetch("https://api.memegen.link/templates/", {
    next: { revalidate: 21600 }
  });
  if (!response.ok) throw new Error("Archive template request failed");

  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Archive template response was invalid");

  const seenIds = new Set();
  return payload.flatMap((template) => {
    const sourceId = String(template.id || "").trim();
    const name = String(template.name || "").trim();
    if (!sourceId || !name || seenIds.has(sourceId) || typeof template.blank !== "string") return [];
    seenIds.add(sourceId);

    const aliases = Array.isArray(template.keywords)
      ? template.keywords.filter((keyword) => typeof keyword === "string")
      : [];
    let blankPath;
    try {
      blankPath = new URL(template.blank).pathname.replace(/^\/images\//, "");
    } catch {
      return [];
    }
    if (!/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(blankPath)) return [];

    return [{
      id: `mg_${sourceId}`,
      name,
      url: `/api/image?asset=${encodeURIComponent(`mg__${blankPath}`)}`,
      width: null,
      height: null,
      boxCount: Number(template.lines) || 2,
      aliases,
      category: categorize(name, aliases)
    }];
  });
}

function mergeTemplates(templateGroups) {
  const catalog = [];
  const byName = new Map();

  templateGroups.flat().forEach((template) => {
    const nameKey = template.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const existing = byName.get(nameKey);

    if (existing) {
      existing.aliases = [...new Set([...(existing.aliases || []), ...(template.aliases || [])])];
      return;
    }

    const next = { ...template, rank: catalog.length + 1 };
    byName.set(nameKey, next);
    catalog.push(next);
  });

  return catalog;
}

export const getTemplates = cache(async () => {
  const results = await Promise.allSettled([
    getImgflipTemplates(),
    getMemeGenTemplates()
  ]);

  const successfulGroups = results.flatMap((result) => (
    result.status === "fulfilled" ? [result.value] : []
  ));

  return mergeTemplates(successfulGroups);
});
