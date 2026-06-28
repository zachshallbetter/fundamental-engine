// explore-workbench.ts — the visualization workbench inside the expanded detail preview.
//
// This is the teaching surface: it turns the engine's legibility layers into interactive controls so
// a visitor can SEE the machinery. Three pieces:
//   • render switcher — field.setRender(mode): the same matter, drawn as dots / links / metaballs / …
//   • heatmap toggle  — field.setHeatmap(): the density underlay
//   • live signal readout — the CSS variables the engine writes onto the feedback bodies every frame
//     (--field-attention, --d / --field-density, the recipe's own metrics) + the particle count.
//
// The signals panel is the conversion moment, and it's most striking in "signals" (render: none) mode:
// nothing is drawn, yet the numbers keep moving — the invisible field your CSS consumes.

interface FieldLike {
  setRender(mode: string): void;
  setHeatmap(on: boolean): void;
  particleCount(): number;
}

interface AppliedLike {
  inspect(): { metrics: Record<string, Record<string, number>> };
}

export interface WorkbenchOptions {
  container: HTMLElement;
  field: FieldLike;
  /** the applied recipe — inspect() gives the live metric pipeline values for the signal readout */
  applied: AppliedLike;
  /** the recipe's render layers (catalog order); mapped to setRender modes */
  renderLayers: string[];
  /** which mode the field is currently in */
  primaryRender: string;
}

// recipe render layer → setRender mode (particles draws as dots; field-lines/heatmap aren't pills)
const RENDER_MAP: Record<string, string> = {
  particles: 'dots', dots: 'dots', trails: 'trails', links: 'links',
  streamlines: 'streamlines', metaballs: 'metaballs', voronoi: 'voronoi',
};

const RENDER_NOTE: Record<string, string> = {
  dots: 'Each particle is a dot — raw matter responding to the bodies.',
  trails: 'Particles leave fading trails — momentum and history.',
  links: 'Lines join nearby matter — the relationship structure.',
  metaballs: 'Matter merges into blobs — clustering and grouping.',
  voronoi: 'Cells partition the field — territories and regions.',
  streamlines: 'Flow lines trace the field — direction and current.',
  none: 'Signals only — nothing is drawn. The field still measures and writes the CSS variables on the right, which your styles consume. This is the invisible field.',
};

const fmt = (v: number) => (Math.abs(v) >= 1 ? v.toFixed(0) : v.toFixed(2));

export function attachWorkbench(opts: WorkbenchOptions): () => void {
  const { container, field, applied, renderLayers } = opts;

  // build the ordered, de-duplicated render mode list from the recipe, with signals-only appended.
  const modes: string[] = [];
  for (const layer of renderLayers) {
    const m = RENDER_MAP[layer];
    if (m && !modes.includes(m)) modes.push(m);
  }
  if (!modes.includes('dots')) modes.unshift('dots');
  modes.push('none');

  let current = RENDER_MAP[opts.primaryRender] ?? opts.primaryRender;
  if (!modes.includes(current)) current = modes[0]!;

  // ── DOM ───────────────────────────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'exd-workbench';
  bar.innerHTML =
    `<div class="exd-render-pills" role="group" aria-label="Render mode">` +
    modes
      .map(
        (m) =>
          `<button type="button" class="exd-rpill${m === current ? ' is-on' : ''}" data-render="${m}">${m === 'none' ? 'signals' : m}</button>`,
      )
      .join('') +
    `</div>` +
    `<button type="button" class="exd-heat" data-heat aria-pressed="false">heatmap</button>`;

  const note = document.createElement('p');
  note.className = 'exd-note';
  note.textContent = RENDER_NOTE[current] ?? '';

  const signals = document.createElement('div');
  signals.className = 'exd-signals';

  container.appendChild(signals);
  container.appendChild(note);
  container.appendChild(bar);

  // ── render switcher ─────────────────────────────────────────────────────────────────────────
  const onBarClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const rpill = t.closest<HTMLElement>('.exd-rpill');
    if (rpill) {
      const mode = rpill.dataset.render!;
      try { field.setRender(mode); } catch { /* mode unsupported on this field — ignore */ }
      current = mode;
      bar.querySelectorAll('.exd-rpill').forEach((b) => b.classList.toggle('is-on', b === rpill));
      note.textContent = RENDER_NOTE[mode] ?? '';
      return;
    }
    const heat = t.closest<HTMLElement>('.exd-heat');
    if (heat) {
      const on = heat.getAttribute('aria-pressed') !== 'true';
      try { field.setHeatmap(on); } catch { /* ignore */ }
      heat.setAttribute('aria-pressed', String(on));
    }
  };
  bar.addEventListener('click', onBarClick);

  // ── live signal readout (interval, not rAF — avoids contending with the field's own loop) ─────
  // Source = the recipe's REAL metric pipeline via applied.inspect() (elementKey → metric → value),
  // averaged across the bodies. These are the same numbers a CSS consumer reads as --field-<metric>.
  const renderSignals = (): void => {
    const rows: string[] = [];
    let metrics: Record<string, Record<string, number>> = {};
    try { metrics = applied.inspect().metrics; } catch { /* inspection unavailable */ }

    const sums = new Map<string, { total: number; n: number }>();
    for (const perEl of Object.values(metrics)) {
      for (const [k, v] of Object.entries(perEl)) {
        if (!Number.isFinite(v)) continue;
        const acc = sums.get(k) ?? { total: 0, n: 0 };
        acc.total += v; acc.n += 1;
        sums.set(k, acc);
      }
    }
    for (const [k, { total, n }] of sums) {
      if (rows.length >= 4) break;
      const avg = total / n;
      const pct = Math.max(0, Math.min(1, Math.abs(avg))) * 100;
      rows.push(
        `<div class="exd-sig"><span class="exd-sig-k">--field-${k}</span>` +
          `<span class="exd-sig-bar"><i style="width:${pct.toFixed(0)}%"></i></span>` +
          `<span class="exd-sig-v">${fmt(avg)}</span></div>`,
      );
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
