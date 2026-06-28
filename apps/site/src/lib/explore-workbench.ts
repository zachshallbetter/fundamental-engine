// explore-workbench.ts — the visualization workbench inside the expanded detail preview.
//
// The teaching surface: it turns the engine's legibility layers into interactive controls so a
// visitor can SEE the machinery. Two tiers, mirroring the engine's own surface model:
//   • SUBSTRATE (field.setRender) — the base layer, ONE at a time. The same matter, drawn eight ways:
//     dots / trails / links / streamlines / metaballs / voronoi / field-lines / heatmap.
//   • OVERLAY (field.setOverlay) — diagnostic readings drawn ON TOP, ADDITIVE: toggle any combination
//     of force-vectors / grid / temperature / energy / path / data. These stack (the engine takes an
//     array), so they are true toggles, not a selector.
//   • live signal readout — the CSS variables the engine writes onto the feedback body every frame
//     (--d / --field-attention / --coherence / …) + the particle count. The conversion moment.
//
// The substrate is a base layer so it is pick-one; the overlays genuinely compose, so they toggle.

interface FieldLike {
  setRender(mode: string): void;
  setOverlay(mode: string | string[]): void;
  particleCount(): number;
}

export interface WorkbenchOptions {
  container: HTMLElement;
  field: FieldLike;
  /** whether an overlay surface (second canvas) is wired — gates the overlay tier */
  hasOverlay: boolean;
  /** the gathering body the engine writes its live feedback vars onto (--d, --coherence, …) */
  feedbackEl: HTMLElement | null;
  /** the recipe's render layers (catalog order) — used to mark the recipe's NATIVE substrate */
  renderLayers: string[];
  /** which mode the field starts in */
  primaryRender: string;
  /** the recipe's natural-field accent (drives the active-pill glow) */
  accent: string;
}

// The eight substrate modes (RenderMode, passport.ts). Each gets a signature swatch colour so the
// palette reads as distinct techniques, and a one-line "what you're seeing" note.
const SUBSTRATE: { mode: string; label: string; sw: string; note: string }[] = [
  { mode: 'dots',        label: 'dots',        sw: '#cbd5e1', note: 'Each particle is a dot — raw matter responding to the bodies.' },
  { mode: 'trails',      label: 'trails',      sw: '#60a5fa', note: 'Particles leave fading trails — momentum and history.' },
  { mode: 'links',       label: 'links',       sw: '#818cf8', note: 'Lines join nearby matter — the relationship structure between bodies.' },
  { mode: 'streamlines', label: 'streamlines', sw: '#2dd4bf', note: 'Flow lines trace where the field would carry a particle — direction and current.' },
  { mode: 'metaballs',   label: 'metaballs',   sw: '#a78bfa', note: 'Matter melts into blobs — clustering, grouping, and merged regions.' },
  { mode: 'voronoi',     label: 'voronoi',     sw: '#f472b6', note: 'Cells partition the field — territories and regions of influence.' },
  { mode: 'field-lines', label: 'field-lines', sw: '#38bdf8', note: "The field's own lines — the shape of its influence, independent of matter." },
  { mode: 'heatmap',     label: 'heatmap',     sw: '#fb923c', note: 'A density gradient — where matter concentrates, hot to cold.' },
];

// The diagnostic overlay readings (OverlayMode, types.ts) — additive, drawn on the overlay surface.
const OVERLAYS: { mode: string; label: string; note: string }[] = [
  { mode: 'force-vectors', label: 'vectors',     note: 'Arrows: the force a probe would feel at each point.' },
  { mode: 'grid',          label: 'grid',        note: 'A reference grid bent by the field.' },
  { mode: 'field-lines',   label: 'field-lines', note: 'Field lines drawn over the substrate.' },
  { mode: 'temperature',   label: 'temperature', note: 'Local thermodynamic temperature as a tint.' },
  { mode: 'energy',        label: 'energy',      note: 'Field energy density.' },
  { mode: 'path',          label: 'path',        note: 'Traced motion paths of the matter.' },
];

const SUBSTRATE_BY_MODE = new Map(SUBSTRATE.map((s) => [s.mode, s]));
const OVERLAY_BY_MODE = new Map(OVERLAYS.map((o) => [o.mode, o]));

// recipe render layer → substrate mode (the catalog uses "particles" for the dot substrate)
const LAYER_TO_SUBSTRATE: Record<string, string> = {
  particles: 'dots', dots: 'dots', trails: 'trails', links: 'links',
  streamlines: 'streamlines', metaballs: 'metaballs', voronoi: 'voronoi',
  'field-lines': 'field-lines', heatmap: 'heatmap',
};

// live feedback channels written onto a [data-feedback] body (feedback-sink.ts) — the genuine "what
// your CSS sees" set. --d is the engine's own gathered-density channel (distinct from the
// host-supplied --field-density lane); we read the inline props directly, in this order.
const SIGNAL_VARS: { prop: string; label: string }[] = [
  { prop: '--d', label: '--d' },
  { prop: '--field-attention', label: '--field-attention' },
  { prop: '--coherence', label: '--coherence' },
  { prop: '--entropy', label: '--entropy' },
  { prop: '--temperature', label: '--temperature' },
  { prop: '--field-priority', label: '--field-priority' },
  { prop: '--load', label: '--load' },
];

const fmt = (v: number) => (Math.abs(v) >= 1 ? v.toFixed(0) : v.toFixed(2));

export function attachWorkbench(opts: WorkbenchOptions): () => void {
  const { container, field, feedbackEl, hasOverlay, accent } = opts;

  // the recipe's native substrates (highlighted with a dot marker so visitors know the "home" view)
  const native = new Set<string>();
  for (const layer of opts.renderLayers) {
    const m = LAYER_TO_SUBSTRATE[layer];
    if (m) native.add(m);
  }
  let current = LAYER_TO_SUBSTRATE[opts.primaryRender] ?? opts.primaryRender;
  if (!SUBSTRATE_BY_MODE.has(current)) current = 'dots';

  const activeOverlays = new Set<string>();

  // ── DOM ───────────────────────────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'exd-workbench';
  bar.style.setProperty('--exd-accent', accent);

  const substrateRow =
    `<div class="exd-viz-group">` +
    `<span class="exd-viz-label">substrate</span>` +
    `<div class="exd-substrate" role="radiogroup" aria-label="Substrate render mode">` +
    SUBSTRATE.map(
      (s) =>
        `<button type="button" class="exd-vpill${s.mode === current ? ' is-on' : ''}${native.has(s.mode) ? ' is-native' : ''}" ` +
        `data-render="${s.mode}" role="radio" aria-checked="${s.mode === current}" title="${s.note}">` +
        `<i class="exd-sw" style="background:${s.sw}"></i>${s.label}</button>`,
    ).join('') +
    `</div></div>`;

  const overlayRow = hasOverlay
    ? `<div class="exd-viz-group">` +
      `<span class="exd-viz-label">overlay</span>` +
      `<div class="exd-overlays" role="group" aria-label="Diagnostic overlays (stackable)">` +
      OVERLAYS.map(
        (o) =>
          `<button type="button" class="exd-vtog" data-overlay="${o.mode}" aria-pressed="false" title="${o.note}">${o.label}</button>`,
      ).join('') +
      `</div></div>`
    : '';

  bar.innerHTML = substrateRow + overlayRow;

  const note = document.createElement('p');
  note.className = 'exd-note';
  note.textContent = SUBSTRATE_BY_MODE.get(current)?.note ?? '';

  const signals = document.createElement('div');
  signals.className = 'exd-signals';

  // note rides at the top of the bottom control block so the caption + the two control rows move
  // together and never overlap (the substrate/overlay rows can wrap to two lines each).
  bar.insertBefore(note, bar.firstChild);

  container.appendChild(signals);
  container.appendChild(bar);

  // caption = active substrate note + any active overlay notes appended
  const refreshNote = (): void => {
    const parts = [SUBSTRATE_BY_MODE.get(current)?.note ?? ''];
    for (const m of activeOverlays) {
      const o = OVERLAY_BY_MODE.get(m);
      if (o) parts.push(o.note);
    }
    note.textContent = parts.filter(Boolean).join('  ·  ');
  };

  // ── controls ────────────────────────────────────────────────────────────────────────────────
  const onBarClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;

    const sub = t.closest<HTMLElement>('.exd-vpill');
    if (sub) {
      const mode = sub.dataset.render!;
      try { field.setRender(mode); } catch { /* unsupported on this field — ignore */ }
      current = mode;
      bar.querySelectorAll('.exd-vpill').forEach((b) => {
        const on = b === sub;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      refreshNote();
      return;
    }

    const tog = t.closest<HTMLElement>('.exd-vtog');
    if (tog) {
      const mode = tog.dataset.overlay!;
      const on = tog.getAttribute('aria-pressed') !== 'true';
      if (on) activeOverlays.add(mode);
      else activeOverlays.delete(mode);
      tog.setAttribute('aria-pressed', String(on));
      tog.classList.toggle('is-on', on);
      try { field.setOverlay(activeOverlays.size ? [...activeOverlays] : 'off'); } catch { /* ignore */ }
      refreshNote();
    }
  };
  bar.addEventListener('click', onBarClick);

  // ── live signal readout (interval, not rAF — avoids contending with the field's own loop) ─────
  const renderSignals = (): void => {
    const rows: string[] = [];
    if (feedbackEl) {
      for (const { prop, label } of SIGNAL_VARS) {
        if (rows.length >= 4) break;
        const raw = feedbackEl.style.getPropertyValue(prop).trim();
        if (raw === '') continue;
        const num = parseFloat(raw);
        if (Number.isNaN(num)) continue;
        const pct = Math.max(0, Math.min(1, Math.abs(num))) * 100;
        rows.push(
          `<div class="exd-sig"><span class="exd-sig-k">${label}</span>` +
            `<span class="exd-sig-bar"><i style="width:${pct.toFixed(0)}%"></i></span>` +
            `<span class="exd-sig-v">${fmt(num)}</span></div>`,
        );
      }
    }
    rows.push(
      `<div class="exd-sig exd-sig-count"><span class="exd-sig-k">particles</span>` +
        `<span class="exd-sig-v">${field.particleCount()}</span></div>`,
    );
    signals.innerHTML = rows.join('');
  };
  renderSignals();
  const timer = window.setInterval(renderSignals, 280);

  return () => {
    window.clearInterval(timer);
    bar.removeEventListener('click', onBarClick);
    bar.remove();
    note.remove();
    signals.remove();
  };
}
