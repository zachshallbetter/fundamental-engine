/**
 * Observatory shell — Phases O1/O3/O5.
 *
 * Loads the recorded evidence bundle, owns view state and the replay cursor, and delegates rendering.
 * It makes no runtime decisions: it selects, filters and scrubs. Every value it shows came out of the
 * bundle, and the inspector resolves any cited id back to the evidence node that carries its provenance.
 */
import { Replay } from './replay.js';
import * as V from './views.js';

const REPLAY_VIEWS = [
  { id: 'world', label: 'World' },
  { id: 'projection', label: 'Projection' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'episodes', label: 'Episodes' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'timeline', label: 'Timeline' },
];

const RESEARCH_VIEWS = [
  { id: 'corpus', label: 'Corpus' },
  { id: 'discoveries', label: 'Discoveries' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'projectionLab', label: 'Projection lab' },
  { id: 'ablation', label: 'Ablation' },
  { id: 'crossVersion', label: 'Cross-version' },
];

const state = {
  mode: 'replay',
  view: 'world',
  runIndex: 0,
  projectionId: null,
  opportunityOp: null,
  detectionIndex: 0,
  evidenceFilter: 'all',
  bookmarks: new Set(),
  comparisonBundle: null,
};

let bundle = null;
let replay = null;
let evidenceById = new Map();

const $ = (id) => document.getElementById(id);

async function boot() {
  try {
    const res = await fetch('./public/bundle.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`bundle.json → HTTP ${res.status}`);
    bundle = await res.json();
  } catch (err) {
    $('pane').innerHTML = `
      <h2>No evidence bundle</h2>
      <p class="sub">${V.esc(err.message)}</p>
      <div class="card">
        <p>The Observatory renders a recorded bundle and cannot generate one. Emit it from the runtime:</p>
        <pre class="mono">node scripts/emit-observatory-bundle.mjs</pre>
      </div>`;
    return;
  }

  evidenceById = new Map(bundle.evidence.map((n) => [n.id, n]));
  $('revision').textContent = `rev ${bundle.revision.commit} · core ${bundle.revision.coreVersion}`;
  $('schema-tag').textContent = bundle.revision.bundleSchema;

  selectRun(0);
  wire();
  render();
}

function selectRun(index) {
  state.runIndex = index;
  replay = new Replay(bundle.runs[index]);
  replay.onChange(() => {
    render();
    syncTransport();
  });
}

/* ─────────────────────────────────────────────────────────────── rendering */

function renderRail() {
  const views = state.mode === 'replay' ? REPLAY_VIEWS : RESEARCH_VIEWS;
  let html = '';

  if (state.mode === 'replay') {
    html += `<div class="rail-label">Substrate</div>`;
    html += bundle.runs.map((r, i) => `
      <button data-run-index="${i}" class="${i === state.runIndex ? 'active' : ''}">${V.esc(r.substrate)}</button>`).join('');
    if (bundle.pendingSubstrates.length) {
      html += `<div class="rail-label">Pending</div>`;
      html += bundle.pendingSubstrates.map((s) => `
        <button disabled title="no run captured — pending" style="opacity:.45;cursor:not-allowed">${V.esc(s)}</button>`).join('');
    }
  }

  html += `<div class="rail-label">${state.mode === 'replay' ? 'Panes' : 'Research'}</div>`;
  html += views.map((v) => `
    <button data-view="${v.id}" class="${v.id === state.view ? 'active' : ''}">${v.label}</button>`).join('');

  $('rail').innerHTML = html;
}

function render() {
  renderRail();
  const pane = $('pane');

  if (state.mode === 'replay') {
    switch (state.view) {
      case 'world': pane.innerHTML = V.worldView(bundle, replay); break;
      case 'projection': pane.innerHTML = V.projectionView(bundle, state); break;
      case 'opportunity': pane.innerHTML = V.opportunityView(bundle, state); break;
      case 'episodes': pane.innerHTML = V.episodesView(bundle, state); break;
      case 'evidence': pane.innerHTML = V.evidenceView(bundle, state); break;
      case 'timeline': pane.innerHTML = V.timelineView(bundle, replay, state); break;
      default: pane.innerHTML = V.worldView(bundle, replay);
    }
  } else {
    switch (state.view) {
      case 'corpus': pane.innerHTML = V.corpusView(bundle); break;
      case 'discoveries': pane.innerHTML = V.discoveriesView(bundle); break;
      case 'predictions': pane.innerHTML = V.predictionsView(bundle); break;
      case 'projectionLab': pane.innerHTML = V.projectionLabView(bundle); break;
      case 'ablation': pane.innerHTML = V.ablationView(bundle); break;
      case 'crossVersion': pane.innerHTML = V.crossVersionView(bundle, state); break;
      default: pane.innerHTML = V.corpusView(bundle);
    }
  }

  $('transport').hidden = state.mode !== 'replay';
  if (state.mode === 'replay') syncTransport();
}

function syncTransport() {
  const scrub = $('t-scrub');
  scrub.max = String(Math.max(0, replay.length - 1));
  scrub.value = String(replay.index);
  $('t-play').textContent = replay.playing ? '⏸' : '▶';
  const t = replay.transition;
  $('t-readout').textContent =
    `${replay.run.substrate} · step ${replay.index}/${replay.length - 1} · ${t?.lifecycle ?? '—'}` +
    (replay.run.terminated && replay.index === replay.length - 1 ? ' · terminal' : '');
}

/* ──────────────────────────────────────────────────────────────── inspector */

function inspect(id) {
  const node = evidenceById.get(id);
  const box = $('inspector');
  if (!node) {
    box.innerHTML = `<div class="inspector-empty">No evidence node <span class="mono">${V.esc(id)}</span> in this bundle.</div>`;
    return;
  }

  const upstream = node.derivedFrom.map((f) => {
    const n = evidenceById.get(f);
    return `<div>${V.cite(f, f)} <span class="note">${V.esc(n?.label ?? 'unknown')}</span></div>`;
  }).join('');

  const downstream = bundle.evidence.filter((n) => n.derivedFrom.includes(id)).slice(0, 12)
    .map((n) => `<div>${V.cite(n.id, n.id)} <span class="note">${V.esc(n.label)}</span></div>`).join('');

  const citedBy = replay
    ? replay.run.transitions.filter((t) => t.evidenceIds.includes(id)).map((t) => t.step)
    : [];

  box.innerHTML = `
    <h3>${V.esc(node.kind)}</h3>
    <p class="mono" style="color:var(--accent)">${V.esc(node.id)}</p>
    <p>${V.esc(node.label)}</p>
    <table><tbody>
      <tr><td>origin</td><td class="mono">${V.esc(node.origin)}</td></tr>
      ${node.step !== undefined ? `<tr><td>step</td><td class="mono">${node.step}</td></tr>` : ''}
    </tbody></table>
    ${citedBy.length ? `<p><button class="cite" data-jump="${V.esc(id)}">jump to step ${citedBy[0]}</button></p>` : ''}
    ${upstream ? `<h3 style="margin-top:12px">Derived from</h3>${upstream}` : ''}
    ${downstream ? `<h3 style="margin-top:12px">Feeds into</h3>${downstream}` : ''}
    <h3 style="margin-top:12px">Payload</h3>
    <pre>${V.esc(JSON.stringify(node.payload, null, 2))}</pre>`;
}

/* ────────────────────────────────────────────────────────────────── events */

function wire() {
  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      state.view = state.mode === 'replay' ? 'world' : 'corpus';
      document.querySelectorAll('.mode').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      render();
    });
  });

  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('[data-view],[data-run-index],[data-run],[data-projection],[data-opportunity],[data-detection],[data-evfilter],[data-evidence],[data-seek],[data-bookmark],[data-jump]');
    if (!el) return;
    const d = el.dataset;

    if (d.view) { state.view = d.view; render(); return; }
    if (d.runIndex !== undefined) { selectRun(Number(d.runIndex)); render(); return; }
    if (d.run !== undefined) {
      const i = bundle.runs.findIndex((r) => r.substrate === d.run);
      if (i >= 0) { selectRun(i); render(); }
      return;
    }
    if (d.projection) { state.projectionId = d.projection; state.opportunityOp = null; render(); return; }
    if (d.opportunity) { state.opportunityOp = d.opportunity; render(); return; }
    if (d.detection !== undefined) { state.detectionIndex = Number(d.detection); render(); return; }
    if (d.evfilter) { state.evidenceFilter = d.evfilter; render(); return; }
    if (d.seek !== undefined) { replay.seek(Number(d.seek)); return; }
    if (d.bookmark !== undefined) {
      const step = Number(d.bookmark);
      state.bookmarks.has(step) ? state.bookmarks.delete(step) : state.bookmarks.add(step);
      render();
      return;
    }
    if (d.jump) { replay.jumpToEvidence(d.jump); return; }
    if (d.evidence) { inspect(d.evidence); return; }
  });

  $('t-play').addEventListener('click', () => replay.toggle());
  $('t-back').addEventListener('click', () => replay.step(-1));
  $('t-fwd').addEventListener('click', () => replay.step(1));
  $('t-reset').addEventListener('click', () => replay.reset());
  $('t-scrub').addEventListener('input', (e) => replay.seek(Number(e.target.value)));

  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'replay' || e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); replay.toggle(); }
    if (e.key === 'ArrowLeft') replay.step(-1);
    if (e.key === 'ArrowRight') replay.step(1);
  });

  // cross-version comparison: load a second captured bundle
  document.body.addEventListener('change', async (e) => {
    if (e.target.id !== 'load-comparison') return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const other = JSON.parse(await file.text());
      if (other?.revision?.bundleSchema !== bundle.revision.bundleSchema) {
        alert(`Schema mismatch: ${other?.revision?.bundleSchema ?? 'unknown'} vs ${bundle.revision.bundleSchema}`);
        return;
      }
      state.comparisonBundle = other;
      render();
    } catch (err) {
      alert(`Could not read bundle: ${err.message}`);
    }
  });
}

boot();
