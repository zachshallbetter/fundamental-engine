// AI Evidence runtime — the flagship "substrate, not particles" demo.
//
// Two things happen here, over ONE field:
//   1. The evidence graph is built as a real core field: each claim and source is an addBody()
//      body, each citation is an addEdge() relationship. Support → cohesion, confidence → mass,
//      contradiction → charge, staleness → decay. The field runs renderless (render: 'none') —
//      invisible, exactly like the rest of the example family.
//   2. The SAME field is exposed as AGENT-READABLE DATA. We register an agent-json projection and
//      render field.query() into the JSON panel on a calm cadence — an agent reads the field's
//      structured state (bodies, metrics, relationships) instead of scraping the DOM.
//
// Reduced motion / field-off: the field still exists and is still queried, but the panel settles
// to a single reading rather than ticking — the meaning survives without animation.
import { createField } from "@fundamental-engine/vanilla";
import { agentJsonProjection, agentJsonTarget } from "@fundamental-engine/core";
import type { BodyHandle, FieldHandle } from "@fundamental-engine/core";
import { pageRuntime } from "../lib/page-runtime.ts";

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const CADENCE_MS = 900; // calm refresh of the JSON panel

function initAiEvidence(page: HTMLElement): () => void {
  const list = page.querySelector<HTMLElement>("[data-ai-list]");
  const jsonEl = page.querySelector<HTMLElement>("[data-ai-json]");
  const statusEl = page.querySelector<HTMLElement>("[data-ai-status]");
  if (!list || !jsonEl) return () => {};

  // A canvas we own for the contained field. render: 'none' → invisible; we never draw it, but the
  // sim + query surface run headless. Kept out of the tree visually (0×0, aria-hidden).
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;opacity:0;";
  list.appendChild(canvas);

  let field: FieldHandle | null = null;
  let timer: number | undefined;
  const target = agentJsonTarget();

  const rectOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const base = list.getBoundingClientRect();
    return { left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height };
  };

  const bodyEls = [...list.querySelectorAll<HTMLElement>("[data-body]")];
  const handles = new Map<string, BodyHandle>();

  try {
    field = createField(canvas, { bounds: list, render: "none" });

    // Each claim / source → a body. Tokens come from data-body; strength from data-strength;
    // range from data-range. contradicts-claims carry `charge` (polarity); everyone else pulls.
    for (const el of bodyEls) {
      if (!el.id) continue;
      const tokens = (el.dataset.body ?? "cohesion").trim();
      const strength = Number(el.dataset.strength) || 0.5;
      const range = Number(el.dataset.range) || 160;
      const h = field.addBody({
        tokens,
        strength,
        range,
        data: {
          id: el.id,
          role: el.dataset.stance ? "claim" : "source",
          stance: el.dataset.stance,
          kind: el.dataset.kind,
          confidence: el.dataset.confidence ? Number(el.dataset.confidence) : undefined,
          weight: el.dataset.weight ? Number(el.dataset.weight) : undefined,
          decay: el.dataset.decay ? Number(el.dataset.decay) : undefined,
          year: el.dataset.year ? Number(el.dataset.year) : undefined,
        },
        rect: () => rectOf(el),
      });
      handles.set(el.id, h);
    }

    // Citation edges → relationships (support binds a claim to its sources).
    for (const el of bodyEls) {
      const from = el.id && handles.get(el.id);
      if (!from) continue;
      for (const rel of el.querySelectorAll<HTMLElement>("[data-field-relation]")) {
        const targetSel = rel.dataset.fieldTarget ?? "";
        const toId = targetSel.replace(/^#/, "");
        const to = handles.get(toId);
        if (to) field.addEdge(from, to, { type: rel.dataset.fieldRelation ?? "cites", strength: 0.6 });
      }
    }

    // The agent-json projection: field state → a serializable reading an agent consumes.
    field.projections.register(
      agentJsonProjection("agent", ["density", "attention", "coherence"], {
        label: "Evidence field · agent view",
        accessibilityEquivalent: "structured JSON readout of the evidence field",
      }),
    );
    field.projections.bind("agent", target, () => field!.query().metrics as Record<string, number>);
  } catch {
    field = null;
  }

  // Render field.query() into the JSON panel — the flagship payload: metrics + per-body readings +
  // citation relationships, the whole evidence graph as structured data.
  const fieldOn = () => page.dataset.field !== "off";
  const paint = () => {
    if (!field) {
      jsonEl.textContent = JSON.stringify({ field: "unavailable" }, null, 2);
      return;
    }
    const on = fieldOn();
    statusEl?.setAttribute("data-on", on ? "true" : "false");
    const q = field.query({ include: ["bodies", "metrics", "relationships"] });
    const payload = {
      frame: q.frame,
      fieldEnabled: on,
      metrics: round(q.metrics),
      projections: q.projections.map((p) => ({ id: p.id, surfaces: p.surfaces })),
      bodies: q.bodies.map((b) => ({
        id: b.id,
        role: (b as { data?: { role?: string } }).data?.role,
        tokens: b.tokens,
        metrics: round(b.metrics),
      })),
      relationships: q.relationships.map((r) => ({
        from: r.from,
        to: r.to,
        type: r.type,
        strength: Number(r.strength.toFixed(3)),
        active: r.active,
      })),
    };
    jsonEl.textContent = JSON.stringify(payload, null, 2);
  };

  const round = (m: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) out[k] = Number(v.toFixed(3));
    return out;
  };

  // First paint after a beat so the field has measured at least one frame.
  const boot = window.setTimeout(paint, 350);
  if (!reduceMotion()) timer = window.setInterval(paint, CADENCE_MS);

  return () => {
    window.clearTimeout(boot);
    if (timer !== undefined) window.clearInterval(timer);
    field?.destroy();
    field = null;
    canvas.remove();
  };
}

pageRuntime(".ex-ai-evidence", initAiEvidence);
