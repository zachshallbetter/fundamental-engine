/* ──────────────────────────────────
   FIELD DS — VIEWS
────────────────────────────────── */
const { useState, useEffect } = React;
/* FORCES (legacy { f, name, c, does, maps } shape) is provided globally by
   ds-data.js as window.FORCES — the single source of truth. */
const FORCES = window.FORCES;

/* ============ BRAND ============ */
function BrandView() {
  const pillars = [
    { f: 'attract', t: 'Reciprocal', d: 'Elements bend the field; the field bends them back. Nothing is inert — every body both acts and is acted upon.' },
    { f: 'reflect', t: 'Felt before understood', d: 'The visible surface and the invisible system that holds it up are designed as one. People feel coherence before they can name it.' },
    { f: 'spring', t: 'Structured, not stiff', d: 'Load-bearing systems that still give. Constraints are forces, not walls.' },
  ];
  return (
    <>
      <div className="brand-mark-showcase">
        <ForcesMarkLive size={210} color="var(--accent)" />
        <span className="brand-mark-showcase-cap">Forces · the reciprocal field in motion</span>
      </div>
      <PageHero eyebrow="Forces · Brand" counter="01 / 11" title="A system you can" titleEm="feel."
        meta={[{ text: 'Reciprocal Field', live: true }, { text: 'Zach Shallbetter' }, { text: 'v0.1 · 2026' }]} />
      <SectionHeader id="b-mission" num="01" title="Mission" desc="The page is the idea made literal: everything you touch moves the field, and the field moves it back. The brand is that thesis, expressed as force." />
      <SectionHeader id="b-mark" num="02" title="Mark" desc="A central body with bodies caught in its reciprocal field — force, made literal. This is the primary mark: drawn and static so it stays legible at any size, from the hero to a 16px favicon. It is defined in use under Lockups & Use below." />
      <Frame canvas label="PRIMARY MARK · STATIC" style={{ minHeight: 300, display: 'grid', placeItems: 'center' }}>
        <ForcesMark s={170} color="var(--accent)" />
      </Frame>
      <SectionHeader id="b-pillars" num="03" title="Pillars" desc="Three commitments, each carried by a force." />
      <div className="sg-grid cols-3">
        {pillars.map(p => (
          <div className="sg-card" key={p.t} style={{ '--cat': FORCES.find(x => x.f === p.f)?.c }}>
            <Glyph f={p.f} s={22} color="var(--cat)" />
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.3rem', margin: '0.9rem 0 0.5rem', letterSpacing: '-0.02em' }}>{p.t}</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.96rem', lineHeight: 1.6 }}>{p.d}</p>
          </div>
        ))}
      </div>
      <SectionHeader id="b-voice" num="04" title="Voice" desc="Plain, declarative, a little physical." />
      <div className="sg-grid cols-2">
        <div className="sg-card"><span className="label-loose" style={{ color: 'var(--ok)' }}>We say</span>
          <ul style={{ listStyle: 'none', margin: '0.8rem 0 0', display: 'grid', gap: '0.6rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
            <li>“Everything you touch moves the field.”</li><li>“The interface is only the visible surface.”</li><li>“The goal is coherence.”</li></ul></div>
        <div className="sg-card"><span className="label-loose" style={{ color: 'var(--err)' }}>We avoid</span>
          <ul style={{ listStyle: 'none', margin: '0.8rem 0 0', display: 'grid', gap: '0.6rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
            <li>Hype, metrics theater, buzzwords.</li><li>“Synergy”, “revolutionary”, “game-changing”.</li><li>Decoration without behavior.</li></ul></div>
      </div>
      <SectionHeader id="b-wordmark" num="05" title="Lockups & use" desc="The mark and the word, set in Bricolage — shown with the wordmark, and as a standalone mark. Horizontal is primary; the subtitle lockup names what it is." />
      <div className="sg-grid cols-2">
        <Frame canvas label="HORIZONTAL"><div className="id-tile"><div className="id-lockup-h"><ForcesMark s={34} color="var(--accent)" /><span className="id-word" style={{ fontSize: '1.9rem' }}>Forces</span></div></div></Frame>
        <Frame canvas label="WITH SUBTITLE"><div className="id-tile"><div className="id-lockup-h"><ForcesMark s={42} color="var(--accent)" /><div style={{ textAlign: 'left' }}><div className="id-word" style={{ fontSize: '1.7rem' }}>Forces</div><div className="id-sub" style={{ marginTop: 5 }}>Design System</div></div></div></div></Frame>
        <Frame canvas label="STACKED"><div className="id-tile"><ForcesMark s={40} color="var(--accent)" /><span className="id-word" style={{ fontSize: '1.6rem' }}>Forces</span><span className="id-sub">Reciprocal field</span></div></Frame>
        <Frame canvas label="CLEARSPACE"><div className="id-tile"><div style={{ position: 'relative', padding: 24, border: '1px dashed var(--line-2)', borderRadius: 8 }}><span className="id-word" style={{ fontSize: '1.5rem' }}>Forces</span><span className="mono" style={{ position: 'absolute', top: -9, left: 8, background: 'var(--bg-canvas)', padding: '0 6px', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--text-4)' }}>1× = cap height</span></div></div></Frame>
      </div>
      <div className="sg-grid cols-4" style={{ marginTop: '1rem' }}>
        <Frame label="FAVICON"><div className="id-tile"><span className="id-fav"><ForcesMark s={15} color="var(--accent)" /><span className="mono" style={{ fontSize: '0.62rem' }}>Forces</span></span></div></Frame>
        <Frame label="IN A BUTTON"><div className="id-tile"><button className="ds-btn primary"><ForcesMark s={14} />Forces</button></div></Frame>
        <Frame label="LOADING"><div className="id-tile"><ForcesMark s={30} color="var(--accent)" spin /></div></Frame>
        <Frame label="ON LIGHT"><div className="id-tile"><div className="id-onlight" style={{ padding: '0.9rem 1.2rem' }}><div className="id-lockup-h"><ForcesMark s={22} color="#04050a" /><span className="id-word" style={{ fontSize: '1.3rem' }}>Forces</span></div></div></div></Frame>
      </div>
      <div className="sg-grid cols-4" style={{ marginTop: '1rem' }}>
        <Frame label="APP ICON"><div className="id-tile"><div className="id-appicon tinted"><ForcesMark s={30} color="var(--accent)" /></div></div></Frame>
        <Frame label="KNOCKOUT"><div className="id-tile"><div className="id-appicon knockout"><ForcesMark s={30} color="#04050a" /></div></div></Frame>
        <Frame label="MONO"><div className="id-tile"><div className="id-appicon mono"><ForcesMark s={30} color="var(--text)" /></div></div></Frame>
        <Frame label="AVATAR"><div className="id-tile"><div className="id-appicon avatar"><ForcesMark s={26} color="var(--accent)" /></div></div></Frame>
      </div>
      <SectionHeader id="b-display" num="06" title="Display" desc="At scale, the word carries the whole force spectrum — blue to teal to violet to pink." />
      <Frame canvas label="DISPLAY" style={{ padding: '2.6rem 1.4rem', textAlign: 'center' }}><div className="id-display">Forces</div></Frame>
      <SectionHeader id="b-naming" num="07" title="Naming" desc="A consistent grammar: forces are verbs, formations are states, sections are numbered." />
      <div style={{ display: 'grid', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {[['Forces', 'verbs — what a body does', 'Attract, Repel, Vortex'], ['Formations', 'states — how the field is arranged', 'Ambient, Wells, Lanes'], ['Disciplines', 'nouns — the practice', 'Product strategy, Commerce'], ['Sections', 'two-digit index', '01, 02, 03 …']].map(r => (
          <div key={r[0]} style={{ background: 'var(--bg-card)', padding: '1rem 1.4rem', display: 'grid', gridTemplateColumns: '8rem 1fr auto', gap: '1.2rem', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{r[0]}</span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.92rem' }}>{r[1]}</span>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>{r[2]}</span>
          </div>
        ))}
      </div>
      <PageFooter left="Forces — Design System" right="01 · Brand" />
    </>
  );
}

/* ============ STYLE / COLOR ============ */
function Swatch({ name, value, mono }) {
  return (
    <div className="sg-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 84, background: value }} />
      <div style={{ padding: '0.7rem 0.85rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{name}</div>
        <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-4)', marginTop: 3 }}>{mono || value}</div>
      </div>
    </div>
  );
}
function StyleView() {
  const surfaces = [['Page', '#04050a'], ['Surface', '#0a0d14'], ['Subtle', '#0e121b'], ['Card', '#0b0e16'], ['Canvas', '#07090e']];
  const ink = [['Ink 900', '#f3f6fc'], ['Ink 700', '#b4bdcd'], ['Ink 500', '#8793a6'], ['Ink 400', '#5b6678'], ['Ink 300', '#39404e']];
  return (
    <>
      <PageHero eyebrow="Forces · Style" counter="02 / 11" title="Every accent is" titleEm="a force."
        meta={[{ text: '9 forces' }, { text: '5 surfaces' }, { text: 'OKLCH-harmonized' }]} />
      <SectionHeader id="colors" num="01" title="Force palette" desc="The palette is the force set. Each hue names a force and, through it, a discipline. Blue is the resting field." />
      <div className="sg-grid cols-3">
        {FORCES.map(f => (
          <div className="sg-card" key={f.f} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 96, background: f.c, position: 'relative' }}>
              <i className={'g g-' + f.f} style={{ position: 'absolute', right: 12, bottom: 12, width: 20, height: 20, color: 'rgba(0,0,0,0.55)' }} />
            </div>
            <div style={{ padding: '0.8rem 0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600 }}>{f.name}</span><span className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-4)' }}>{f.c}</span></div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 4 }}>{f.maps}</div>
            </div>
          </div>
        ))}
      </div>
      <SectionHeader id="surfaces" num="02" title="Surfaces" desc="Five steps of near-black. Depth comes from light, not from heavy borders." />
      <div className="sg-grid cols-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>{surfaces.map(s => <Swatch key={s[0]} name={s[0]} value={s[1]} />)}</div>
      <SectionHeader id="ink" num="03" title="Ink" desc="Text on dark, by emphasis." />
      <div className="sg-grid cols-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>{ink.map(s => <Swatch key={s[0]} name={s[0]} value={s[1]} />)}</div>
      <SectionHeader id="color-use" num="04" title="Color in use" desc="Force color is an accent, never a flood. It rises on engagement — a glyph, an underline, a wash, a glow — then recedes." />
      <div className="sg-grid cols-3">
        {[['#4da3ff', 'Accent on surface'], ['#2dd4bf', 'Tinted card'], ['#ff6e9c', 'Glow on hover']].map(p => (
          <div className="sg-card" key={p[0]} style={{ '--cat': p[0], borderColor: 'color-mix(in srgb,' + p[0] + ' 40%, var(--line))', background: 'color-mix(in srgb,' + p[0] + ' 7%, var(--bg-card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: p[0], boxShadow: '0 0 12px ' + p[0] }} /><span className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: p[0] }}>{p[1]}</span></div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.5, marginTop: '0.8rem' }}>8–16% mix on surface keeps it legible; the pure hue is reserved for the mark itself.</p>
          </div>
        ))}
      </div>
      <SectionHeader id="spacing" num="05" title="Spacing" desc="A 4px base. Generous on the outside, tight on the inside — the field needs room to breathe." />
      <Frame canvas label="4PX SCALE" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.2rem', flexWrap: 'wrap' }}>
          {[4, 8, 12, 16, 24, 32, 48, 64].map(s => (
            <div key={s} style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
              <div style={{ width: s, height: s, background: 'var(--accent)', borderRadius: 2, opacity: 0.85 }} />
              <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)' }}>{s}</span>
            </div>
          ))}
        </div>
      </Frame>
      <SectionHeader id="radii" num="06" title="Radii" desc="Soft but not round. Pills for actions, gentle corners for surfaces." />
      <div className="sg-grid cols-5" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {[['sm', 6], ['md', 10], ['lg', 14], ['xl', 20], ['pill', 999]].map(r => (
          <div className="sg-card" key={r[0]} style={{ display: 'grid', gap: 12, placeItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '100%', height: 56, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb,var(--accent) 40%,transparent)', borderRadius: r[1] }} />
            <div><div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{r[0]}</div><div className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)' }}>{r[1] === 999 ? '999px' : r[1] + 'px'}</div></div>
          </div>
        ))}
      </div>
      <SectionHeader id="elevation" num="07" title="Elevation" desc="Depth comes from glow and shadow, not heavy borders. Force color glows; black grounds." />
      <div className="sg-grid cols-3">
        {[['Resting', 'var(--shadow-md)'], ['Raised', 'var(--shadow-lg)'], ['Charged', '0 0 30px -6px var(--accent)']].map(e => (
          <div className="sg-card" key={e[0]} style={{ boxShadow: e[1], textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontWeight: 600 }}>{e[0]}</div>
            <div className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)', marginTop: 6 }}>{e[0] === 'Charged' ? 'accent glow' : e[1].replace('var(--', '').replace(')', '')}</div>
          </div>
        ))}
      </div>
      <PageFooter left="Forces — Design System" right="02 · Style" />
    </>
  );
}

/* ============ TYPE ============ */
function TypeView() {
  const scale = [
    { l: 'Display', size: 'clamp(2.4rem,6vw,4.6rem)', spec: '600 · −0.04em · 0.98', use: 'Hero statements', t: 'A system you can feel.' },
    { l: 'H1', size: '2.6rem', spec: '600 · −0.035em · 1.0', use: 'Page titles', t: 'Things made real.' },
    { l: 'H2', size: '1.9rem', spec: '600 · −0.03em · 1.04', use: 'Section titles', t: 'A practice that spans the whole product.' },
    { l: 'H3', size: '1.35rem', spec: '600 · −0.02em · 1.1', use: 'Card titles', t: 'Executable design systems' },
    { l: 'Body', size: '1.02rem', spec: '400 · −0.011em · 1.6', use: 'Running text', t: 'The visible experience and the invisible system that holds it up.' },
    { l: 'Small', size: '0.85rem', spec: '400 · 0 · 1.5', use: 'Secondary text', t: 'On experience architecture and the systems behind the screen.' },
    { l: 'Mono', size: '0.64rem', spec: '500 · 0.16em · upper', use: 'Labels · counters · tags', t: 'FORCES · DESIGN SYSTEM', mono: true },
  ];
  const weights = [['Light', 300], ['Regular', 400], ['Medium', 500], ['Semibold', 600], ['Bold', 700], ['Extrabold', 800]];
  return (
    <>
      <PageHero eyebrow="Forces · Type" counter="03 / 11" title="Bricolage &" titleEm="Martian Mono."
        meta={[{ text: 'Display + Mono' }, { text: 'Variable · opsz 12–96' }, { text: '2 families' }]} />
      <SectionHeader id="type-families" num="01" title="Families" desc="Two families carry the whole system. Bricolage Grotesque — a variable grotesque with optical sizing — does display and body. Martian Mono handles labels, counters, and force tags in the machine register." />
      <div className="sg-grid cols-2">
        <Frame label="DISPLAY · BRICOLAGE GROTESQUE" style={{ padding: '2rem 1.4rem' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: '3.4rem', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>Aa Gg</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: '1rem', color: 'var(--text-3)', marginTop: '0.8rem', letterSpacing: '-0.01em' }}>ABCDEFGHIJKLM · abcdefghijk · 0123456789</div>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-4)', marginTop: '1rem', letterSpacing: '0.08em' }}>VARIABLE · 300–800 · OPSZ 12–96</div>
        </Frame>
        <Frame label="MONO · MARTIAN MONO" style={{ padding: '2rem 1.4rem' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '2.6rem', fontWeight: 500 }}>Aa Gg</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--text-3)', marginTop: '0.8rem' }}>ABCDEFGHIJK · 0123456789</div>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-4)', marginTop: '1rem', letterSpacing: '0.08em' }}>VARIABLE · 300–700 · TABULAR</div>
        </Frame>
      </div>
      <SectionHeader id="type-weights" num="02" title="Weights" desc="Bricolage is variable — six stops carry the range from quiet body to hero display." />
      <Frame canvas label="WEIGHTS" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.6rem', alignItems: 'baseline' }}>
          {weights.map(w => (
            <div key={w[1]} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--display)', fontSize: '2.4rem', fontWeight: w[1], letterSpacing: '-0.03em', lineHeight: 1 }}>Forces</div>
              <div className="mono" style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)', marginTop: 6 }}>{w[0]} · {w[1]}</div>
            </div>
          ))}
        </div>
      </Frame>
      <SectionHeader id="type-scale" num="03" title="Scale" desc="Seven steps. Tracking tightens as size grows; line-height opens as it shrinks." />
      <div style={{ display: 'grid', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {scale.map(s => (
          <div key={s.l} style={{ background: 'var(--bg-card)', padding: '1.2rem 1.4rem', display: 'grid', gridTemplateColumns: '5rem 1fr 12rem', gap: '1.2rem', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{s.l}</span>
            <span style={{ fontFamily: s.mono ? 'var(--mono)' : 'var(--display)', fontSize: s.size, fontWeight: s.mono ? 500 : 600, letterSpacing: s.mono ? '0.16em' : '-0.025em', lineHeight: 1.05, textWrap: 'balance', color: s.mono ? 'var(--text-3)' : 'var(--text)' }}>{s.t}</span>
            <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)', lineHeight: 1.5, textAlign: 'right' }}>{s.spec}<br />{s.use}</span>
          </div>
        ))}
      </div>
      <SectionHeader id="type-examples" num="04" title="In use" desc="The scale composed — a heading, running body, and a mono caption working together." />
      <div className="sg-grid cols-2">
        <Frame style={{ padding: '1.6rem 1.8rem' }}>
          <span className="eyebrow">THE FIELD</span>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.7rem', letterSpacing: '-0.03em', margin: '0.5rem 0 0.8rem', lineHeight: 1.05 }}>The interface is only the visible surface.</h3>
          <p style={{ color: 'var(--text-2)', fontSize: '1.02rem', lineHeight: 1.6 }}>Beneath it are data models, permissions, business rules, and decisions made long before the user arrives. The goal is coherence.</p>
          <div className="mono" style={{ fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-4)', marginTop: '1.2rem' }}>Essay · 8 min · 2025</div>
        </Frame>
        <Frame style={{ padding: '1.6rem 1.8rem' }}>
          <span className="eyebrow">NUMERALS</span>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '2rem', fontWeight: 500, margin: '0.8rem 0', letterSpacing: '0.02em' }}>1,284 · 98.6% · −2</div>
          <p style={{ color: 'var(--text-3)', fontSize: '0.92rem', lineHeight: 1.55 }}>Martian Mono is tabular — figures align in columns for stats, counters, and data. Bricolage handles prose; mono handles measurement.</p>
        </Frame>
      </div>
      <PageFooter left="Forces — Design System" right="03 · Type" />
    </>
  );
}

/* ============ COMPONENTS ============ */
function ComponentsView() {
  const [tab, setTab] = useState(0);
  const [tog, setTog] = useState(true);
  const [acc, setAcc] = useState(0);
  const [forceOn, setForceOn] = useState(() => new Set());
  const toggleForce = (id) => setForceOn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const accItems = [['What is a force?', 'A body that acts on the field — attract, repel, vortex, and six more.'], ['What is a formation?', 'An arrangement of the whole field — ambient, wells, lanes, scatter, accretion.'], ['What are threads?', 'Living connections wired between an engaged body and its set.']];
  const tabBodies = ['The field at a glance.', 'Recent changes to the field.', 'Configure forces and formations.'];
  return (
    <>
      <PageHero eyebrow="Forces · Components" counter="08 / 11" title="Built from the" titleEm="same parts."
        meta={[{ text: 'Buttons · Tags' }, { text: 'Inputs · Cards' }]} />
      <SectionHeader id="comp-buttons" num="01" title="Buttons" desc="A pill primary, a ghost, and force-tinted variants. A button tinted to a force also carries that force — hover one with the field live and it acts on the background." />
      <Frame canvas label="BUTTONS" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center' }}>
          <button className="ds-btn primary">Get in touch</button>
          <button className="ds-btn ghost">Read the manual</button>
          <button className="ds-btn" style={{ '--cat': '#2dd4bf' }} data-hot data-body="vortex" data-color="#2dd4bf" data-strength="0.6" data-range="200" data-spin="1">Vortex</button>
          <button className="ds-btn" style={{ '--cat': '#ff6e9c' }} data-hot data-body="repel" data-color="#ff6e9c" data-strength="0.6" data-range="200">Repel</button>
        </div>
      </Frame>
      <SectionHeader id="comp-tags" num="02" title="Tags" desc="A tag that names a force carries that force. Click to toggle it on: with the field live, an active tag drives the background continuously; off, it rests. The dot and label show its state." />
      <Frame canvas label="FORCE TAGS · TOGGLE" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {FORCES.map(f => {
            const on = forceOn.has(f.f);
            return (
              <button key={f.f} className={'ds-tag force-toggle' + (on ? ' on' : '')} style={{ '--cat': f.c }}
                data-body={f.body} data-color={f.c} {...f.attrs} data-when="active" data-active={on ? '1' : '0'}
                aria-pressed={on} onClick={() => toggleForce(f.f)}>
                <span className="ds-tag-dot" />{f.name}
                <span className="force-toggle-state mono">{on ? 'on' : 'off'}</span>
              </button>
            );
          })}
        </div>
      </Frame>
      <SectionHeader id="comp-inputs" num="03" title="Inputs" desc="Hairline fields that glow to the active force." />
      <Frame canvas label="INPUTS" style={{ padding: '2rem 1.6rem' }}>
        <div className="sg-grid cols-2" style={{ maxWidth: 560 }}>
          <input className="ds-input" placeholder="you@studio.com" />
          <input className="ds-input" placeholder="Project name" />
        </div>
      </Frame>
      <SectionHeader id="comp-cards" num="04" title="Cards" desc="The practice card — number, glyph, name, force label, descriptor." />
      <div className="sg-grid cols-3">
        {FORCES.slice(0, 3).map((f, i) => (
          <div className="sg-card" key={f.f} style={{ '--cat': f.c }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: '0.6rem', color: f.c }}>{String(i + 1).padStart(2, '0')}</span>
              <i className={'g g-' + f.f} style={{ width: 16, height: 16, color: f.c }} /></div>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.2rem', margin: '1.2rem 0 0.4rem' }}>{f.maps}</h3>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: f.c }}>{f.name} · {f.does.toLowerCase()}</div>
          </div>
        ))}
      </div>
      <SectionHeader id="comp-sizes" num="05" title="Button sizes" desc="Three sizes share one pill geometry." />
      <Frame canvas label="SIZES" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center' }}>
          <button className="ds-btn primary sm">Small</button>
          <button className="ds-btn primary">Medium</button>
          <button className="ds-btn primary lg">Large</button>
        </div>
      </Frame>
      <SectionHeader id="comp-seg" num="06" title="Segmented control" desc="For conditions and formations — a small set of mutually exclusive choices in the machine register." />
      <Frame canvas label="SEGMENTED" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="ds-seg"><button className="on">Always</button><button>Fast</button><button>Hot</button></div>
          <div className="ds-seg"><button className="on">Ambient</button><button>Wells</button><button>Lanes</button><button>Scatter</button></div>
        </div>
      </Frame>
      <SectionHeader id="comp-badges" num="07" title="Status" desc="Compact badges for state. Color carries meaning: live, warn, error, info." />
      <Frame canvas label="STATUS" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          <span className="ds-badge" style={{ '--cat': '#5fd0a8' }}><span className="ds-tag-dot" />Live</span>
          <span className="ds-badge" style={{ '--cat': '#ffce6b' }}><span className="ds-tag-dot" />Draft</span>
          <span className="ds-badge" style={{ '--cat': '#ff6e9c' }}><span className="ds-tag-dot" />Blocked</span>
          <span className="ds-badge" style={{ '--cat': '#4da3ff' }}><span className="ds-tag-dot" />Info</span>
          <span className="ds-badge" style={{ '--cat': '#8da2c0' }}>Archived</span>
        </div>
      </Frame>
      <SectionHeader id="comp-stats" num="08" title="Stats" desc="A number, a label, a delta — the metric block." />
      <div className="sg-grid cols-3">
        {[['1,284', 'Active fields', '+12%', 'up'], ['98.6%', 'Coherence', '+0.4%', 'up'], ['3', 'Open threads', '−2', 'down']].map(s => (
          <div className="stat-card" key={s[1]}><span className="stat-label">{s[1]}</span><span className="stat-num">{s[0]}</span><span className={'stat-delta ' + s[3]}>{s[3] === 'up' ? '▲' : '▼'} {s[2]}</span></div>
        ))}
      </div>
      <SectionHeader id="comp-steps" num="09" title="Step rail" desc="Progress through a flow — done, current, upcoming." />
      <Frame canvas label="STEPS" style={{ padding: '2rem 1.6rem' }}>
        <div className="step-rail"><span className="step done">1</span><span className="step done">2</span><span className="step current">3</span><span className="step">4</span><span className="step">5</span></div>
      </Frame>
      <SectionHeader id="comp-skeleton" num="10" title="Loading" desc="Skeleton shimmer while the field resolves." />
      <Frame canvas label="SKELETON" style={{ padding: '1.8rem 1.6rem' }}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <div className="skeleton" style={{ height: 14, width: '42%' }} />
          <div className="skeleton" style={{ height: 12 }} />
          <div className="skeleton" style={{ height: 12, width: '80%' }} />
        </div>
      </Frame>
      <SectionHeader id="comp-toggle" num="11" title="Toggles" desc="A binary switch — the smallest decision." />
      <Frame canvas label="TOGGLE" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', gap: '1.4rem', alignItems: 'center' }}>
          <button className={'ds-toggle' + (tog ? ' on' : '')} onClick={() => setTog(!tog)} aria-pressed={tog} />
          <span style={{ color: 'var(--text-3)', fontSize: '0.92rem' }}>{tog ? 'Field visible' : 'Field hidden'}</span>
        </div>
      </Frame>
      <SectionHeader id="comp-tabs" num="12" title="Tabs" desc="Switch between peer views." />
      <Frame canvas label="TABS" style={{ padding: '1.6rem 1.6rem 2rem' }}>
        <div className="ds-tabs">{['Overview', 'Activity', 'Settings'].map((t, i) => <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div>
        <p style={{ color: 'var(--text-2)', marginTop: '1.2rem', fontSize: '0.95rem' }}>{tabBodies[tab]}</p>
      </Frame>
      <SectionHeader id="comp-avatars" num="13" title="Avatars" desc="Identity — initials, the mark, or a stacked group." />
      <Frame canvas label="AVATARS" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="ds-avatar" style={{ '--cat': '#4da3ff' }}>ZS</span>
          <span className="ds-avatar" style={{ '--cat': '#2dd4bf' }}><ForcesMark s={18} color="#2dd4bf" /></span>
          <div className="ds-avatar-group">
            {['#4da3ff', '#a78bfa', '#ff6e9c', '#5fd0a8'].map((c, i) => <span key={i} className="ds-avatar" style={{ '--cat': c }}>{'ABCD'[i]}</span>)}
            <span className="ds-avatar" style={{ '--cat': '#8da2c0' }}>+3</span>
          </div>
        </div>
      </Frame>
      <SectionHeader id="comp-progress" num="14" title="Progress" desc="A determinate bar — how far the field has resolved." />
      <Frame canvas label="PROGRESS" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'grid', gap: '1rem', maxWidth: 440 }}>
          {[28, 64, 92].map(v => <div key={v}><div className="ds-progress"><span style={{ width: v + '%' }} /></div><div className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)', marginTop: 6 }}>{v}%</div></div>)}
        </div>
      </Frame>
      <SectionHeader id="comp-crumbs" num="15" title="Breadcrumb" desc="Where you are in the system." />
      <Frame canvas label="BREADCRUMB" style={{ padding: '2rem 1.6rem' }}>
        <div className="ds-crumbs"><a href="#">Forces</a><span className="sep">/</span><a href="#">Mechanics</a><span className="sep">/</span><span className="cur">Formations</span></div>
      </Frame>
      <SectionHeader id="comp-accordion" num="16" title="Accordion" desc="Progressive disclosure — one open at a time." />
      <div className="ds-acc">
        {accItems.map((it, i) => (
          <div key={i} className={'ds-acc-item' + (acc === i ? ' open' : '')}>
            <button className="ds-acc-h" onClick={() => setAcc(acc === i ? -1 : i)}>{it[0]}<span className="chev">›</span></button>
            {acc === i && <div className="ds-acc-body">{it[1]}</div>}
          </div>
        ))}
      </div>
      <SectionHeader id="comp-tooltip" num="17" title="Tooltip" desc="A label on hover, for the non-obvious." />
      <Frame canvas label="TOOLTIP" style={{ padding: '2.6rem 1.6rem' }}>
        <span className="ds-tip"><button className="ds-btn ghost">Hover me<span className="ds-tip-label">Drives the live field</span></button></span>
      </Frame>
      <SectionHeader id="comp-empty" num="18" title="Empty state" desc="Nothing here yet — with a way forward." />
      <Frame canvas label="EMPTY" style={{ padding: '1rem' }}>
        <div className="ds-empty"><span className="ds-empty-ic"><ForcesMark s={22} color="var(--accent)" /></span><div><div style={{ fontWeight: 600, color: 'var(--text)' }}>No fields yet</div><div style={{ fontSize: '0.9rem', marginTop: 4 }}>Drop a force to begin shaping the field.</div></div><button className="ds-btn primary sm">Add a force</button></div>
      </Frame>
      <PageFooter left="Forces — Design System" right="08 · Components" />
    </>
  );
}

Object.assign(window, { BrandView, StyleView, TypeView, ComponentsView });
