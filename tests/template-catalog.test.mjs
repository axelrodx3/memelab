import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeTemplate,
  categorizeTemplate,
  tagsForTemplate
} from "../lib/template-metadata.mjs";
import { getRelatedTemplates } from "../lib/template-utils.js";

test("canonical metadata keeps alternate duplicate names searchable", () => {
  const template = canonicalizeTemplate({
    id: "224015000",
    name: "Bernie Sanders Once Again Asking",
    aliases: []
  });

  assert.equal(template.name, "Bernie Sanders Once Again Asking");
  assert.ok(template.aliases.includes("Bernie I Am Once Again Asking for Your Support"));
  assert.equal(categorizeTemplate(template), "Politics");
  assert.ok(tagsForTemplate({ ...template, boxCount: 2, rank: 20 }).includes("politics"));
});

test("related templates favor shared category and semantic tags", () => {
  const selected = {
    id: "a", category: "Politics", tags: ["politics", "reaction", "two-panel"],
    boxCount: 2, width: 600, height: 400, rank: 50
  };
  const templates = [
    selected,
    {
      id: "strong", category: "Politics", tags: ["politics", "reaction", "two-panel"],
      boxCount: 2, width: 1200, height: 800, rank: 80
    },
    {
      id: "popular-but-unrelated", category: "Animals", tags: ["animal", "single-panel"],
      boxCount: 1, width: 500, height: 500, rank: 1
    }
  ];

  assert.equal(getRelatedTemplates(selected, templates, 1)[0].id, "strong");
});

