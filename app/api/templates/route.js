import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    const response = await fetch("https://api.imgflip.com/get_memes?type=image", {
      next: { revalidate: 3600 }
    });
    if (!response.ok) throw new Error("Imgflip request failed");
    const payload = await response.json();
    if (!payload.success) throw new Error(payload.error_message || "Imgflip request failed");

    const templates = payload.data.memes.map((meme) => ({
      id: String(meme.id),
      name: meme.name,
      url: meme.url,
      width: meme.width,
      height: meme.height,
      boxCount: meme.box_count,
      category: categorize(meme.name),
      sourceUrl: `https://imgflip.com/memetemplate/${meme.id}`
    }));

    return NextResponse.json({ templates }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
    });
  } catch {
    return NextResponse.json({ templates: [], error: "Templates are temporarily unavailable." }, { status: 502 });
  }
}
