/* ──────────────────────────────────
   FORCES DS — THE FIELD II: Forces (the signature surface)
   Reciprocity · the nine-force set · anatomy · per-force formulas ·
   drag a body · agitate · accretion + mass meter · conditions ·
   threads · reciprocal feedback. Every live demo drives the REAL engine
   (window.__field) through ds-interactions.js — gated by the Reciprocal
   Field toggle. Data: window.DS_FORCES / DS_CONDITIONS.
────────────────────────────────── */
const { useState: useStateX, useEffect: useEffectX } = React;

function ForcesView() {
  const FSET = window.DS_FORCES || [];
  const CONDS = window.DS_CONDITIONS || [];
  const [cond, setCond] = useStateX('');
  const condObj = CONDS.find(c => c.id === cond) || CONDS[0] || { d: '', t: 'Always', selective: false };
  const absorb = window.DS_FORCE_BY ? window.DS_FORCE_BY.absorb : null;

  return (
    <>
      <PageHero eyebrow="The Field · Forces" counter="05 / 11" title="Nine forces." titleEm="One reciprocal field."
        meta={[{ text: 'live behind this page', live: true }, { text: '9 bodies' }, { text: 'forces.js' }]} />

      {/* 01 — RECIPROCITY */}
      <SectionHeader id="f-reciprocity" num="01" title="Reciprocity" desc="The whole system in one rule: elements bend the field, and the field bends them back. Nothing is inert — every body both acts and is acted upon. That loop is what makes a page feel alive instead of decorated." />
      <div className="sg-grid cols-2">
        <div className="sg-card" style={{ '--cat': '#4da3ff' }}>
          <span className="eyebrow">Element → Field</span>
          <p style={{ color: 'var(--text-2)', fontSize: '1rem', lineHeight: 1.6, marginTop: '0.7rem' }}>A body emits its force into the medium — attracting, repelling, swirling the particles around it. The layout shapes the field.</p>
        </div>
        <div className="sg-card" style={{ '--cat': '#ff6e9c' }}>
          <span className="eyebrow" style={{ color: '#ff6e9c' }}>Field → Element</span>
          <p style={{ color: 'var(--text-2)', fontSize: '1rem', lineHeight: 1.6, marginTop: '0.7rem' }}>Where particle density gathers, the element gains weight, glow, and pull back. The field shapes the layout in return.</p>
        </div>
      </div>

      {/* 02 — FORCE SET */}
      <SectionHeader id="f-set" num="02" title="The force set" desc="Nine forces. Each glyph is a body you can drop into the field, and each maps to a discipline. With the field live, hover a card to color the whole field toward it." />
      <div className="sg-grid cols-3">
        {FSET.map(f => (
          <div className="sg-card force-card" key={f.id} data-hot data-color={f.color} data-body={f.body} {...f.attrs}
            style={{ '--cat': f.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <i className={'g g-' + f.id} style={{ width: 24, height: 24, color: f.color }} />
              <span className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{f.id}</span>
            </div>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.25rem', margin: '0.9rem 0 0.3rem' }}>{f.name}</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.5 }}>{f.does}</p>
            <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: f.color }}>{f.discipline}</div>
          </div>
        ))}
      </div>

      {/* 03 — ANATOMY */}
      <SectionHeader id="f-anatomy" num="03" title="Anatomy of a body" desc="Any element becomes a force by carrying data attributes. The engine reads them on every scan and the field responds — strength sets the pull, range the reach, color the accent, and an optional condition gates when it acts." />
      <div className="sg-grid cols-2" style={{ alignItems: 'start' }}>
        <Frame label="MARKUP" style={{ padding: '1.4rem' }}>
          <pre className="mono" style={{ fontSize: '0.76rem', lineHeight: 1.85, color: 'var(--text-2)', overflowX: 'auto', margin: 0 }}>{`<span data-hot
      data-body="vortex"
      data-color="#2dd4bf"
      data-strength="0.9"
      data-range="260"
      data-spin="1"
      data-when="fast">
  Creative technology
</span>`}</pre>
        </Frame>
        <div style={{ display: 'grid', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {[['data-body', 'the force(s) — space-joined'], ['data-strength', 'force magnitude · default 0.5'], ['data-range', 'reach in px · default 280'], ['data-color', 'accent the field bends toward'], ['data-spin', 'vortex direction · ±1'], ['data-angle', 'stream / emitter heading'], ['data-when', 'conditional gate']].map(r => (
            <div key={r[0]} style={{ background: 'var(--bg-card)', padding: '0.7rem 1rem', display: 'grid', gridTemplateColumns: '9.5rem 1fr', gap: '0.8rem', alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: '0.66rem', color: 'var(--accent)' }}>{r[0]}</span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-3)' }}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 04 — FORMULAS */}
      <SectionHeader id="f-formulas" num="04" title="The force formulas" desc="Each force is a real expression evaluated per particle, per frame — lifted straight from forces.js. The law beneath says what the math means." />
      <div className="sg-grid cols-3">
        {FSET.map(f => (
          <div className="formula-card" key={f.id} style={{ '--cat': f.color }}>
            <div className="formula-card-head">
              <i className={'g g-' + f.id} style={{ width: 18, height: 18, color: f.color }} />
              <span style={{ fontWeight: 600 }}>{f.name}</span>
            </div>
            <code className="formula-expr">{f.formula}</code>
            <p className="formula-law">{f.law}</p>
          </div>
        ))}
      </div>

      {/* 05 — DRAG A BODY */}
      <SectionHeader id="f-drag" num="05" title="Drag a body" desc="A force isn't pinned to a layout slot — move the element and the force moves with it. Activate the field, then drag the attractor across the stage and watch the particles chase it." />
      <DemoStage label="DRAG THE ATTRACTOR" hint="grab the chip · the well follows it" height={300}>
        <span className="body-chip" data-drag data-body="attract" data-color="#4da3ff" data-strength="1.1" data-range="300"
          style={{ '--cc': '#4da3ff', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          <i className="g g-attract" style={{ width: 18, height: 18 }} />Attract
        </span>
      </DemoStage>

      {/* 06 — AGITATE */}
      <SectionHeader id="f-agitate" num="06" title="Agitate" desc="A discrete burst — not a steady force. One press shoves and heats the matter around a point, sending a shockwave through the field. Use it for confirmations and arrivals." />
      <DemoStage label="A SINGLE BURST" hint="press to shove + heat nearby matter" height={260}>
        <span className="body-chip is-target" id="agitate-target" data-body="repel" data-color="#ff9d5c" data-strength="0.6" data-range="160"
          style={{ '--cc': '#ff9d5c', left: '50%', top: '46%', transform: 'translate(-50%,-50%)' }}>
          <i className="g g-repel" style={{ width: 18, height: 18 }} />Impact point
        </span>
        <button className="ds-btn agitate-btn" data-agitate="#agitate-target" style={{ '--cat': '#ff9d5c' }}>Agitate ◎</button>
      </DemoStage>

      {/* 07 — ACCRETION + METER */}
      <SectionHeader id="f-absorb" num="07" title="Accretion" desc="The absorber pulls matter in and holds it — its core swells as mass accumulates. At the cap it supernovas, releasing everything back into the field. Captured equals released; the meter reads the live mass the engine writes." />
      <DemoStage label="ABSORB → SUPERNOVA" hint="matter accretes, then pops at the cap" height={320}>
        <span className="body-core" data-body={(absorb && absorb.body) || 'absorb attract'} data-color="#ff6e9c"
          {...((absorb && absorb.attrs) || { 'data-absorb': '64', 'data-max': '30', 'data-strength': '0.8', 'data-range': '360' })}
          style={{ '--cc': '#ff6e9c', left: '50%', top: '46%' }}>
          <i className="g g-absorb" style={{ width: 22, height: 22 }} />
        </span>
        <div className="meter" aria-hidden="true"><i></i><span className="meter-label mono">mass</span></div>
      </DemoStage>

      {/* 08 — CONDITIONS */}
      <SectionHeader id="f-conditions" num="08" title="Conditions" desc="A body can gate its force on a condition — it only acts when the field is in a certain state. This keeps a page calm until it earns motion. Selective conditions read each particle; the rest read the whole field." />
      <Frame canvas label="WHEN" style={{ padding: '2rem 1.6rem' }}>
        <div className="ds-seg" style={{ marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          {CONDS.map(c => <button key={c.id || 'always'} className={cond === c.id ? 'on' : ''} onClick={() => setCond(c.id)}>{c.t}</button>)}
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '56ch' }}>{condObj.d}</p>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.9rem', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>data-when="{cond || 'always'}"</span>
          {condObj.selective && <span className="ds-badge" style={{ '--cat': '#a78bfa' }}><span className="ds-tag-dot" />per-particle</span>}
        </div>
      </Frame>

      {/* 09 — THREADS */}
      <SectionHeader id="f-threads" num="09" title="Threads" desc="Engaging one body in a set wires living threads to its siblings — pulses travel the connections, and the others dim. A list stops being a list and shows itself as a system. Activate the field and hover a chip." />
      <DemoStage label="A CONNECTED SET" hint="hover a node to wire the set" height={240}>
        <div className="thread-set" data-index data-threads>
          {[['Product', '#4da3ff'], ['System', '#2dd4bf'], ['Surface', '#a78bfa'], ['Material', '#ff9d5c'], ['Motion', '#7dd3fc']].map(t => (
            <span className="ti" key={t[0]} data-hot data-color={t[1]} data-body="attract" data-strength="0.5" data-range="200" style={{ '--cat': t[1] }}>{t[0]}</span>
          ))}
        </div>
      </DemoStage>

      {/* 10 — FEEDBACK */}
      <SectionHeader id="f-feedback" num="10" title="Reciprocal feedback" desc="The clearest expression of the loop: a word that is also a body. As particle density gathers on it, its weight rises — the field literally rewrites the type. Activate the field and watch it breathe." />
      <DemoStage label="DENSITY → WEIGHT" hint="the field gathers; the word thickens" height={220}>
        <span className="feedback-word" data-body="attract" data-feedback data-fmin="300" data-fmax="800" data-color="#86e57f" data-strength="0.9" data-range="240" style={{ '--cc': '#86e57f' }}>coherence</span>
      </DemoStage>

      <PageFooter left="Forces — Design System" right="05 · Forces" />
    </>
  );
}

window.ForcesView = ForcesView;
