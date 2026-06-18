/**
 * The whole Fundamental integration for this starter, in one file.
 *
 * Three surfaces, one recipe (priority-well):
 *   1. Declarative — importing '@fundamental-engine/elements' upgrades <field-root>, which scans the page for
 *      [data-body] elements. Nothing else to do.
 *   2. applyRecipe() — run a recipe over markup that already exists; it writes --field-* state back.
 *   3. bindData()    — records drive the field; updates diff by id, removed records decay out.
 *
 * A reduced-motion toggle re-runs (2) and (3) with the recipe's static fallback, and a per-frame
 * loop reads each handle's inspect() so you can watch the field's own accounting.
 */
import '@fundamental-engine/elements'; // side effect: registers <field-root>, <field-cell>, <field-field>
import { recipeById, compileRecipe } from '@fundamental-engine/core';
import { applyRecipe, bindData } from '@fundamental-engine/dom';

const RECIPE_ID = 'priority-well';
const recipe = recipeById(RECIPE_ID);
if (!recipe) throw new Error(`recipe "${RECIPE_ID}" not found`);

// Shared reduced-motion state. The toggle flips it and re-runs both runtime surfaces.
let reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 2 · applyRecipe over existing markup ──────────────────────────────────────────────────────
const applyRoot = document.getElementById('apply-tasks');
const applyInspect = document.getElementById('apply-inspect');
let applied: ReturnType<typeof applyRecipe> | null = null;

function runApply(): void {
  if (!applyRoot) return;
  applied?.destroy();
  const bodies = [...applyRoot.querySelectorAll<HTMLElement>('[data-body]')];
  // bodies already carry data-body + data-field-priority, so don't re-annotate them.
  applied = applyRecipe(applyRoot, recipe!, { bodies, annotateBodies: false, reducedMotion: reduced });
}

// ── 3 · bindData from records ─────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  priority: number;
}
let tasks: Task[] = [
  { id: 't-1', title: 'Define the field schema', priority: 0.9 },
  { id: 't-2', title: 'Wire the integrator', priority: 0.6 },
  { id: 't-3', title: 'Add the reduced-motion fallback', priority: 0.35 },
];
let nextId = 4;

const bindRoot = document.getElementById('bind-root');
const bindInspect = document.getElementById('bind-inspect');
let binding: ReturnType<typeof bindData<Task>> | null = null;

const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const tier = (p: number): string => (p >= 0.66 ? 'high' : p >= 0.33 ? 'medium' : 'low');

// The mapper owns the body tokens, metric values, and relationships — so the data drives the field.
const mapper = (t: Task) => ({
  id: t.id,
  body: { tokens: ['attract'], strength: 0.4 + t.priority, range: 300, feedback: true },
  metrics: { priority: t.priority }, // → data-field-priority → --field-priority (the recipe tracks it)
  label: t.title,
});
const content = (t: Task): string =>
  `<span class="t-title">${esc(t.title)}</span><span class="t-badge t-${tier(t.priority)}">${tier(t.priority)}</span>`;

function runBind(): void {
  if (!bindRoot) return;
  if (binding) {
    binding.update(tasks); // diff by id — keeps DOM, animates the change
  } else {
    binding = bindData(bindRoot, tasks, mapper, {
      recipe: RECIPE_ID,
      className: 'task',
      content,
      reducedMotion: reduced,
    });
  }
}
// A full rebuild is only needed when the reduced-motion mode changes (it reframes the recipe).
function rebindForMotion(): void {
  binding?.destroy();
  binding = null;
  runBind();
}

// ── reduced-motion toggle ─────────────────────────────────────────────────────────────────────
const reduceBtn = document.getElementById('reduce');
const rmNote = document.getElementById('rm-note');
function syncReduceUi(): void {
  if (reduceBtn) {
    reduceBtn.textContent = `Reduce motion: ${reduced ? 'on' : 'off'}`;
    reduceBtn.setAttribute('aria-pressed', String(reduced));
    reduceBtn.classList.toggle('on', reduced);
  }
  // Show the recipe's own static fallback description — the meaning that survives without motion.
  if (rmNote) rmNote.textContent = reduced ? `static: ${compileRecipe(recipe!).reducedMotion.reducedMotion}` : '';
}
reduceBtn?.addEventListener('click', () => {
  reduced = !reduced;
  syncReduceUi();
  runApply();
  rebindForMotion();
});

// ── bindData controls ─────────────────────────────────────────────────────────────────────────
const TITLES = ['Triage the backlog', 'Draft the proposal', 'Review the diff', 'Cut a release', 'Answer the issue'];
document.getElementById('bind-add')?.addEventListener('click', () => {
  const title = TITLES[(nextId - 1) % TITLES.length]!;
  tasks = [...tasks, { id: `t-${nextId++}`, title, priority: 0.2 + (nextId % 5) * 0.16 }];
  runBind();
});
document.getElementById('bind-remove')?.addEventListener('click', () => {
  tasks = tasks.slice(0, -1);
  runBind();
});
document.getElementById('bind-shuffle')?.addEventListener('click', () => {
  // deterministic reshuffle of priorities (no Math.random) — rotate each by a fixed step
  tasks = tasks.map((t, i) => ({ ...t, priority: ((t.priority + 0.27 + i * 0.11) % 1) }));
  runBind();
});

// ── live inspector readouts ───────────────────────────────────────────────────────────────────
function loop(): void {
  if (applied && applyInspect) {
    const i = applied.inspect();
    applyInspect.textContent = `inspect() · frame ${i.frame} · ${i.measurements} bodies · ${i.relationships} edges · lint ${i.lint || '✓'}`;
  }
  if (binding && bindInspect) {
    const i = binding.inspect();
    if (i) bindInspect.textContent = `inspect() · ${i.records} records · ${i.bodies} bodies · ${i.relationships} edges`;
  }
  requestAnimationFrame(loop);
}

syncReduceUi();
runApply();
runBind();
requestAnimationFrame(loop);
