export const TEMPLATE_CATEGORIES = [
  "All", "Trending", "Classic", "Reaction", "Animals", "Movies & TV",
  "Politics", "Gaming", "Workplace", "Multi-Panel", "Favorites"
];

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

function overlapScore(left = [], right = []) {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.reduce((score, value) => score + (rightSet.has(value.toLowerCase()) ? 1 : 0), 0);
}

export function getRelatedTemplates(template, templates, limit = 4) {
  return templates
    .filter((candidate) => candidate.id !== template.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.category === template.category) score += 12;
      score += overlapScore(template.tags, candidate.tags) * 5;
      if (candidate.boxCount === template.boxCount) score += 2;

      const templateRatio = template.width && template.height ? template.width / template.height : null;
      const candidateRatio = candidate.width && candidate.height ? candidate.width / candidate.height : null;
      if (templateRatio && candidateRatio && Math.abs(Math.log(templateRatio / candidateRatio)) < 0.18) score += 1;

      score += Math.max(0, 3 - Math.floor((candidate.rank || 999) / 100));
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.candidate.rank - right.candidate.rank)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
