import { cache } from "react";

const CLASSICS = [
  "drake", "distracted boyfriend", "two buttons", "change my mind",
  "expanding brain", "success kid", "one does not simply", "disaster girl",
  "ancient aliens", "doge", "this is fine", "always has been"
];

function categorize(name) {
  const value = name.toLowerCase();
  if (/(doge|cat|dog|monkey|bear|bird|animal|seal|rabbit)/.test(value)) return "Animals";
  if (/(movie|star wars|batman|spider|avengers|matrix|lord of the rings|gru)/.test(value)) return "Movies";
  if (/(drake|reaction|surprised|laugh|cry|sad|angry|face|side eye|fine)/.test(value)) return "Reaction";
  if (CLASSICS.some((classic) => value.includes(classic))) return "Classic";
  return "Trending";
}

export const getTemplates = cache(async () => {
  try {
    const response = await fetch("https://api.imgflip.com/get_memes?type=image", {
      next: { revalidate: 3600 }
    });
    if (!response.ok) throw new Error("Template provider request failed");

    const payload = await response.json();
    if (!payload.success) throw new Error(payload.error_message || "Template provider request failed");

    return payload.data.memes.map((meme, index) => ({
      id: String(meme.id),
      name: meme.name,
      url: `/api/image?asset=${encodeURIComponent(new URL(meme.url).pathname.replace(/^\/+/, ""))}`,
      width: meme.width,
      height: meme.height,
      boxCount: meme.box_count,
      category: categorize(meme.name),
      rank: index + 1
    }));
  } catch {
    return [];
  }
});
