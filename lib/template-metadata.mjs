const CLASSIC_TERMS = [
  "drake", "distracted boyfriend", "two buttons", "change my mind",
  "expanding brain", "success kid", "one does not simply", "disaster girl",
  "ancient aliens", "doge", "this is fine", "always has been", "bad luck brian",
  "philosoraptor", "futurama fry", "y u no", "overly attached girlfriend"
];

const CANONICAL_OVERRIDES = new Map([
  ["mg_aag", {
    name: "Ancient Aliens",
    aliases: ["Ancient Aliens Guy", "History Channel Aliens"]
  }],
  ["mg_headaches", {
    name: "Types of Headaches",
    aliases: ["Types of Headaches Meme"]
  }],
  ["322841258", {
    name: "Anakin and Padmé Four-Panel",
    aliases: ["Anakin Padme 4 Panel", "For the Better, Right?"]
  }],
  ["371619279", {
    name: "Megamind No Bitches",
    aliases: ["Megamind Peeking"]
  }],
  ["50421420", {
    name: "Disappointed Black Guy",
    aliases: ["Expectation vs. Reality"]
  }],
  ["mg_grave", {
    name: "Grant Gustin Over Grave",
    aliases: ["Grant Gustin Next to Oliver Queen's Grave"]
  }],
  ["224015000", {
    name: "Bernie Sanders Once Again Asking",
    aliases: ["Bernie I Am Once Again Asking for Your Support"]
  }],
  ["29562797", {
    name: "I'm the Captain Now",
    aliases: ["Look at Me"]
  }]
]);

const TAG_RULES = [
  ["politics", /(bernie|biden|trump|obama|politic|president|congress|election|putin|bush|government)/],
  ["gaming", /(gaming|gamer|video game|playstation|xbox|nintendo|minecraft|fortnite|zelda|pokemon|skyrim)/],
  ["work", /(office|work|business|meeting|boss|employee|corporate|resume|job|coworker|presentation)/],
  ["school", /(school|student|teacher|class|exam|homework|college|university|graduation)/],
  ["anime", /(anime|manga|naruto|dragon ball|one piece|jojo)/],
  ["superhero", /(batman|spider|avengers|marvel|superman|joker|wonder woman|iron man)/],
  ["star-wars", /(star wars|anakin|padm[eé]|obi.?wan|yoda|darth|mandalorian)/],
  ["spongebob", /(spongebob|patrick|squidward|krabs)/],
  ["simpsons", /(simpsons|homer|bart|lisa|ralph wiggum)/],
  ["dog", /(doge|dog|cheems|shiba|puppy)/],
  ["cat", /(cat|kitten|grumpy cat|bongo)/],
  ["reaction", /(reaction|surprised|laugh|cry|sad|angry|face|side eye|disappointed|confused|smile|stare)/],
  ["wholesome", /(wholesome|happy|proud|success|awesome|good news)/],
  ["dark-humor", /(grave|skeleton|death|disaster|pain|funeral)/]
];

function searchableText(template) {
  return `${template.name || ""} ${(template.aliases || []).join(" ")}`.toLowerCase();
}

export function canonicalizeTemplate(template) {
  const override = CANONICAL_OVERRIDES.get(String(template.id));
  if (!override) {
    return {
      ...template,
      aliases: [...new Set((template.aliases || []).filter(Boolean))]
    };
  }

  return {
    ...template,
    name: override.name,
    aliases: [...new Set([
      ...(template.aliases || []),
      template.name,
      ...override.aliases
    ].filter((value) => value && value.toLowerCase() !== override.name.toLowerCase()))]
  };
}

export function categorizeTemplate(template) {
  const value = searchableText(template);
  if (/(bernie|biden|trump|obama|politic|president|congress|election|putin|bush|government)/.test(value)) return "Politics";
  if (/(gaming|gamer|video game|playstation|xbox|nintendo|minecraft|fortnite|zelda|pokemon|skyrim)/.test(value)) return "Gaming";
  if (/(office|work|business|meeting|boss|employee|corporate|resume|job|coworker|presentation)/.test(value)) return "Workplace";
  if (/(doge|cat|dog|monkey|bear|bird|animal|seal|rabbit|penguin|cheems|frog|horse)/.test(value)) return "Animals";
  if (/(movie|star wars|batman|spider|avengers|matrix|lord of the rings|gru|simpsons|futurama|jurassic|marvel|disney|pixar|spongebob|tv|netflix|anime)/.test(value)) return "Movies & TV";
  if ((template.boxCount || 0) >= 3 || /(panel|chart|grid|comparison|expanding brain|trade offer|bell curve)/.test(value)) return "Multi-Panel";
  if (CLASSIC_TERMS.some((classic) => value.includes(classic))) return "Classic";
  if (/(reaction|surprised|laugh|cry|sad|angry|face|side eye|fine|disappointed|confused|stare|smile)/.test(value)) return "Reaction";
  return Number(template.rank || 999) <= 36 ? "Trending" : "Classic";
}

export function tagsForTemplate(template) {
  const canonical = canonicalizeTemplate(template);
  const value = searchableText(canonical);
  const tags = new Set();
  const category = categorizeTemplate(canonical);

  tags.add(category.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  if (CLASSIC_TERMS.some((classic) => value.includes(classic))) tags.add("classic");
  if (Number(canonical.rank || 999) <= 36) tags.add("popular");

  const boxCount = Number(canonical.boxCount ?? canonical.box_count ?? 2);
  if (boxCount >= 4) tags.add("four-panel");
  else if (boxCount === 3) tags.add("three-panel");
  else if (boxCount === 2) tags.add("two-panel");
  else tags.add("single-panel");

  const width = Number(canonical.width || 0);
  const height = Number(canonical.height || 0);
  if (width && height) {
    const ratio = width / height;
    tags.add(ratio > 1.18 ? "landscape" : ratio < 0.82 ? "portrait" : "square");
  }

  for (const [tag, pattern] of TAG_RULES) {
    if (pattern.test(value)) tags.add(tag);
  }

  return [...tags];
}

export function describeTemplate(template) {
  const canonical = canonicalizeTemplate(template);
  const category = categorizeTemplate(canonical).toLowerCase();
  const boxes = Number(canonical.boxCount ?? canonical.box_count ?? 2);
  const format = boxes > 1 ? `${boxes}-caption` : "single-caption";
  return `A ${category} ${format} meme template ready for captions, characters, and logos.`;
}

