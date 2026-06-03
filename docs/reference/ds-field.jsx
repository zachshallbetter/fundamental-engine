/* ──────────────────────────────────
   FORCES DS — THE FIELD I: Substrate · Formations
   Substrate = what the field is made of (sync, mass/damping, currents,
   the conservation law). Formations = how the whole field is arranged.
   All data comes from window.DS_* (ds-data.js).
────────────────────────────────── */
const { useState: useStateF, useEffect: useEffectF } = React;

/* ============ SUBSTRATE ============ */
function SubstrateView() {
  const sub = window.DS_SUBSTRATE || [];
  return (
    <>
      <PageHero eyebrow="The Field · Substrate" counter="04 / 11" title="What the field" titleEm="is made of."
        meta={[{ text: 'live behind this page', live: true }, { text: 'field.js · forces.js' }, { text: '3 properties' }]} />

      <SectionHeader id="sub-intro" num="00" title="The medium" desc="Before any force acts, there is a medium — a swarm of point-masses drifting over the page in the same coordinate space as the layout. Three properties define it: it stays synchronized to the DOM, it has mass and loses momentum to damping, and its resting drift is a current. Everything else is force applied to this." />
      <div className="sg-grid cols-3">
        {sub.map(s => (
          <div className="sg-card" key={s.no} style={{ '--cat': s.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: '0.62rem', color: s.color }}>{s.no}</span>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, boxShadow: '0 0 12px ' + s.color }} />
            </div>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.2rem', margin: '0.9rem 0 0.4rem' }}>{s.t}</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', lineHeight: 1.55 }}>{s.head}</p>
          </div>
        ))}
      </div>

      {sub.map((s, i) => (
        <React.Fragment key={s.no}>
          <SectionHeader id={['sub-sync', 'sub-mass', 'sub-currents'][i]} num={s.no} title={s.t} desc={s.body} />
          <div className="sg-grid cols-2" style={{ alignItems: 'stretch' }}>
            <Formula color={s.color}>{s.formula}</Formula>
            <div className="cell-frame" style={{ minHeight: 150, resize: 'none' }}>
              <FieldCell formation={s.no === '03' ? 'lanes' : s.no === '02' ? 'scatter' : 'ambient'} color={s.color} count={s.no === '01' ? 70 : 90} height="100%" />
              <span className="cell-resize-hint">live substrate · {s.t.toLowerCase()}</span>
            </div>
          </div>
        </React.Fragment>
      ))}

      <SectionHeader id="sub-law" num="04" title="The conservation law" desc="The thesis the whole system is built to honour: nothing is created, nothing is destroyed. Whatever a force captures, it must release. An absorber that swallows matter eventually pops it back out; a well that gathers density gives weight to the body above it. The field is a closed loop — that is what makes it read as one living system rather than decoration." />
      <Frame canvas label="CAPTURED = RELEASED" style={{ padding: '2.4rem 1.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(1rem,4vw,3rem)', flexWrap: 'wrap', textAlign: 'center' }}>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
            <i className="g g-absorb" style={{ width: 30, height: 30, color: 'var(--f-absorb)' }} />
            <span style={{ fontWeight: 600 }}>Capture</span>
            <span className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>matter in</span>
          </div>
          <span className="mono" style={{ fontSize: '1.4rem', color: 'var(--coherence)' }}>=</span>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
            <i className="g g-emitter" style={{ width: 30, height: 30, color: 'var(--coherence)' }} />
            <span style={{ fontWeight: 600 }}>Release</span>
            <span className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>matter out</span>
          </div>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', lineHeight: 1.6, textAlign: 'center', maxWidth: '56ch', margin: '1.6rem auto 0' }}>
          See it run on the <b style={{ color: 'var(--text-2)' }}>Forces</b> page — the absorber fills to a cap, then supernovas its whole captured mass back into the medium.
        </p>
      </Frame>

      <PageFooter left="Forces — Design System" right="04 · Substrate" />
    </>
  );
}

/* ============ FORMATIONS ============ */
function FormationsView() {
  const forms = window.DS_FORMATIONS || [];
  const DOTS = window.DS_DOTS || {};
  const [active, setActive] = useStateF('ambient');
  const apply = (id) => { setActive(id); const f = window.__field; if (f && f.setFormation) f.setFormation(id); };
  useEffectF(() => { apply('ambient'); const f = window.__field; if (f && f.rescan) setTimeout(f.rescan, 80); }, []);

  return (
    <>
      <PageHero eyebrow="The Field · Formations" counter="06 / 11" title="The field" titleEm="reconfigures."
        meta={[{ text: 'driving the live background', live: true }, { text: '5 formations' }, { text: 'one per section' }]} />

      <SectionHeader id="form-intro" num="01" title="What a formation is" desc="A force acts on a single body; a formation arranges the whole field. Each is a global target the swarm eases toward over ~2 seconds. Pick one to drive the live background behind this page — turn on the Reciprocal Field to feel the migration." />

      <SectionHeader id="form-set" num="02" title="The set" desc="Five formations, each mapped to a section of the portfolio. The diagram previews the arrangement; the swatch beneath runs it live. Click to apply it to the page." />
      <div className="sg-grid cols-3">
        {forms.map(f => (
          <button className={'fm-card' + (active === f.id ? ' on' : '')} key={f.id} onClick={() => apply(f.id)} style={{ '--cat': f.color }}>
            <FieldCell formation={f.id} color={active === f.id ? f.color : '#7587a0'} count={46} height={92} style={{ border: '1px solid var(--line)', marginBottom: '0.9rem' }} />
            <div className="fm-head">
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.2rem' }}>{f.t}</h3>
              <span className="fm-apply" style={active === f.id ? { color: f.color } : {}}>{active === f.id ? '● active' : 'apply →'}</span>
            </div>
            <div className="mono" style={{ fontSize: '0.54rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: f.color, marginTop: '0.5rem' }}>{f.section} · {f.cue}</div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.55, marginTop: '0.5rem' }}>{f.d}</p>
          </button>
        ))}
      </div>

      <SectionHeader id="form-journey" num="03" title="The journey" desc="Strung together, the formations are a score — the field migrates section by section as a page scrolls. Calm at the top, gathering at the close." />
      <div className="journey-rail">
        {forms.map((j, i) => (
          <button key={j.id} className={'journey-row' + (active === j.id ? ' on' : '')} onClick={() => apply(j.id)} style={{ '--cat': j.color }}>
            <span className="mono journey-no" style={{ color: j.color }}>{String(i + 1).padStart(2, '0')}</span>
            <span className="journey-dot" style={{ background: j.color }} />
            <span className="journey-sec">{j.section}</span>
            <span className="journey-cue">{j.cue}</span>
            <span className="ds-tag journey-tag" style={{ '--cat': j.color }}><span className="ds-tag-dot" />{j.t}</span>
          </button>
        ))}
      </div>

      <PageFooter left="Forces — Design System" right="06 · Formations" />
    </>
  );
}

Object.assign(window, { SubstrateView, FormationsView });
