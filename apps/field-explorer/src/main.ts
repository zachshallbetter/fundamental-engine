import { FieldField } from '@fundamental-engine/vanilla';
import './style.css';

const field = new FieldField({
  canvas: document.querySelector<HTMLCanvasElement>('.particle-inspector')!,
  render: 'trails',
  accent: '#8acbff',
  gradientCool: '#287fff',
  gradientWarm: '#ffd05c',
  palette: ['#ffb83f', '#318cff', '#55d2ef', '#b68bff'],
  density: 1.1,
  mass: true,
  background: 'transparent',
  dprCap: 1.5,
});

field.scan();

const declaredCount = document.querySelector<HTMLElement>('#declared-count')!;
declaredCount.textContent = String(document.querySelectorAll('[data-body]').length).padStart(2, '0');

const bodySelect = document.querySelector<HTMLSelectElement>('#body-select')!;
const strengthRange = document.querySelector<HTMLInputElement>('#detail-strength-range')!;
const inboxRange = document.querySelector<HTMLInputElement>('#strength-range')!;
const strengthValue = document.querySelector<HTMLOutputElement>('#detail-strength-value')!;
const inboxStrengthValue = document.querySelector<HTMLOutputElement>('#inbox-strength-value')!;
const attributeValue = document.querySelector<HTMLElement>('#attribute-value')!;
const queryOutput = document.querySelector<HTMLElement>('#query-output')!;
const particleCountLabel = document.querySelector<HTMLElement>('#particle-count-label')!;
const liveParticles = document.querySelector<HTMLElement>('#live-particles')!;
const liveBodies = document.querySelector<HTMLElement>('#live-bodies')!;
const copyQuery = document.querySelector<HTMLButtonElement>('#copy-query')!;
const stage = document.querySelector<HTMLElement>('#particle-stage')!;
const stageCanvas = document.querySelector<HTMLCanvasElement>('.stage-particle-view')!;
const stageContext = stageCanvas.getContext('2d');
const stageInstruction = document.querySelector<HTMLElement>('#stage-instruction')!;
const ring = document.querySelector<HTMLElement>('.particle-ring')!;
const selectedParticle = document.querySelector<HTMLElement>('#selected-particle')!;
const selectedPosition = document.querySelector<HTMLElement>('#selected-position')!;
const particleCount = field.particleCount();
const particlePositions = new Float32Array(particleCount * 5);
const particleIds = new Uint32Array(particleCount);
let selectedId: number | null = null;
let latestParticleCount = 0;
let lastQueryAt = 0;

const bodyFor = (value: string): HTMLElement => {
  if (value === 'hero') return document.querySelector<HTMLElement>('.hero-object-large')!;
  if (value.startsWith('inbox-')) return document.querySelectorAll<HTMLElement>('.inbox-row')[Number(value.split('-')[1])]!;
  return document.querySelector<HTMLElement>(`[data-response="${value}"]`)!;
};

const inboxFeedback = document.querySelector<HTMLElement>('#inbox-feedback')!;
const heroFocusButton = document.querySelector<HTMLButtonElement>('#hero-focus-button')!;
const heroFocusFeedback = document.querySelector<HTMLElement>('#hero-focus-feedback')!;
const dataFeedback = document.querySelector<HTMLElement>('#data-feedback')!;
const snapshotToggle = document.querySelector<HTMLButtonElement>('#snapshot-toggle')!;
const queryModeLabel = document.querySelector<HTMLElement>('#query-mode-label')!;
let snapshotMode = false;
let capturedSnapshot: unknown;
let renderMode: 'trails' | 'dots' | 'none' = 'trails';

heroFocusButton.addEventListener('click', () => {
  const active = heroFocusButton.getAttribute('aria-pressed') !== 'true';
  heroFocusButton.setAttribute('aria-pressed', String(active));
  if (active) {
    const target = document.querySelector<HTMLElement>('.hero-art')!.getBoundingClientRect();
    field.flowTo(target.left + target.width / 2, target.top + target.height / 2);
    heroFocusButton.firstChild!.textContent = 'Release the field focus ';
    heroFocusFeedback.textContent = 'A flow focus is acting on the existing particle pool; the page elements remain the field bodies.';
  } else {
    field.clearFlow();
    heroFocusButton.firstChild!.textContent = 'Focus the field here ';
    heroFocusFeedback.textContent = 'The temporary focus is cleared; the same particles continue under the page’s declared forces.';
  }
});
new IntersectionObserver(([entry]) => {
  if (entry?.isIntersecting || heroFocusButton.getAttribute('aria-pressed') !== 'true') return;
  field.clearFlow();
  heroFocusButton.setAttribute('aria-pressed', 'false');
  heroFocusButton.firstChild!.textContent = 'Focus the field here ';
  heroFocusFeedback.textContent = 'The focus cleared as you left the hero; the page’s declared forces continue to act.';
}, { threshold: 0.05 }).observe(document.querySelector<HTMLElement>('.hero')!);

document.querySelectorAll<HTMLButtonElement>('[data-render]').forEach((button) => {
  button.addEventListener('click', () => {
    renderMode = button.dataset.render as typeof renderMode;
    field.setRender(renderMode);
    document.querySelectorAll<HTMLButtonElement>('[data-render]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    const descriptions = {
      trails: 'Trails render recent particle movement; the simulation and query remain live.',
      dots: 'The ambient field uses points without trails. The inspector also shows the same live particle buffer as points.',
      none: 'Ambient particle rendering is hidden. The inspector still shows the live read buffer; simulation and query continue.',
    };
    dataFeedback.textContent = descriptions[renderMode];
  });
});

snapshotToggle.addEventListener('click', () => {
  snapshotMode = !snapshotMode;
  if (snapshotMode) {
    capturedSnapshot = field.snapshot();
    queryOutput.textContent = JSON.stringify(capturedSnapshot, null, 2);
    snapshotToggle.setAttribute('aria-pressed', 'true');
    snapshotToggle.innerHTML = 'Return to live query <span>↻</span>';
    queryModeLabel.textContent = 'CAPTURED SNAPSHOT';
    dataFeedback.textContent = 'Showing a captured field snapshot. The simulation continues; this displayed reading stays fixed.';
  } else {
    snapshotToggle.setAttribute('aria-pressed', 'false');
    snapshotToggle.innerHTML = 'Capture a snapshot <span>＋</span>';
    queryModeLabel.textContent = 'JSON READING';
    const state = field.query();
    queryOutput.textContent = JSON.stringify({ frame: state.frame, bodies: state.bodies.length, particles: latestParticleCount, metrics: state.metrics }, null, 2);
    dataFeedback.textContent = 'Live query restored; the reading will refresh as the field changes.';
  }
});

function updateRangeFill(range: HTMLInputElement) {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const progress = ((Number(range.value) - min) / (max - min)) * 100;
  range.style.setProperty('--range-progress', `${progress}%`);
}

function syncControl() {
  const element = bodyFor(bodySelect.value);
  const current = Number.parseFloat(element.dataset.strength ?? '0.5');
  strengthRange.value = String(current);
  inboxRange.value = String(current);
  strengthValue.value = current.toFixed(2);
  strengthValue.textContent = current.toFixed(2);
  inboxStrengthValue.value = current.toFixed(2);
  inboxStrengthValue.textContent = current.toFixed(2);
  updateRangeFill(strengthRange);
  updateRangeFill(inboxRange);
  attributeValue.textContent = current.toFixed(2);
  document.querySelectorAll<HTMLElement>('.response-row').forEach((row) => {
    const selected = row.dataset.response === bodySelect.value;
    row.classList.toggle('response-active', selected);
  });
  document.querySelectorAll<HTMLElement>('.inbox-row').forEach((row, index) => {
    row.classList.toggle('inbox-selected', bodySelect.value === `inbox-${index}`);
  });
  const row = bodySelect.value.startsWith('inbox-') ? document.querySelectorAll<HTMLElement>('.inbox-row')[Number(bodySelect.value.split('-')[1])] : null;
  if (row) inboxFeedback.textContent = `Selected “${row.querySelector('.question b')?.textContent}”. The slider changes this whole row’s host-authored field strength; its measured density appears at the right.`;
}

bodySelect.addEventListener('change', syncControl);
function updateStrength(range: HTMLInputElement) {
  const element = bodyFor(bodySelect.value);
  const strength = Number(range.value);
  const text = strength.toFixed(2);
  element.dataset.strength = text;
  if (bodySelect.value.startsWith('inbox-')) {
    const index = Number(bodySelect.value.split('-')[1]);
    const inboxRow = document.querySelectorAll<HTMLElement>('.inbox-row')[index]!;
    inboxRow.dataset.strength = text;
  }
  strengthValue.value = text;
  strengthValue.textContent = text;
  inboxRange.value = text;
  inboxStrengthValue.value = text;
  inboxStrengthValue.textContent = text;
  updateRangeFill(strengthRange);
  updateRangeFill(inboxRange);
  attributeValue.textContent = text;
  if (bodySelect.value.startsWith('inbox-')) {
    const index = Number(bodySelect.value.split('-')[1]);
    const row = document.querySelectorAll<HTMLElement>('.inbox-row')[index]!;
    const subject = row.querySelector('.question b')?.textContent ?? 'Question';
    row.setAttribute('aria-label', `${subject}, urgency ${text}`);
  }
  const response = document.querySelector<HTMLElement>(`[data-response="${bodySelect.value}"]`);
  response?.querySelector('.response-strength')?.replaceChildren(text);
  if (bodySelect.value.startsWith('inbox-')) inboxFeedback.textContent = `Host input updated to ${text}. The row order and inbox data stay fixed; compare the per-row density readings as the field responds.`;
}
strengthRange.addEventListener('input', () => updateStrength(strengthRange));
inboxRange.addEventListener('input', () => updateStrength(inboxRange));

document.querySelectorAll<HTMLElement>('.inbox-row').forEach((row, index) => {
  const id = `inbox-${index}`;
  row.addEventListener('focus', () => {
    bodySelect.value = id;
    syncControl();
  });
  row.addEventListener('mouseenter', () => {
    bodySelect.value = id;
    syncControl();
  });
  row.addEventListener('click', () => {
    bodySelect.value = id;
    syncControl();
  });
});

const connectToggle = document.querySelector<HTMLInputElement>('#connect-toggle');
connectToggle?.addEventListener('change', () => {
  field.setCausality(connectToggle.checked);
  inboxFeedback.textContent = connectToggle.checked ? 'Connections enabled: field activity can spill between nearby bodies.' : 'Connections disabled: each body responds without cross-body causality.';
});
document.querySelector<HTMLButtonElement>('#reset-field')?.addEventListener('click', () => {
  const defaults = ['1.3', '0.85', '0.46', '0.2'];
  document.querySelectorAll<HTMLElement>('.inbox-row').forEach((row, index) => {
    row.dataset.strength = defaults[index]!;
    row.setAttribute('aria-label', `${row.querySelector('.question b')?.textContent ?? 'Question'}, urgency ${defaults[index]}`);
  });
  document.querySelectorAll<HTMLElement>('.response-row').forEach((row, index) => {
    row.dataset.strength = defaults[index]!;
    row.querySelector('.response-strength')!.textContent = Number(defaults[index]).toFixed(2);
  });
  bodySelect.value = 'inbox-0';
  syncControl();
  inboxFeedback.textContent = 'Inbox strengths restored to their starting values.';
});

document.querySelectorAll<HTMLElement>('.response-row').forEach((row) => {
  const select = () => {
    bodySelect.value = row.dataset.response!;
    syncControl();
  };
  row.addEventListener('click', select);
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    select();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-evidence]').forEach((node) => {
  node.addEventListener('click', () => {
    const selection = node.dataset.evidence!;
    document.querySelectorAll<HTMLElement>('[data-evidence]').forEach((item) => item.classList.toggle('evidence-active', item === node));
    document.querySelectorAll<SVGPathElement>('[data-edge]').forEach((edge) => {
      edge.classList.toggle('edge-active', selection === 'links' || edge.dataset.edge?.includes(selection === 'source-a' ? 'source-a' : selection === 'source-b' ? 'source-b' : selection));
    });
    const messages: Record<string, string> = {
      claim: 'Host supplied the claim and confidence value (0.82). The engine does not assess whether either is true.',
      'source-a': 'The host declared Release metrics as supporting the claim. The field exposes the relationship; it does not validate the source.',
      'source-b': 'The host declared the Support ticket as partial support. That relationship is application data.',
      links: 'The visible edges are host-declared links. The engine does not infer or verify them.',
    };
    document.querySelector<HTMLElement>('#evidence-feedback')!.textContent = messages[selection]!;
  });
});

const verbDescriptions = [
  'Declare: the host chooses which elements or records participate by providing bodies and relationships.',
  'Influence: the engine applies declared force tokens and accumulates their effects in the shared field.',
  'Read: query() exposes current engine state; snapshot() captures a serializable reading.',
  'Reveal: the host chooses how to project returned signals into CSS, DOM, JSON, or another renderer.',
  'Govern: permissions, policies, data meaning, and decisions remain under host control.',
];
document.querySelectorAll<HTMLElement>('.verb-row').forEach((row, index) => {
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  const select = () => {
    document.querySelectorAll<HTMLElement>('.verb-row').forEach((item) => item.classList.toggle('verb-active', item === row));
    document.querySelector<HTMLElement>('#verb-feedback')!.textContent = verbDescriptions[index]!;
  };
  row.addEventListener('click', select);
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    select();
  });
});

const pathDescriptions: Record<string, string> = {
  'path-web': 'Web interfaces: DOM elements can declare bodies, and the DOM host can project field feedback into page styles.',
  'path-3d': '3D and custom views: connect the field to a renderer you already use; this card does not imply a required Three.js dependency.',
  'path-data': 'Data and evidence: the host maps records and declared relationships into bodies and edges, then reads field state.',
  'path-ai': 'AI and agents: applications can expose declared context and field readings; the host remains responsible for policy and decisions.',
};
document.querySelectorAll<HTMLAnchorElement>('.path-card').forEach((card) => {
  card.addEventListener('focus', () => { document.querySelector<HTMLElement>('#path-feedback')!.textContent = pathDescriptions[card.classList[1]!]!; });
  card.addEventListener('pointerenter', () => { document.querySelector<HTMLElement>('#path-feedback')!.textContent = pathDescriptions[card.classList[1]!]!; });
});

const trustDescriptions: Record<string, string> = {
  data: 'Inspect the authored DOM and data-* values: they belong to the host application.',
  signals: 'Read returned CSS variables or query() state to inspect engine measurements; these are separate from host-authored meaning.',
  renderers: 'setRender() changes the engine’s particle rendering. A custom renderer can instead read the same field through its host API.',
  policy: 'The host controls policy and access. Field readings do not grant an agent permission to act.',
};
document.querySelectorAll<HTMLButtonElement>('.trust-fact').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.trust-fact').forEach((item) => item.classList.toggle('trust-active', item === button));
    document.querySelector<HTMLElement>('#trust-feedback')!.textContent = trustDescriptions[button.dataset.trust!]!;
  });
});

document.querySelectorAll<HTMLElement>('.path-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('.path-card').forEach((item) => item.classList.toggle('path-active', item === card));
  });
});

function particleAt(x: number, y: number, limit = 24): { id: number; x: number; y: number; distance: number } | null {
  const count = field.readParticles(particlePositions);
  field.readParticleIds(particleIds);
  latestParticleCount = count;
  const stageRect = stage.getBoundingClientRect();
  let nearest: { id: number; x: number; y: number; distance: number } | null = null;
  for (let i = 0; i < count; i++) {
    const px = particlePositions[i * 5]!;
    const py = particlePositions[i * 5 + 1]!;
    if (px < stageRect.left || px > stageRect.right || py < stageRect.top || py > stageRect.bottom) continue;
    const distance = Math.hypot(px - x, py - y);
    if (distance < limit && (!nearest || distance < nearest.distance)) nearest = { id: particleIds[i]!, x: px, y: py, distance };
  }
  return nearest;
}

function chooseParticle(x: number, y: number, limit = Number.POSITIVE_INFINITY) {
  const found = particleAt(x, y, limit);
  if (!found) {
    stageInstruction.textContent = 'No particle close by — try another spot';
    return;
  }
  selectedId = found.id;
  selectedParticle.textContent = `particle id ${found.id}`;
  stageInstruction.textContent = 'Following this live particle';
  ring.classList.add('is-visible');
}

stage.addEventListener('pointerdown', (event) => chooseParticle(event.clientX, event.clientY));
stage.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  const rect = stage.getBoundingClientRect();
  chooseParticle(rect.left + rect.width / 2, rect.top + rect.height / 2, Math.max(rect.width, rect.height));
});

function sizeStageCanvas() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  stageCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  stageCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  stageCanvas.style.width = `${rect.width}px`;
  stageCanvas.style.height = `${rect.height}px`;
  stageContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(sizeStageCanvas).observe(stage);
sizeStageCanvas();

function updateParticleRing() {
  const count = field.readParticles(particlePositions);
  const idsCount = field.readParticleIds(particleIds);
  latestParticleCount = Math.min(count, idsCount);
  if (stageContext) {
    const rect = stage.getBoundingClientRect();
    stageContext.clearRect(0, 0, rect.width, rect.height);
    stageContext.globalCompositeOperation = 'lighter';
    for (let i = 0; i < latestParticleCount; i++) {
      const x = particlePositions[i * 5]! - rect.left;
      const y = particlePositions[i * 5 + 1]! - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) continue;
      const heat = Math.max(0, Math.min(1, particlePositions[i * 5 + 3]!));
      const radius = Math.max(1.1, particlePositions[i * 5 + 4]! * 1.15);
      stageContext.fillStyle = heat > 0.6 ? 'rgba(160,205,255,.92)' : 'rgba(96,190,235,.74)';
      stageContext.shadowColor = heat > 0.6 ? '#82baff' : '#50c2e8';
      stageContext.shadowBlur = 8 + heat * 7;
      stageContext.beginPath();
      stageContext.arc(x, y, radius, 0, Math.PI * 2);
      stageContext.fill();
    }
    stageContext.globalCompositeOperation = 'source-over';
    stageContext.shadowBlur = 0;
  }
  if (selectedId !== null) {
    let found = false;
    for (let i = 0; i < latestParticleCount; i++) {
      if (particleIds[i] !== selectedId) continue;
      const x = particlePositions[i * 5]!;
      const y = particlePositions[i * 5 + 1]!;
      const stageRect = stage.getBoundingClientRect();
      ring.style.left = `${x - stageRect.left}px`;
      ring.style.top = `${y - stageRect.top}px`;
      selectedPosition.textContent = `${Math.round(x)} px, ${Math.round(y)} px`;
      found = true;
      break;
    }
    if (!found) {
      selectedId = null;
      ring.classList.remove('is-visible');
      selectedParticle.textContent = 'Particle left the live pool';
      selectedPosition.textContent = '—';
    }
  }
  if (performance.now() - lastQueryAt > 100) {
    lastQueryAt = performance.now();
    const state = field.query();
    const forces: Record<string, number> = {};
    for (const body of state.bodies) {
      for (const token of body.tokens) forces[token] = (forces[token] ?? 0) + 1;
    }
    const summary = {
      frame: state.frame,
      bodies: state.bodies.length,
      particles: latestParticleCount,
      metrics: state.metrics,
      forces,
    };
    if (!snapshotMode) queryOutput.textContent = JSON.stringify(summary, null, 2);
    particleCountLabel.textContent = `${latestParticleCount} LIVE PARTICLES`;
    liveParticles.textContent = `${latestParticleCount} particles`;
    liveBodies.textContent = `${state.bodies.length} measured bodies`;
    document.querySelectorAll<HTMLElement>('.inbox-row').forEach((row) => {
      const reading = state.bodies.find((body) => body.id === row.id)?.metrics.count ?? 0;
      const output = row.querySelector<HTMLOutputElement>('.particle-sample')!;
      output.textContent = reading.toFixed(1);
      output.setAttribute('aria-label', `Weighted nearby particle sample ${reading.toFixed(1)}`);
    });
  }
  requestAnimationFrame(updateParticleRing);
}
requestAnimationFrame(updateParticleRing);

copyQuery.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(queryOutput.textContent ?? '');
    copyQuery.innerHTML = 'Copied field query <span>✓</span>';
    window.setTimeout(() => { copyQuery.innerHTML = 'Copy query JSON <span>↗</span>'; }, 1400);
  } catch {
    copyQuery.textContent = 'Select the JSON above to copy';
  }
});

window.addEventListener('pagehide', () => field.destroy(), { once: true });
syncControl();
