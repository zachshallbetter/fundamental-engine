/**
 * Observatory views — Phases O4–O9.
 *
 * Every function here is a pure renderer over the recorded bundle. None of them derives anything: no
 * opportunity is computed, no episode is grouped, no discovery is decided. Where a value appears, it
 * was read out of the bundle, and a `cite` control resolves it back to the evidence node naming the
 * runtime function that produced it.
 *
 * Where the bundle has nothing, the view says so. It never renders an empty result as a finding.
 */

import { operationsModel, predicatesModel, episodesModel, claimsModel, constructibility, representationProblems } from './semantics.js';
import { TRANSFORMATIONS, REFUSED_TRANSFORMATIONS, transformationLedger } from './transformations.js';
import { INSTRUMENT_PREDICTIONS, measureFidelity } from './instrument.js';

export const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const cite = (id, label = 'cite') =>
  id ? `<button class="cite" data-evidence="${esc(id)}">${esc(label)}</button>` : '';

/** Renders the instrument's own disclosures. A transformation the reviewer is not told about is a defect. */
export const disclosures = (m) => {
  const problems = representationProblems(m);
  const rows = m.disclosures.map((d) =>
    `<li><span class="mono">${esc(d.transformation)}</span> — ${esc(d.text)}</li>`).join('');
  if (!rows && !problems.length) return '';
  return `<div class="card disclosure">
    <h3>Instrument transformations applied here</h3>
    ${rows ? `<ul class="sub">${rows}</ul>` : '<p class="note">All transformations in this view are lossless.</p>'}
    ${problems.length ? `<p class="note vis-inferred">representation problems: ${
      problems.map((p) => esc(p.rule)).join(', ')}</p>` : ''}
  </div>`;
};

const pill = (text, cls = '') => `<span class="pill ${cls}">${esc(text)}</span>`;
const yn = (b) => (b ? pill('yes', 'ok') : pill('no', 'bad'));
const num = (n, digits = 2) => (typeof n === 'number' ? n.toFixed(digits) : '—');

/* ────────────────────────────────────────────────────────────── O4.1 World */

const VIS_ORDER = ['declared', 'observed', 'reconstructed', 'inferred', 'unavailable'];

export function worldView(bundle, replay) {
  const run = replay.run;
  const t = replay.transition;
  const snap = replay.reading;

  const counts = Object.fromEntries(VIS_ORDER.map((v) => [v, run.stateFacts.filter((f) => f.visibility === v).length]));

  const legend = VIS_ORDER.map((v) => `
    <div class="metric">
      <span class="value vis-${v}">${counts[v] ?? 0}</span>
      <span class="label">${v}</span>
    </div>`).join('');

  const readingRows = snap
    ? Object.entries(snap.reading).map(([k, v]) => `
        <tr><td class="mono">${esc(k)}</td><td class="mono">${esc(v)}</td>
        <td><span class="vis-observed">observed</span></td>
        <td class="mono">${cite(t?.evidenceIds?.[0], 'transition evidence')}</td></tr>`).join('')
    : '';

  const factRows = run.stateFacts
    .filter((f) => f.visibility !== 'observed')
    .map((f) => `
      <tr><td class="mono">${esc(f.key)}</td><td class="mono">${f.value ?? '—'}</td>
      <td><span class="vis-${f.visibility}">${esc(f.visibility)}</span></td>
      <td class="note">${esc(f.basis)}</td></tr>`).join('');

  return `
    <h2>World — ${esc(run.substrate)}</h2>
    <p class="sub">
      Only declared or reconstructed state is shown. Nothing on this page is inferred: the runtime does
      not infer state, so the <span class="vis-inferred">inferred</span> count is structurally zero
      rather than merely empty.
    </p>

    <div class="card">
      <h3>State visibility</h3>
      <div class="grid three">${legend}</div>
    </div>

    <div class="card">
      <h3>Observed state at step ${replay.index}${snap?.stale ? ` <span class="note">(last reading, from step ${snap.fromStep})</span>` : ''}</h3>
      ${snap ? `<table><thead><tr><th>key</th><th>value</th><th>visibility</th><th>evidence</th></tr></thead>
        <tbody>${readingRows}</tbody></table>`
      : `<div class="empty">This substrate produced no snapshot reading — <code>capabilities.snapshot</code> is
         ${run.capabilities.snapshot ? 'declared but no reading was recorded' : 'false'}. Nothing is shown in its place.</div>`}
    </div>

    ${factRows ? `<div class="card"><h3>Other state facts</h3>
      <table><thead><tr><th>construct</th><th>value</th><th>visibility</th><th>basis (from the runtime)</th></tr></thead>
      <tbody>${factRows}</tbody></table></div>` : ''}

    <div class="card">
      <h3>Contract declarations</h3>
      <table><tbody>
        <tr><td>execution kind</td><td>${pill(run.executionKind, 'accent')}</td></tr>
        <tr><td>determinism</td><td>${pill(run.determinism.classification)} <span class="note">
          controlled: ${esc(run.determinism.controlledInputs.join(', ') || 'none')} ·
          uncontrolled: ${esc(run.determinism.uncontrolledInputs.join(', ') || 'none')}</span></td></tr>
        <tr><td>snapshot / restore / replay</td><td>${yn(run.capabilities.snapshot)} ${yn(run.capabilities.restore)} ${yn(run.capabilities.replay)}</td></tr>
        <tr><td>declares its transition law</td><td>${yn(run.capabilities.declareTransitionLaw)}</td></tr>
      </tbody></table>
      ${run.transitionLaw
        ? `<h3 style="margin-top:14px">Declared law (${esc(run.transitionLaw.kind)})</h3>
           <pre class="mono">${esc(JSON.stringify(run.transitionLaw.rules, null, 1))}</pre>
           <p class="note">${esc(run.transitionLaw.notes ?? '')}</p>`
        : `<p class="note">This substrate does not declare a transition law, so none is shown. An
           <code>opaque-native</code> or partially-declarable substrate answering <em>no</em> here is a
           truthful declaration, not a missing feature.</p>`}
    </div>`;
}

/* ───────────────────────────────────────────────────────── O4.2 Projection */

export function projectionView(bundle, state) {
  const recorded = bundle.projections;
  if (!recorded.length) return `<h2>Projection</h2><div class="empty">No projections recorded.</div>`;

  const activeId = state.projectionId ?? recorded[0].definitionId;
  const active = recorded.find((p) => p.definitionId === activeId) ?? recorded[0];
  const baseline = recorded[0];

  const chooser = recorded.map((p) => `
    <button data-projection="${esc(p.definitionId)}" class="${p.definitionId === active.definitionId ? 'active' : ''}">
      ${esc(p.definitionId)}</button>`).join('');

  const surface = active.result.surface;
  const opModel = operationsModel(surface, baseline.result.surface, baseline.definitionId);
  const opRows = opModel.items.map((o) => `
    <tr>
      <td class="mono">${esc(o.label)}</td>
      <td>${pill(o.statusKind, o.statusKind === 'exposed' ? 'ok' : o.statusKind === 'unavailable' ? 'bad' : '')}</td>
      <td>${o.signaled ? pill('signaled', 'accent') : '<span class="note">not signaled</span>'}</td>
      <td>${o.comparison ? `<span class="note">was <strong>${esc(o.comparison.was)}</strong> under ${esc(o.comparison.baseline)}</span>` : ''}</td>
    </tr>`).join('');

  const omegaRows = active.opportunities.map((o) => `
    <tr>
      <td class="mono">${esc(o.operation)}</td>
      <td>${o.available ? pill('available', 'ok') : pill('unavailable', 'bad')}</td>
      <td>${o.exposed ? pill('exposed', 'ok') : pill('hidden')}</td>
      <td>${o.signaled ? pill('signaled', 'accent') : pill('unsignaled')}</td>
      <td class="mono">${esc(o.failedPredicates.map((f) => f.predicate).join(', ') || '—')}</td>
      <td>${cite(`projection:${active.definitionId}:omega:${o.operation}`)}</td>
    </tr>`).join('');

  const anomalies = active.result.anomalies.length
    ? active.result.anomalies.map((a, i) => `
        <tr><td>${pill(a.code, 'bad')}</td><td class="mono">${esc(a.subject)}</td>
        <td>${esc(a.detail)}</td><td>${cite(`projection:${active.definitionId}:anomaly:${i}`)}</td></tr>`).join('')
    : '';

  return `
    <h2>Projection</h2>
    <p class="sub">
      The same world state under different projections. Only differences the recorded evidence supports
      are marked — nothing is animated or interpolated between surfaces.
    </p>
    <div class="chooser">${chooser}</div>

    <div class="card">
      <h3>Surface — ${esc(active.definitionId)} <span class="note">${esc(active.scope)}</span></h3>
      <div class="grid two">
        <div>
          <h3>Observable state</h3>
          <table><tbody>${Object.entries(surface.observedState).map(([k, v]) =>
            `<tr><td class="mono">${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('') ||
            '<tr><td class="empty">nothing observable on this surface</td></tr>'}</tbody></table>
          ${surface.hiddenStateKeys.length
            ? `<p class="note">Hidden but present in the world: <span class="mono">${esc(surface.hiddenStateKeys.join(', '))}</span></p>` : ''}
        </div>
        <div>
          <h3>Authority</h3>
          <table><tbody>
            <tr><td>presented</td><td class="mono">${esc(surface.presentedAuthority.join(', ') || '—')}</td></tr>
            <tr><td>effective</td><td class="mono">${esc(surface.effectiveAuthority.map((g) => g.operation).join(', ') || '—')}</td></tr>
            <tr><td>effective capability</td><td class="mono">${esc(surface.effectiveCapabilities.join(', ') || '—')}</td></tr>
            <tr><td>accessible evidence</td><td class="mono">${esc(surface.accessibleEvidence.join(', ') || '—')}</td></tr>
          </tbody></table>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Operations</h3>
      <table><thead><tr><th>operation</th><th>exposure</th><th>discoverability</th><th>vs ${esc(baseline.definitionId)} <span class="note">(instrument-chosen baseline)</span></th></tr></thead>
      <tbody>${opRows}</tbody></table>
      <p class="note">exposed / hidden / unavailable are three different facts and are never merged:
        <em>hidden</em> exists in the world but is not offered here; <em>unavailable</em> is not in the
        world's vocabulary at all.</p>
    </div>
    ${disclosures(opModel)}

    <div class="card">
      <h3>Ω<sub>sys</sub> under this projection</h3>
      <table><thead><tr><th>operation</th><th>available</th><th>exposed</th><th>signaled</th><th>failed predicates</th><th></th></tr></thead>
      <tbody>${omegaRows}</tbody></table>
    </div>

    ${anomalies ? `<div class="card"><h3>Anomalies reported by the runtime</h3>
      <table><thead><tr><th>code</th><th>subject</th><th>detail</th><th></th></tr></thead><tbody>${anomalies}</tbody></table>
      <p class="note">An overstatement reported here is what makes it non-silent — the surface still
      reflects the source.</p></div>` : ''}`;
}

/* ──────────────────────────────────────────────────────── O4.3 Opportunity */

export function opportunityView(bundle, state) {
  const recorded = bundle.projections;
  const activeId = state.projectionId ?? recorded[0]?.definitionId;
  const active = recorded.find((p) => p.definitionId === activeId) ?? recorded[0];
  if (!active) return `<h2>Opportunity</h2><div class="empty">No opportunity evaluations recorded.</div>`;

  const selected = state.opportunityOp ?? active.opportunities[0]?.operation;
  const result = active.opportunities.find((o) => o.operation === selected) ?? active.opportunities[0];

  const chooser = active.opportunities.map((o) => `
    <button data-opportunity="${esc(o.operation)}" class="${o.operation === result.operation ? 'active' : ''}">
      ${esc(o.operation)} ${o.available ? '✓' : '✕'}</button>`).join('');

  const evId = `projection:${active.definitionId}:omega:${result.operation}`;

  const m = predicatesModel(result, evId);
  const nodes = m.items.map((p) => `
    <div class="deriv-node" data-evidence="${esc(p.evidenceId)}">
      <span class="k">${esc(p.label)}</span>
      <span class="v ${p.value ? 'vis-observed' : 'vis-inferred'}">${p.value}</span>
      <span class="note">${esc(p.basis)}${p.authoritySource ? ` · authority: ${esc(p.authoritySource)}` : ''}</span>
    </div>`).join('');

  const conjuncts = ['domain-valid', 'capable', 'permitted', 'enabled', 'reachable', 'exposed'];

  return `
    <h2>Opportunity — Ω<sub>sys</sub></h2>
    <p class="sub">
      System-relative opportunity only. It contains no belief, perceived availability, interpretation or
      expectation — those are empirically inferred and out of scope for the runtime. Each node below is
      a predicate the runtime evaluated; every one cites the evaluation that produced it.
    </p>
    <div class="chooser">${chooser}</div>

    <div class="card">
      <h3>${esc(result.operation)} for <span class="mono">${esc(result.participant)}</span> under
        <span class="mono">${esc(active.definitionId)}</span> →
        ${result.available ? pill('available', 'ok') : pill('unavailable', 'bad')}</h3>
      <div class="deriv">${nodes}</div>
      <p class="deriv-conj">
        available = ${conjuncts.join(' ∧ ')}
        <span class="note">— discoverability (<em>signaled</em>) and safety (<em>reversible</em>) are
        reported separately, never folded into availability.</span>
      </p>
      ${result.failedPredicates.length
        ? `<p class="note">Failed: ${result.failedPredicates.map((f) => `${esc(f.predicate)} (${esc(f.reason)})`).join(' · ')}</p>`
        : ''}
      <p>${cite(evId, 'inspect full evaluation')}</p>
    </div>
    ${disclosures(m)}

    <div class="card">
      <h3>Reversibility &amp; recovery</h3>
      <table><tbody>
        <tr><td>reversible</td><td>${yn(result.reversible)}</td></tr>
        <tr><td>recovery paths</td><td class="mono">${esc(result.recoveryPaths.join(', ') || 'none')}</td></tr>
      </tbody></table>
    </div>`;
}

/* ─────────────────────────────────────────────────────────── O4.4 Episodes */

export function episodesView(bundle, state) {
  if (!bundle.detections.length) return `<h2>Episodes</h2><div class="empty">No detections recorded.</div>`;
  const idx = state.detectionIndex ?? 0;
  const active = bundle.detections[idx] ?? bundle.detections[0];

  const chooser = bundle.detections.map((d, i) => `
    <button data-detection="${i}" class="${i === idx ? 'active' : ''}">${esc(d.label)}</button>`).join('');

  const m = episodesModel(bundle.detections, idx);
  const r = active.result;
  const episodes = r.episodes.length
    ? r.episodes.map((e, i) => `
        <tr><td class="mono">#${i + 1}</td><td class="mono">${esc(e.participants.join(' ↔ '))}</td>
        <td>${pill(e.basis, 'accent')}</td><td class="mono">${e.span}</td>
        <td class="mono">${e.supportingPairs.length} pair(s)</td></tr>`).join('')
    : `<tr><td colspan="5" class="empty">No candidate episodes under these parameters. That is a result, not an absence of data.</td></tr>`;

  const alternates = r.alternateSegmentations?.length
    ? r.alternateSegmentations.map((a) => `
        <tr><td class="mono">${esc(a.participants.join(' ↔ '))}</td><td>${pill(a.basis)}</td>
        <td class="mono">${esc(a.underParameter)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="empty">none reported</td></tr>`;

  return `
    <h2>Episodes</h2>
    <p class="sub">
      Findings are <strong>conditional</strong> — relative to the declared detection contract. Changing
      parameters produces an additional grouping; every parameterization recorded is kept, and none
      overwrites another.
    </p>
    <div class="chooser">${chooser}</div>
    ${disclosures(m)}
    ${m.conditional?.selectedByInstrument
      ? `<p class="note">This grouping is the instrument's default (first recorded), not a privileged
         result — ${m.conditional.alternativesAvailable} equally defensible alternative(s) below.</p>`
      : ''}

    <div class="card">
      <h3>Detection contract</h3>
      <table><tbody>
        <tr><td>boundary participants</td><td class="mono">${esc(active.contract.boundary.participants.join(', '))}</td></tr>
        <tr><td>boundary span</td><td class="mono">${active.contract.boundary.start}–${active.contract.boundary.end}</td></tr>
        <tr><td>recurrence window</td><td class="mono">${active.contract.recurrenceWindow}</td></tr>
        <tr><td>coupling</td><td class="mono">${esc(active.contract.coupling.kind)} ≥ ${active.contract.coupling.minInfluence}</td></tr>
      </tbody></table>
    </div>

    <div class="card">
      <h3>Candidate episodes ${cite(active.evidenceId)}</h3>
      <table><thead><tr><th></th><th>participants</th><th>basis</th><th>span</th><th>support</th></tr></thead>
      <tbody>${episodes}</tbody></table>
      <p class="note">
        World participants: <span class="mono">${esc(r.worldParticipants.join(', '))}</span> ·
        Episode participants: <span class="mono">${esc(r.episodeParticipants.join(', ') || 'none')}</span>
        — a world participant is not automatically an episode participant.
      </p>
    </div>

    <div class="card">
      <h3>Alternate segmentations</h3>
      <table><thead><tr><th>participants</th><th>basis</th><th>defensible under</th></tr></thead><tbody>${alternates}</tbody></table>
      <p class="note">Alternates are reported, not treated as errors — a defensible second reading of the
      same trace is a property of the detection contract, not a bug.</p>
    </div>

    <div class="card">
      <h3>Comparison across all recorded parameterizations</h3>
      <table><thead><tr><th>parameterization</th><th>episodes</th><th>participants</th><th>determinacy</th></tr></thead>
      <tbody>${bundle.detections.map((d) => `
        <tr><td>${esc(d.label)}</td><td class="mono">${d.result.episodes.length}</td>
        <td class="mono">${esc(d.result.episodeParticipants.join(', ') || '—')}</td>
        <td>${pill(d.result.determinacy ?? '—')}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

/* ─────────────────────────────────────────────────────────── O4.5 Evidence */

export function evidenceView(bundle, state) {
  const filter = state.evidenceFilter ?? 'all';
  const kinds = [...new Set(bundle.evidence.map((n) => n.kind))];
  const shown = filter === 'all' ? bundle.evidence : bundle.evidence.filter((n) => n.kind === filter);

  const chooser = ['all', ...kinds].map((k) => `
    <button data-evfilter="${esc(k)}" class="${k === filter ? 'active' : ''}">${esc(k)}
      <span class="note">${k === 'all' ? bundle.evidence.length : bundle.evidence.filter((n) => n.kind === k).length}</span>
    </button>`).join('');

  const rows = shown.slice(0, 400).map((n) => `
    <tr>
      <td class="mono">${cite(n.id, n.id)}</td>
      <td>${pill(n.kind)}</td>
      <td class="mono">${esc(n.origin)}</td>
      <td>${esc(n.label)}</td>
      <td class="mono">${n.step ?? ''}</td>
      <td class="mono">${n.derivedFrom.length ? esc(n.derivedFrom.length) + ' ←' : ''}</td>
    </tr>`).join('');

  return `
    <h2>Evidence</h2>
    <p class="sub">
      Every value anywhere in this instrument resolves to a node here, and every node names the runtime
      function that produced it. Nothing is displayed that the runtime did not emit.
    </p>
    <div class="chooser">${chooser}</div>
    <div class="card">
      <table><thead><tr><th>id</th><th>kind</th><th>origin (provenance)</th><th>label</th><th>step</th><th>derives from</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${shown.length > 400 ? `<p class="note">Showing first 400 of ${shown.length}.</p>` : ''}
    </div>`;
}

/* ─────────────────────────────────────────────────────────── O4.6 Timeline */

export function timelineView(bundle, replay, state) {
  const run = replay.run;
  const bookmarks = state.bookmarks ?? new Set();

  const cells = run.transitions.map((t, i) => {
    const cls = [
      i === replay.index ? 'current' : '',
      t.lifecycle === 'terminal' ? 'terminal' : '',
      t.failure ? 'failed' : '',
    ].filter(Boolean).join(' ');
    return `<button class="tl-cell ${cls}" data-seek="${i}" title="step ${i}${t.failure ? ' — ' + esc(t.failure.code) : ''}">${i}</button>`;
  }).join('');

  const t = replay.transition;
  const rows = replay.elapsed.slice().reverse().map((tr) => `
    <tr>
      <td class="mono">${tr.step}</td>
      <td class="mono">${esc(JSON.stringify(tr.input))}</td>
      <td class="mono">${esc(JSON.stringify(tr.output ?? null))}</td>
      <td>${tr.lifecycle === 'terminal' ? pill('terminal', 'warn') : pill('continuing')}</td>
      <td>${tr.failure ? pill(tr.failure.code, 'bad') : ''}</td>
      <td>${tr.evidenceIds.map((id) => cite(id, '·')).join('')}</td>
    </tr>`).join('');

  const others = bundle.runs.filter((r) => r.substrate !== run.substrate);

  return `
    <h2>Timeline — ${esc(run.substrate)}</h2>
    <p class="sub">
      Unified transition timeline for the recorded run. Click a cell to scrub; the other panes follow.
      ${run.terminated ? 'This run reached a <strong>terminal</strong> state.' : 'This run does not terminate.'}
    </p>

    <div class="card">
      <h3>Transitions</h3>
      <div class="tl">${cells}</div>
      <p class="note">
        outlined = terminal · red = failure · filled = cursor
        ${bookmarks.size ? ` · ${bookmarks.size} bookmark(s)` : ''}
      </p>
      <button class="cite" data-bookmark="${replay.index}">${bookmarks.has(replay.index) ? 'remove bookmark' : 'bookmark this step'}</button>
    </div>

    <div class="card">
      <h3>Step ${replay.index} detail</h3>
      ${t ? `<table><tbody>
        <tr><td>input</td><td class="mono">${esc(JSON.stringify(t.input))}</td></tr>
        <tr><td>output</td><td class="mono">${esc(JSON.stringify(t.output ?? null))}</td></tr>
        <tr><td>lifecycle</td><td>${pill(t.lifecycle, t.lifecycle === 'terminal' ? 'warn' : '')}</td></tr>
        ${t.failure ? `<tr><td>failure</td><td>${pill(t.failure.code, 'bad')} <span class="note">${esc(t.failure.message)}</span></td></tr>` : ''}
      </tbody></table>` : '<div class="empty">no transition at this cursor</div>'}
    </div>

    <div class="card">
      <h3>History to cursor</h3>
      <table><thead><tr><th>step</th><th>input</th><th>output</th><th>lifecycle</th><th>failure</th><th>evidence</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>

    <div class="card">
      <h3>Comparison — other recorded runs</h3>
      <table><thead><tr><th>substrate</th><th>execution kind</th><th>transitions</th><th>terminates</th><th>conformant</th></tr></thead>
      <tbody>${others.map((r) => `
        <tr><td><button class="cite" data-run="${esc(r.substrate)}">${esc(r.substrate)}</button></td>
        <td>${pill(r.executionKind, 'accent')}</td><td class="mono">${r.transitions.length}</td>
        <td>${yn(r.terminated)}</td><td>${yn(r.conformance.conformant)}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

/* ─────────────────────────────────────────────── O5/O6 Research: corpus */

export function corpusView(bundle) {
  const { corpus, corpusLedger } = bundle.registries;
  const captured = new Set(bundle.runs.map((r) => r.substrate));

  const rows = corpus.map((e) => {
    const churn = e.changes.reduce((n, c) => n + ({ 'required-member': 3, 'changed-semantics': 3 }[c.churnClass] ?? 1), 0);
    return `<tr>
      <td>${esc(e.substrate)} ${captured.has(e.substrate) ? '' : pill('no run captured', 'pending')}</td>
      <td>${e.status === 'adapted' ? pill('adapted', 'ok') : pill('pending', 'pending')}</td>
      <td>${e.executionKind ? pill(e.executionKind, 'accent') : '<span class="note">—</span>'}</td>
      <td class="mono">${e.predictedChurn ?? '—'}</td>
      <td class="mono">${e.status === 'adapted' ? churn : '—'}</td>
      <td>${e.changes.map((c) => pill(c.classification, c.classification === 'convenience' ? 'bad' : 'ok')).join(' ') || '<span class="note">none</span>'}</td>
      <td>${e.rejectedChanges.length ? pill(`${e.rejectedChanges.length} rejected`, 'warn') : ''}</td>
      <td>${cite(`corpus:${e.substrate}`)}</td>
    </tr>`;
  }).join('');

  const notes = corpus.filter((e) => e.note).map((e) => `
    <li><strong>${esc(e.substrate)}</strong> — ${esc(e.note)}</li>`).join('');

  return `
    <h2>Corpus</h2>
    <p class="sub">
      The substrate conformance corpus. Pending entries carry no evidence and are shown as pending —
      they are never counted toward generality.
    </p>

    <div class="card"><div class="grid three">
      <div class="metric"><span class="value">${corpusLedger.adapted}</span><span class="label">adapted</span></div>
      <div class="metric"><span class="value">${corpusLedger.pending}</span><span class="label">pending</span></div>
      <div class="metric"><span class="value">${corpusLedger.totalChurn}</span><span class="label">total churn</span></div>
      <div class="metric"><span class="value">${corpusLedger.structuralAccepted}</span><span class="label">structural accepted</span></div>
      <div class="metric"><span class="value">${corpusLedger.representationalAccepted}</span><span class="label">representational</span></div>
      <div class="metric"><span class="value ${corpusLedger.conveniencesAccepted ? 'vis-inferred' : 'vis-observed'}">${corpusLedger.conveniencesAccepted}</span><span class="label">conveniences accepted</span></div>
    </div></div>

    <div class="card">
      <table><thead><tr><th>substrate</th><th>status</th><th>execution kind</th><th>predicted churn</th>
      <th>actual</th><th>refinements</th><th>rejections</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>

    ${notes ? `<div class="card"><h3>Recorded notes</h3><ul class="sub">${notes}</ul></div>` : ''}

    <div class="card">
      <h3>Execution kinds exercised</h3>
      <p>${corpusLedger.executionKindsExercised.map((k) => pill(k, 'accent')).join(' ')}</p>
      <p class="note">Convergence is claimed only on the most recently adapted substrate
        (${corpusLedger.convergingOnLastAdapted ? 'currently: it required no change' : 'currently: it required changes'}),
        never on an average.</p>
    </div>`;
}

/* ─────────────────────────────────────── O5 Research: discoveries & records */

export function discoveriesView(bundle) {
  const { discoveries, negativeResults } = bundle.registries;

  const dCards = discoveries.map((d) => `
    <div class="card">
      <h3>${esc(d.id)} — ${esc(d.concept)} ${cite(d.id)}</h3>
      <table><tbody>
        <tr><td>discovered by</td><td>${pill(d.discoveredBy, 'accent')}</td></tr>
        <tr><td>why the prior contract was wrong</td><td>${esc(d.reason)}</td></tr>
        <tr><td>why it was invisible before</td><td>${esc(d.invisibleBecause)}</td></tr>
        <tr><td>provenance</td><td>${pill(d.provenance, 'ok')}</td></tr>
        <tr><td>cost</td><td>${d.changes.map((c) => `<div class="mono">${esc(c.member)} — ${esc(c.churnClass)} · ${esc(c.classification)}</div>`).join('')}</td></tr>
        ${d.deliberatelyExcluded?.length ? `<tr><td>deliberately NOT generalized</td><td>${
          d.deliberatelyExcluded.map((x) => `<div class="note">— ${esc(x)}</div>`).join('')}</td></tr>` : ''}
      </tbody></table>
    </div>`).join('');

  const nRows = negativeResults.map((n) => `
    <tr>
      <td class="mono">${cite(n.id, n.id)}</td>
      <td>${esc(n.hypothesis)}</td>
      <td>${n.status === 'falsified' ? pill('falsified', 'bad') : pill(n.status, 'pending')}</td>
      <td class="mono">${esc(n.falsifiedBy ?? '—')}</td>
      <td>${n.reconstructed ? pill('reconstructed', 'warn') : pill('contemporaneous', 'ok')}</td>
    </tr>`).join('');

  return `
    <h2>Discoveries &amp; negative results</h2>
    <p class="sub">
      A discovery is a concept the contract lacked, found because a substrate could not be expressed
      without it. A negative result is a hypothesis that was held and then disproven. Both are permanent
      records; the Observatory renders them and cannot add to them.
    </p>
    ${dCards}
    <div class="card">
      <h3>Negative results</h3>
      <table><thead><tr><th>id</th><th>hypothesis (as held)</th><th>status</th><th>falsified by</th><th>recording</th></tr></thead>
      <tbody>${nRows}</tbody></table>
      <p class="note">
        ${bundle.registries.negativeLedger.reconstructed} of ${bundle.registries.negativeLedger.total}
        entries were reconstructed after the fact rather than recorded when the belief was abandoned —
        weaker evidence of protocol discipline, and counted separately for that reason.
      </p>
    </div>`;
}

export function predictionsView(bundle) {
  const { predictions, predictionAccuracy } = bundle.registries;

  const rows = predictions.map((p) => `
    <tr>
      <td class="mono">${cite(p.id, p.id)}</td>
      <td>${esc(p.subject)}</td>
      <td>${esc(p.statement)}</td>
      <td>${p.grade === 'confirmed' ? pill('confirmed', 'ok')
        : p.grade === 'falsified' ? pill('falsified', 'bad')
        : p.grade === 'partially-confirmed' ? pill('partial', 'warn') : pill('pending', 'pending')}</td>
      <td class="mono">${esc(p.registeredIn)}</td>
    </tr>
    ${p.components?.length ? `<tr><td></td><td colspan="4">${p.components.map((c) =>
      `<div class="note">${c.held ? '✓' : '✕'} ${esc(c.claim)}</div>`).join('')}</td></tr>` : ''}
    ${p.outcome ? `<tr><td></td><td colspan="4" class="note">outcome: ${esc(p.outcome)}</td></tr>` : ''}
    ${p.lesson ? `<tr><td></td><td colspan="4" class="note">lesson: ${esc(p.lesson)}</td></tr>` : ''}`).join('');

  return `
    <h2>Predictions</h2>
    <p class="sub">
      Predictions are registered before adaptation; the commit column is the evidence that they were.
      Partial credit is not counted toward accuracy, and the surprise rate is reported rather than
      minimized — a program with no falsifications is not being tested.
    </p>
    <div class="card"><div class="grid three">
      <div class="metric"><span class="value">${predictionAccuracy.total}</span><span class="label">registered</span></div>
      <div class="metric"><span class="value">${predictionAccuracy.graded}</span><span class="label">graded</span></div>
      <div class="metric"><span class="value vis-observed">${predictionAccuracy.confirmed}</span><span class="label">confirmed</span></div>
      <div class="metric"><span class="value vis-reconstructed">${predictionAccuracy.partiallyConfirmed}</span><span class="label">partial</span></div>
      <div class="metric"><span class="value vis-inferred">${predictionAccuracy.falsified}</span><span class="label">falsified</span></div>
      <div class="metric"><span class="value">${num(predictionAccuracy.accuracy)}</span><span class="label">accuracy</span></div>
      <div class="metric"><span class="value">${num(predictionAccuracy.surpriseRate)}</span><span class="label">surprise rate</span></div>
      <div class="metric"><span class="value">${predictionAccuracy.auditable ? '✓' : '✕'}</span><span class="label">auditable</span></div>
    </div></div>
    <div class="card">
      <table><thead><tr><th>id</th><th>subject</th><th>statement</th><th>grade</th><th>registered in</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

/* ─────────────────────────────────────────────── O7 Projection laboratory */

export function projectionLabView(bundle) {
  const { projectionClaims, projectionProfile, predictions } = bundle.registries;

  const rows = projectionClaims.map((c) => {
    const pred = predictions.find((p) => p.id === c.prediction);
    return `<tr>
      <td class="mono">${esc(c.id)}</td>
      <td>${esc(c.claim)}</td>
      <td>${c.grade === 'experimentally-grounded' ? pill('grounded', 'ok')
        : c.grade === 'fixture-supported' ? pill('fixture', 'warn') : pill('hypothesis', 'bad')}</td>
      <td>${pill(c.provenance)}</td>
      <td class="note">${esc(c.basis)}</td>
      <td class="note">${esc(c.wouldBeGroundedBy)}</td>
      <td>${pred ? cite(pred.id, pred.id) : ''}</td>
    </tr>`;
  }).join('');

  const ind = projectionProfile.byIndependence;

  return `
    <h2>Projection laboratory</h2>
    <p class="sub">
      Projection currently carries more explanatory weight than any other concept, and its claims are not
      equally supported. Pre-registered experiments are listed but <strong>not evaluated here</strong> —
      the Observatory cannot upgrade a hypothesis.
    </p>

    <div class="card"><div class="grid three">
      <div class="metric"><span class="value vis-observed">${projectionProfile.grounded}</span><span class="label">experimentally grounded</span></div>
      <div class="metric"><span class="value vis-reconstructed">${projectionProfile.fixtureSupported}</span><span class="label">fixture-supported</span></div>
      <div class="metric"><span class="value vis-inferred">${projectionProfile.hypotheses}</span><span class="label">architectural hypotheses</span></div>
      <div class="metric"><span class="value">${num(projectionProfile.groundedFraction)}</span><span class="label">grounded fraction</span></div>
    </div></div>

    <div class="card">
      <h3>Independence of support</h3>
      <div class="grid three">
        <div class="metric"><span class="value">${ind.high}</span><span class="label">high</span></div>
        <div class="metric"><span class="value ${ind.medium ? '' : 'vis-inferred'}">${ind.medium}</span><span class="label">medium</span></div>
        <div class="metric"><span class="value">${ind.low}</span><span class="label">low</span></div>
        <div class="metric"><span class="value">${ind.none}</span><span class="label">none</span></div>
      </div>
      ${ind.medium === 0 ? `<p class="note">
        There is currently <strong>no independent adversarial test</strong> anywhere in the projection
        evidence. A fixture written against the API it was designed alongside cannot falsify that design.</p>` : ''}
    </div>

    <div class="card">
      <h3>Claims</h3>
      <table><thead><tr><th>claim</th><th></th><th>maturity</th><th>provenance</th><th>basis</th><th>would be grounded by</th><th>prediction</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>

    <div class="card">
      <h3>Recorded projection surfaces</h3>
      <p class="note">Replayable in the Replay mode's Projection pane. Listed here as inputs, not results.</p>
      <table><thead><tr><th>projection</th><th>scope</th><th>anomalies</th><th>obligations</th></tr></thead>
      <tbody>${bundle.projections.map((p) => `
        <tr><td class="mono">${esc(p.definitionId)}</td><td>${esc(p.scope)}</td>
        <td>${p.result.anomalies.length ? pill(p.result.anomalies.length + '', 'bad') : pill('0', 'ok')}</td>
        <td class="mono">${p.result.obligations.length}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

/* ────────────────────────────────────────────────────── O8 Ablation viewer */

const REQUESTED_ABLATIONS = [
  { label: 'remove projection', element: 'Projection', form: 'removal' },
  { label: 'remove lifecycle', element: 'Lifecycle', form: 'removal' },
  { label: 'collapse relations', element: 'Relations', form: 'collapse' },
  { label: 'collapse operations', element: 'Operations', form: 'collapse' },
];

export function ablationView(bundle) {
  const records = bundle.ablations;

  const requested = REQUESTED_ABLATIONS.map((req) => {
    const match = records.find((r) =>
      r.element.toLowerCase().includes(req.element.toLowerCase()) && r.form.toLowerCase() === req.form);
    if (match) {
      const i = records.indexOf(match);
      return `<tr>
        <td>${esc(req.label)}</td><td>${pill('supported', 'ok')}</td>
        <td>${pill(match.classification, 'accent')}</td>
        <td class="note">${esc(match.observed)}</td><td>${cite(`ablation:${i}`)}</td></tr>`;
    }
    return `<tr>
      <td>${esc(req.label)}</td><td>${pill('unsupported', 'pending')}</td><td>—</td>
      <td class="note">No executed ablation experiment records this transformation for
        <span class="mono">${esc(req.element)}</span>. The Observatory will not render a result the
        harness did not produce.</td><td></td></tr>`;
  }).join('');

  const all = records.map((r, i) => `
    <tr>
      <td class="mono">${esc(r.element)}</td>
      <td>${pill(r.form)}</td>
      <td>${pill(r.classification, 'accent')}</td>
      <td class="note">${esc(r.hypothesis)}</td>
      <td class="note">${esc(r.observed)}</td>
      <td>${cite(`ablation:${i}`)}</td>
    </tr>`).join('');

  return `
    <h2>Ablation viewer</h2>
    <p class="sub">
      Executed ablation results only. Where no experiment exists for a requested transformation, the
      viewer states that rather than rendering an empty result as a finding.
    </p>

    <div class="card">
      <h3>Requested ablations</h3>
      <table><thead><tr><th>ablation</th><th>support</th><th>classification</th><th>observed / why not</th><th></th></tr></thead>
      <tbody>${requested}</tbody></table>
    </div>

    <div class="card">
      <h3>All executed ablations (${records.length})</h3>
      <table><thead><tr><th>element</th><th>form</th><th>classification</th><th>hypothesis</th><th>observed</th><th></th></tr></thead>
      <tbody>${all}</tbody></table>
    </div>`;
}

/* ────────────────────────────────────────────── O9 Cross-version inspection */

export function crossVersionView(bundle, state) {
  const other = state.comparisonBundle;

  if (!other) {
    return `
      <h2>Cross-version inspection</h2>
      <p class="sub">
        Compares the <strong>scientific state</strong> of two captured revisions — contract, discoveries,
        negative results, prediction accuracy, churn — not source text.
      </p>
      <div class="card">
        <h3>One revision loaded</h3>
        <p>Current: <span class="mono">${esc(bundle.revision.commit)}</span> ·
           core <span class="mono">${esc(bundle.revision.coreVersion)}</span></p>
        <p class="note">
          Only one revision is available in this checkout, so no comparison is shown. Capture a second
          revision (<span class="mono">node scripts/emit-observatory-bundle.mjs --out other.json</span> at
          another commit) and load it below. A fabricated baseline would make the diff meaningless.
        </p>
        <p><input type="file" id="load-comparison" accept="application/json" /></p>
      </div>`;
  }

  const dIds = (b) => new Set(b.registries.discoveries.map((d) => d.id));
  const added = [...dIds(bundle)].filter((id) => !dIds(other).has(id));
  const removed = [...dIds(other)].filter((id) => !dIds(bundle).has(id));

  const regraded = bundle.registries.predictions.filter((p) => {
    const prev = other.registries.predictions.find((q) => q.id === p.id);
    return prev && prev.grade !== p.grade;
  }).map((p) => {
    const prev = other.registries.predictions.find((q) => q.id === p.id);
    return `<tr><td class="mono">${esc(p.id)}</td><td>${pill(prev.grade)} → ${pill(p.grade, 'accent')}</td><td>${esc(p.subject)}</td></tr>`;
  }).join('');

  const delta = (a, b) => {
    const d = a - b;
    return `${a} <span class="note">(${d === 0 ? 'unchanged' : d > 0 ? `+${d}` : d})</span>`;
  };

  return `
    <h2>Cross-version inspection</h2>
    <p class="sub">
      <span class="mono">${esc(other.revision.commit)}</span> →
      <span class="mono">${esc(bundle.revision.commit)}</span>. Scientific state only.
    </p>

    <div class="card"><div class="grid three">
      <div class="metric"><span class="value">${delta(bundle.registries.discoveries.length, other.registries.discoveries.length)}</span><span class="label">discoveries</span></div>
      <div class="metric"><span class="value">${delta(bundle.registries.negativeResults.length, other.registries.negativeResults.length)}</span><span class="label">negative results</span></div>
      <div class="metric"><span class="value">${delta(bundle.registries.corpusLedger.totalChurn, other.registries.corpusLedger.totalChurn)}</span><span class="label">total churn</span></div>
      <div class="metric"><span class="value">${delta(bundle.registries.corpusLedger.adapted, other.registries.corpusLedger.adapted)}</span><span class="label">adapted substrates</span></div>
      <div class="metric"><span class="value">${num(bundle.registries.predictionAccuracy.accuracy)} <span class="note">was ${num(other.registries.predictionAccuracy.accuracy)}</span></span><span class="label">accuracy</span></div>
      <div class="metric"><span class="value">${num(bundle.registries.predictionAccuracy.surpriseRate)} <span class="note">was ${num(other.registries.predictionAccuracy.surpriseRate)}</span></span><span class="label">surprise rate</span></div>
    </div></div>

    <div class="card">
      <h3>Registry evolution</h3>
      <table><tbody>
        <tr><td>discoveries added</td><td class="mono">${esc(added.join(', ') || 'none')}</td></tr>
        <tr><td>discoveries no longer present</td><td class="mono">${removed.length ? esc(removed.join(', ')) + ' ⚠' : 'none'}</td></tr>
      </tbody></table>
      ${removed.length ? `<p class="note">Discovery identifiers are permanent — a disappearance indicates
        the registry was renumbered or an entry removed, which the protocol forbids.</p>` : ''}
    </div>

    <div class="card">
      <h3>Predictions regraded</h3>
      ${regraded ? `<table><thead><tr><th>id</th><th>grade</th><th>subject</th></tr></thead><tbody>${regraded}</tbody></table>`
        : '<div class="empty">no prediction changed grade between these revisions</div>'}
    </div>`;
}

/* ──────────────────────────────────── O11 Instrument: self-observation */

export function instrumentView(bundle, state) {
  const ledger = transformationLedger();
  const models = state.lastModels ?? [];
  const f = measureFidelity(bundle, models);
  const log = state.instrumentLog?.events ?? [];

  const tRows = TRANSFORMATIONS.map((t) => `
    <tr>
      <td class="mono">${esc(t.id)}</td>
      <td>${esc(t.name)}</td>
      <td>${t.classification === 'lossless' ? pill('lossless', 'ok')
        : t.classification === 'lossy-disclosed' ? pill('lossy · disclosed', 'warn')
        : pill('interpretive', 'bad')}</td>
      <td class="note">${esc(t.lossDetail)}</td>
      <td class="note">${esc(t.risk ?? '')}</td>
      <td class="note">${esc(t.mitigation ?? '')}</td>
    </tr>`).join('');

  const rRows = REFUSED_TRANSFORMATIONS.map((t) => `
    <tr><td class="mono">${esc(t.id)}</td><td>${esc(t.name)}</td><td class="note">${esc(t.reason)}</td></tr>`).join('');

  const pRows = INSTRUMENT_PREDICTIONS.map((p) => `
    <tr>
      <td class="mono">${esc(p.id)}</td>
      <td>${esc(p.hypothesis)}</td>
      <td class="note">${esc(p.failureCondition)}</td>
      <td>${pill(p.status, 'pending')}</td>
      <td class="mono">${esc(p.relatedTransformation)}</td>
    </tr>`).join('');

  const logRows = log.length
    ? log.slice(-30).reverse().map((e) => `
        <tr><td class="mono">${esc(e.id)}</td><td>${pill('instrument')}</td><td class="mono">${esc(e.action)}</td>
        <td class="note">${esc(JSON.stringify(Object.fromEntries(
          Object.entries(e).filter(([k]) => !['id', 'layer', 'action'].includes(k)))))}</td></tr>`).join('')
    : `<tr><td colspan="4" class="empty">no instrument events yet in this session</td></tr>`;

  return `
    <h2>Instrument</h2>
    <p class="sub">
      The Observatory is itself a computational system that makes claims, so it is a research subject
      like any other. This pane reports what the <strong>instrument</strong> does to evidence — not what
      the runtime established. The two must never be confused.
    </p>

    <div class="card"><div class="grid three">
      <div class="metric"><span class="value">${ledger.total}</span><span class="label">transformations named</span></div>
      <div class="metric"><span class="value vis-observed">${ledger.lossless}</span><span class="label">lossless</span></div>
      <div class="metric"><span class="value vis-reconstructed">${ledger.lossyDisclosed}</span><span class="label">lossy · disclosed</span></div>
      <div class="metric"><span class="value vis-inferred">${ledger.interpretive}</span><span class="label">interpretive</span></div>
      <div class="metric"><span class="value">${ledger.refused}</span><span class="label">refused</span></div>
      <div class="metric"><span class="value">${ledger.allDisclosed ? '✓' : '✕'}</span><span class="label">all disclosed</span></div>
    </div></div>

    <div class="card">
      <h3>Fidelity</h3>
      <table><tbody>
        <tr><td>trace completeness</td><td class="mono">${f.traceCompleteness === null ? 'no model rendered yet' : num(f.traceCompleteness)}</td>
          <td class="note">fraction of visible factual statements resolving to evidence</td></tr>
        <tr><td>transformation disclosure</td><td class="mono">${num(f.transformationDisclosure)}</td>
          <td class="note">fraction of lossy/interpretive transformations disclosed</td></tr>
        <tr><td>semantic distinction preserved</td><td>${f.semanticDistinctionPreserved ? pill('yes', 'ok') : pill('COLLAPSED', 'bad')}</td>
          <td class="note">${f.statusKindsTracked} status kinds kept distinct after rendering</td></tr>
        <tr><td>replay fidelity</td><td>${f.replayFidelityExact ? pill('exact', 'ok') : pill('drifted', 'bad')}</td>
          <td class="note">rendered state at cursor n equals recorded state at n</td></tr>
        <tr><td>revision fidelity</td><td>${f.revisionFidelity.compatible ? pill('compatible', 'ok') : pill('refused', 'warn')}</td>
          <td class="note">${esc(f.revisionFidelity.reason)}</td></tr>
        <tr><td>interpretation error</td><td>${pill('not measured', 'pending')}</td>
          <td class="note">${esc(f.interpretationError.reason)} — <strong>not measured is not zero</strong></td></tr>
      </tbody></table>
    </div>

    <div class="card">
      <h3>Transformation ledger</h3>
      <table><thead><tr><th>id</th><th>transformation</th><th>class</th><th>information loss</th><th>risk</th><th>mitigation</th></tr></thead>
      <tbody>${tRows}</tbody></table>
      <p class="note">The target is not zero transformations — a visualization necessarily transforms.
        The target is explicit, bounded, inspectable transformation.</p>
    </div>

    <div class="card">
      <h3>Refused transformations</h3>
      <table><thead><tr><th>id</th><th>would have</th><th>why it is refused</th></tr></thead><tbody>${rRows}</tbody></table>
    </div>

    <div class="card">
      <h3>Instrument predictions</h3>
      <table><thead><tr><th>id</th><th>hypothesis</th><th>failure condition</th><th>status</th><th>concerns</th></tr></thead>
      <tbody>${pRows}</tbody></table>
      <p class="note">Registered separately from the FCI prediction registry: mixing claims about a user
        interface into the theory's accuracy metric would contaminate it. None has been tested.</p>
    </div>

    <div class="card">
      <h3>Instrument trace <span class="note">(this session — ${log.length} event(s))</span></h3>
      <table><thead><tr><th>id</th><th>layer</th><th>action</th><th>detail</th></tr></thead><tbody>${logRows}</tbody></table>
      <p class="note">A reviewer's path through the instrument is an episode <em>of the instrument</em>.
        Instrument ids are <span class="mono">I-</span> prefixed so they can never be mistaken for
        subject evidence.</p>
    </div>`;
}
