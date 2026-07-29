export const TEMPLATE_CATEGORIES = ["All", "Trending", "Classic", "Reaction", "Animals", "Movies", "Favorites"];

export function slugifyTemplateName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function templateHref(template) {
  return `/templates/${slugifyTemplateName(template.name)}-${template.id}`;
}

export function templateIdFromSlug(slug) {
  if (/^(?:\d+|mg_[a-z0-9_-]+)$/i.test(slug)) return slug;
  return slug.match(/-(\d+|mg_[a-z0-9_-]+)$/i)?.[1] || null;
}
