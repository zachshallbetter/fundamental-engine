// Generate the "project atoms" — one record per real piece of field-ui (forces, recipes, presets,
// metrics, truth modes, natural fields, packages). Bound to the home field's particles so every dot
// IS a piece of the project. Richness varies on purpose (a force knows a lot about itself; a metric
// is a one-liner) → each atom's `weight` (0..1) drives its particle's mass/size. Regenerate with
// `pnpm gen:atoms`; it auto-tracks the catalog (35 forces today, 36 tomorrow).
import { readFileSync } from "node:fs";
import { MANUAL_FORCES, MANUAL_PRESETS } from "../packages/core/dist/index.js";

const recipes = JSON.parse(readFileSync(new URL("../data/recipes.json", import.meta.url), "utf8"));
const recipeList = Array.isArray(recipes) ? recipes : recipes.recipes || Object.values(recipes).flat();

const NF_COLOR = { gravity: "#6366f1", electromagnetic: "#60a5fa", strong: "#34d399", weak: "#e879f9" };
const KIND_COLOR = {
  recipe: "#2dd4bf", preset: "#fbbf24", metric: "#a78bfa",
  "truth-mode": "#ff9d5c", "natural-field": "#86e57f", package: "#38bdf8",
};

// weight = how much this atom knows about itself (filled fields), normalised → particle mass.
const richness = (data) => {
  const filled = Object.values(data).filter((v) => v != null && v !== "" && (!Array.isArray(v) || v.length)).length;
  return Math.max(0.12, Math.min(1, filled / 8));
};
const atom = (kind, id, label, color, href, data) => ({ kind, id, label, color, href, weight: +richness(data).toFixed(3), data });

const atoms = [
  // 35 forces — the richest atoms.
  ...MANUAL_FORCES.map((f) =>
    atom("force", `force:${f.token}`, f.label, f.color || "#4da3ff", `/docs/forces#${f.token}`, {
      token: f.token, family: f.family, formula: f.formula, desc: f.desc,
      summary: f.summary, effect: f.effect, example: f.example, symbol: f.symbol,
    }),
  ),
  // 64 recipes — medium.
  ...recipeList.map((r) =>
    atom("recipe", `recipe:${r.id}`, r.name || r.id, NF_COLOR[r.naturalField] || KIND_COLOR.recipe, `/recipes/${r.id}`, {
      intent: r.intent, naturalField: r.naturalField, tier: r.tier, primitives: r.primitives,
    }),
  ),
  // 8 presets.
  ...MANUAL_PRESETS.map((p) =>
    atom("preset", `preset:${p.token ?? p.name}`, p.label || p.name, KIND_COLOR.preset, "/docs/presets", {
      name: p.token ?? p.name, desc: p.desc, bodies: p.bodies?.length,
    }),
  ),
  // the metric vocabulary — light (one-liners).
  ...[
    ["density", "how much matter has gathered on a body"],
    ["attention", "the body's share of the page's finite focus"],
    ["memory", "weight retained after matter leaves (hysteresis)"],
    ["pressure", "crowding — local density gradient against a body"],
    ["entropy", "disorder of the local field (calm ↔ chaotic)"],
    ["coherence", "how aligned a body's neighbourhood is"],
    ["confidence", "support a body has accreted (the evidence metric)"],
    ["heat", "agitation energy in nearby matter"],
    ["path-use", "how travelled the lanes through a body are"],
    ["related-attention", "focus reflected from threaded neighbours"],
  ].map(([m, measures]) =>
    atom("metric", `metric:--field-${m}`, `--field-${m}`, KIND_COLOR.metric, "/docs/api/metrics", { var: `--field-${m}`, measures }),
  ),
  // the six truth modes.
  ...[
    ["physical", "real simulation; count-conserved"],
    ["designed", "a bounded UI verb, not nature"],
    ["hybrid", "physical measure → designed output"],
    ["diagnostic", "a visualization of field structure"],
    ["poetic", "evocative, not literal"],
    ["semantic", "meaning mapped to behaviour"],
  ].map(([mode, gloss]) => atom("truth-mode", `truth:${mode}`, mode, KIND_COLOR["truth-mode"], "/docs", { mode, gloss })),
  // the four natural fields.
  ...[
    ["gravity", "importance"], ["electromagnetic", "polarity / signal"],
    ["strong", "binding"], ["weak", "transformation"],
  ].map(([field, maps]) => atom("natural-field", `nf:${field}`, field, NF_COLOR[field] || "#86e57f", "/docs/natural-fields", { field, maps })),
  // the published packages.
  ...[
    ["@field-ui/core", "the renderer-agnostic engine"],
    ["@field-ui/platform", "binds the engine to the DOM"],
    ["@field-ui/elements", "the <field-root> / <field-cell> elements"],
    ["@field-ui/react", "the React adapter"],
    ["@field-ui/vanilla", "the framework-free door"],
  ].map(([name, role]) => atom("package", `pkg:${name}`, name, KIND_COLOR.package, "/docs", { name, role })),
];

const byKind = atoms.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {});
process.stderr.write(`  ${atoms.length} atoms — ${JSON.stringify(byKind)}\n`);
process.stdout.write(JSON.stringify({ generated: "pnpm gen:atoms", count: atoms.length, atoms }, null, 2) + "\n");
