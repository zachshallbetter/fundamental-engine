/* ──────────────────────────────────
   FORCES DS — THE FIELD III: Lab
   A contained sandbox for the reciprocal field. Pick a brush, click the
   stage to drop a real DOM body the engine reads, drag it, remove it,
   switch the global formation, clear. Same mechanism the site uses —
   gated by the Reciprocal Field toggle. Chips are managed imperatively
   so React never fights the engine's inline transforms.
────────────────────────────────── */
const { useState: useStateL, useEffect: useEffectL, useRef: useRefL } = React;

const LAB_TUNE = {
  attract: { body: 'attract', strength: 0.9, range: 320 },
  repel:   { body: 'repel', strength: 1.1, range: 300 },
  absorb:  { body: 'absorb attract', strength: 0.6, range: 300, absorb: 80, max: 40 },
  vortex:  { body: 'vortex', strength: 1, range: 320, spin: 1 },
  stream:  { body: 'stream', strength: 1, range: 340, angle: 0 },
  drag:    { body: 'drag', strength: 1, range: 300 },
  spring:  { body: 'spring', strength: 1, range: 260 },
  emitter: { body: 'emitter', strength: 1, range: 300, angle: 0 },
};
const LAB_BRUSHES = ['attract', 'repel', 'absorb', 'vortex', 'stream', 'drag', 'spring', 'emitter'];
const LAB_FORMS = [['ambient', 'Ambient'], ['wells', 'Wells'], ['lanes', 'Lanes'], ['scatter', 'Scatter'], ['accretion', 'Accretion']];

function LabView({ live, setLive }) {
  const FBY = window.DS_FORCE_BY || {};
  const [brush, setBrush] = useStateL('attract');
  const [form, setForm] = useStateL('ambient');
  const [count, setCount] = useStateL(0);
  const stageRef = useRefL(null);
  const nodesRef = useRefL(null);
  const brushRef = useRefL('attract');
  const liveRef = useRefL(live);

  useEffectL(() => { brushRef.current = brush; }, [brush]);
  useEffectL(() => { liveRef.current = live; }, [live]);

  const colorOf = (id) => (FBY[id] && FBY[id].color) || '#4da3ff';

  const drop = (clientX, clientY) => {
    const stage = stageRef.current, nodes = nodesRef.current;
    if (!stage || !nodes) return;
    const r = stage.getBoundingClientRect();
    const tool = brushRef.current, t = LAB_TUNE[tool], color = colorOf(tool);
    const chip = document.createElement('span');
    chip.className = 'body-chip lab-chip';
    chip.style.left = (clientX - r.left) + 'px';
    chip.style.top = (clientY - r.top) + 'px';
    chip.style.transform = 'translate(-50%,-50%)';
    chip.style.setProperty('--cc', color);
    chip.dataset.drag = '';
    chip.dataset.hot = '';
    chip.dataset.body = t.body;
    chip.dataset.strength = t.strength;
    chip.dataset.range = t.range;
    chip.dataset.color = color;
    if (t.absorb) { chip.dataset.absorb = t.absorb; chip.dataset.max = t.max; }
    if (t.spin !== undefined) chip.dataset.spin = t.spin;
    if (t.angle !== undefined) chip.dataset.angle = t.angle;
    chip.innerHTML = '<i class="g g-' + tool + '"></i><span class="lab-chip-name">' + tool + '</span><button class="chip-x" type="button" aria-label="remove">\u00d7</button>';
    nodes.appendChild(chip);
    setCount(nodes.children.length);
    const f = window.__field;
    if (window.DSInteractions) window.DSInteractions.rescan(stage);
    if (f && f.rescan) f.rescan();
    if (f && f.burst) f.burst(clientX, clientY, color);
  };

  const clearAll = () => {
    const nodes = nodesRef.current; if (!nodes) return;
    nodes.innerHTML = ''; setCount(0);
    const f = window.__field; if (f) { if (f.rescan) f.rescan(); if (f.threads) f.threads(null); }
  };

  const applyForm = (id) => { setForm(id); const f = window.__field; if (f && f.setFormation) f.setFormation(id); };

  useEffectL(() => {
    const stage = stageRef.current, nodes = nodesRef.current; if (!stage || !nodes) return;
    const onDown = (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.body-chip, .chip-x, .lab-rail, button')) return;
      if (!liveRef.current) {
        const tg = document.querySelector('.field-toggle');
        if (tg) { tg.classList.remove('nudge'); void tg.offsetWidth; tg.classList.add('nudge'); setTimeout(() => tg.classList.remove('nudge'), 700); }
        return;
      }
      drop(e.clientX, e.clientY);
    };
    const onClick = (e) => {
      const x = e.target.closest('.chip-x'); if (!x) return;
      e.stopPropagation(); const chip = x.closest('.body-chip'); if (chip) chip.remove();
      setCount(nodes.children.length);
      const f = window.__field; if (f) { if (f.rescan) f.rescan(); if (f.threads) f.threads(null); }
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('click', onClick);
    return () => { stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('click', onClick); };
  }, []);

  // reset the field formation when leaving
  useEffectL(() => () => { const f = window.__field; if (f && f.setFormation) f.setFormation('ambient'); }, []);

  return (
    <>
      <PageHero eyebrow="The Field · Lab" counter="07 / 11" title="Build a field" titleEm="with your hands."
        meta={[{ text: 'real engine', live: true }, { text: '8 forces · 5 formations' }, { text: 'lab.js' }]} />

      <SectionHeader id="lab-intro" num="01" title="The Lab" desc="Everything on the Forces page in one sandbox. Activate the Reciprocal Field, pick a brush, and click the stage to drop a real body the engine reads. Drag bodies to move their force, hover to wire threads, switch the global formation, and clear to start over." />

      <SectionHeader id="lab-tools" num="02" title="Brushes" desc="Eight forces to paint with. The active brush colors what you drop next." />
      <div className="lab-rail">
        {LAB_BRUSHES.map(id => (
          <button key={id} className={'lab-brush' + (brush === id ? ' on' : '')} onClick={() => setBrush(id)} style={{ '--cc': colorOf(id) }}>
            <i className={'g g-' + id} style={{ width: 18, height: 18 }} />
            <span>{id}</span>
          </button>
        ))}
      </div>

      <SectionHeader id="lab-stage" num="03" title="Sandbox" desc="Click to drop · drag to move · hover to wire · × to remove." />
      <div className="lab-toolbar">
        <div className="ds-seg lab-forms">
          {LAB_FORMS.map(f => <button key={f[0]} className={form === f[0] ? 'on' : ''} onClick={() => applyForm(f[0])}>{f[1]}</button>)}
        </div>
        <span className="lab-status mono">{count} {count === 1 ? 'body' : 'bodies'} · dropping <b style={{ color: colorOf(brush) }}>{brush}</b></span>
        <button className="ds-btn ghost sm lab-clear" onClick={clearAll} style={{ borderColor: 'var(--line-2)' }}>↻ Clear</button>
      </div>
      <DemoStage label="LAB" hint="click the field to drop a body" height={400}>
        <div className="lab-nodes" ref={nodesRef}></div>
        <div className="lab-stage-hit" ref={stageRef}></div>
      </DemoStage>

      <PageFooter left="Forces — Design System" right="07 · Lab" />
    </>
  );
}

window.LabView = LabView;
