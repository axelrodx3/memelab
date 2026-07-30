import { cache } from "react";

export const getTemplates = cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/template_assets?select=id,name,aliases,tags,description,category,image_url,width,height,box_count,rank,quality_score&order=rank.asc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) throw new Error("MemeLab template storage is unavailable.");

  const templates = await response.json();
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    aliases: template.aliases || [],
    tags: template.tags || [],
    description: template.description || "",
    category: template.category,
    url: template.image_url,
    width: template.width,
    height: template.height,
    boxCount: template.box_count,
    rank: template.rank,
    qualityScore: template.quality_score || 0
  }));
});
