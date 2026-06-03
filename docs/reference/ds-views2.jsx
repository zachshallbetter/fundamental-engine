/* ──────────────────────────────────
   FIELD DS — VIEWS II: Library · Patterns · Screens
────────────────────────────────── */
function UiIcon({ children, s = 20 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const UIICONS = [
  ['search', <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>],
  ['plus', <path d="M12 5v14M5 12h14" />],
  ['close', <path d="M6 6l12 12M18 6 6 18" />],
  ['check', <path d="M5 13l4 4 10-10" />],
  ['arrow', <path d="M5 12h14M13 6l6 6-6 6" />],
  ['external', <path d="M7 17 17 7M8 7h9v9" />],
  ['chevron', <path d="M9 6l6 6-6 6" />],
  ['menu', <path d="M4 7h16M4 12h16M4 17h16" />],
  ['filter', <path d="M4 5h16l-6 8v5l-4 2v-7z" />],
  ['grid', <><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></>],
  ['mail', <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>],
  ['link', <><path d="M9 15l6-6" /><path d="M10.5 6 12 4.5a4 4 0 0 1 6 6L16.5 12" /><path d="M13.5 18 12 19.5a4 4 0 0 1-6-6L7.5 12" /></>],
  ['bell', <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></>],
  ['user', <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>],
  ['download', <><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></>],
  ['sliders', <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>],
];

/* ============ LIBRARY ============ */
function LibraryView() {
  const glyphs = ['attract', 'emitter', 'spring', 'reflect', 'stream', 'repel', 'drag', 'vortex', 'absorb'];
  const motion = [
    { t: 'Reveal', d: 'opacity + 28px rise', dur: '0.9s', ease: 'field' },
    { t: 'Engage', d: 'lit / dim cross-fade', dur: '0.45s', ease: 'field' },
    { t: 'Formation ease', d: 'field migrates between presets', dur: '~2s', ease: 'lerp 0.03' },
    { t: 'Accent journey', d: 'hue travels with scroll', dur: 'continuous', ease: 'lerp 0.08' },
  ];
  const states = [
    { t: 'Rest', cls: '' }, { t: 'Hover', cls: 'is-hover' }, { t: 'Focus', cls: 'is-focus' }, { t: 'Disabled', cls: 'is-disabled' },
  ];
  return (
    <>
      <PageHero eyebrow="Forces · Library" counter="10 / 11" title="Glyphs, motion," titleEm="states."
        meta={[{ text: '9 force glyphs' }, { text: '4 motions' }, { text: 'lab.css' }]} />
      <SectionHeader id="lib-icons" num="01" title="Icons" desc="The icon set is the force set. Nine glyphs, drawn from pure CSS — they double as the system's vocabulary." />
      <Frame canvas label="FORCE GLYPHS" style={{ padding: '2rem 1.4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: '1.2rem' }}>
          {glyphs.map(g => (
            <div key={g} style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
              <i className={'g g-' + g} style={{ width: 26, height: 26, color: 'var(--text)' }} />
              <span className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{g}</span>
            </div>
          ))}
        </div>
      </Frame>
      <SectionHeader id="lib-ui" num="02" title="Interface icons" desc="A line set for UI chrome — 1.6px stroke on a 24px grid, round caps. The force glyphs carry meaning; these carry function." />
      <div className="ds-icon-grid">
        {UIICONS.map(ic => <div className="ds-icon-cell" key={ic[0]}><UiIcon>{ic[1]}</UiIcon><span>{ic[0]}</span></div>)}
      </div>
      <SectionHeader id="lib-motion" num="03" title="Motion" desc="One easing curve carries the whole system: cubic-bezier(0.16, 1, 0.3, 1) — a quick out, a long settle. Physics uses lerp toward targets." />
      <div className="sg-grid cols-2">
        {motion.map(m => (
          <div className="sg-card" key={m.t}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.15rem' }}>{m.t}</h3>
              <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)' }}>{m.dur}</span>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', marginTop: '0.4rem' }}>{m.d}</p>
            <div className="ds-motion-track"><span className="ds-motion-dot" /></div>
            <span className="mono" style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>ease · {m.ease}</span>
          </div>
        ))}
      </div>
      <SectionHeader id="lib-states" num="04" title="States" desc="Every interactive element resolves rest → hover → focus → disabled the same way: a force color rises, a ring or glow appears." />
      <Frame canvas label="BUTTON STATES" style={{ padding: '2rem 1.6rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.4rem', alignItems: 'center' }}>
          {states.map(s => (
            <div key={s.t} style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
              <button className={'ds-btn primary ' + s.cls}>Get in touch</button>
              <span className="mono" style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{s.t}</span>
            </div>
          ))}
        </div>
      </Frame>
      <PageFooter left="Forces — Design System" right="10 · Library" />
    </>
  );
}

/* ============ PATTERNS ============ */
function PatternsView() {
  const journey = [
    { s: 'Hero', f: 'ambient', c: '#4da3ff', d: 'resting drift' },
    { s: 'Practice', f: 'scatter', c: '#a78bfa', d: 'energy dispersed' },
    { s: 'Work', f: 'wells', c: '#2dd4bf', d: 'matter pools' },
    { s: 'Writing', f: 'lanes', c: '#ff9d5c', d: 'a current carries' },
    { s: 'Contact', f: 'accretion', c: '#ffce6b', d: 'everything gathers' },
  ];
  return (
    <>
      <PageHero eyebrow="Forces · Patterns" counter="09 / 11" title="Texture, rule," titleEm="journey."
        meta={[{ text: '12 textures' }, { text: '1 journey' }]} />
      <SectionHeader id="p-textures" num="01" title="Textures" desc="Quiet textures built from three primitives — dots, hairlines, dashes — at different rhythms. Drop any into a frame." />
      <div className="sg-grid cols-4">
        {[['Dots · 12', 'pat-dots-12'], ['Dots · 8', 'pat-dots-8'], ['Hatch', 'pat-hatch'], ['Hatch rev', 'pat-hatch-rev'], ['Cross-hatch', 'pat-cross'], ['Grid', 'pat-grid'], ['Diamond', 'pat-diamond'], ['Stagger', 'pat-stagger'], ['Topo', 'pat-topo'], ['Weave', 'pat-weave'], ['Density wash', 'pat-wash'], ['Scrim', 'pat-scrim']].map(p => (
          <div key={p[1]}>
            <div className={'pat-cell ' + p[1]} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: '0.8rem' }}>{p[0]}</span>
              <span className="mono" style={{ fontSize: '0.54rem', color: 'var(--text-4)' }}>.{p[1]}</span>
            </div>
          </div>
        ))}
      </div>
      <SectionHeader id="p-depth" num="02" title="Depth" desc="Layers read by light, not borders. Four tiers — the page floor, a raised surface, a card, and a charged element that lifts with an accent glow. Elevation rises as a thing earns attention." />
      <div className="depth-row">
        {[['d0', 'Page', 'the floor', 'depth-d0'], ['d1', 'Surface', 'raised panel', 'depth-d1'], ['d2', 'Card', 'lifted content', 'depth-d2'], ['d3', 'Charged', 'engaged + glowing', 'depth-d3']].map(t => (
          <div className={'depth-tier ' + t[3]} key={t[0]}>
            <span className="mono">{t[0]}</span>
            <div><h4>{t[1]}</h4><div style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginTop: 4 }}>{t[2]}</div></div>
          </div>
        ))}
      </div>
      <SectionHeader id="p-rules" num="03" title="Rules" desc="The marks that frame content: hairline dividers, the ◆—◆ baseline, the corner brackets." />
      <div className="sg-card">
        <div className="hero-baseline" style={{ marginTop: 0 }}><span className="hero-tick">◆</span><div className="hero-baseline-rule" /><span className="hero-tick">◆</span></div>
        <div style={{ height: 1, background: 'var(--line)', margin: '1.6rem 0' }} />
        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
          <span className="id-label"><span className="num">04</span> SECTION LABEL</span>
          <span className="label-loose">LOOSE LABEL</span>
          <span className="eyebrow">EYEBROW · ACCENT</span>
        </div>
        <div style={{ height: 1, background: 'var(--line)', margin: '1.6rem 0' }} />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="dot-tag"><span className="dot g" />Live</span>
          <span className="dot-tag"><span className="dot b" />Routed</span>
          <span className="dot-tag"><span className="dot y" />Review</span>
          <span className="dot-tag"><span className="dot r" />Failed</span>
          <span className="dot-tag"><span className="dot v" />Draft</span>
          <span className="dot-tag"><span className="dot" />Idle</span>
          <span style={{ flex: 1 }} />
          <span className="dot-pulse" /><span className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)', margin: '0 0.6rem 0 0.5rem' }}>live</span>
          <span className="kbd">⌘</span><span className="kbd">K</span>
        </div>
      </div>
      <SectionHeader id="p-journey" num="04" title="Journey" desc="As you scroll a page, the field migrates into one formation per section. This is the score." />
      <div style={{ display: 'grid', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {journey.map((j, i) => (
          <div key={j.s} style={{ background: 'var(--bg-card)', padding: '1.1rem 1.4rem', display: 'grid', gridTemplateColumns: '2.4rem 1fr auto', gap: '1.2rem', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.7rem', color: j.c }}>{String(i + 1).padStart(2, '0')}</span>
            <div><span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{j.s}</span><span style={{ color: 'var(--text-3)', marginLeft: '0.8rem', fontSize: '0.9rem' }}>{j.d}</span></div>
            <span className="ds-tag" style={{ '--cat': j.c }}><span className="ds-tag-dot" />{j.f}</span>
          </div>
        ))}
      </div>
      <PageFooter left="Forces — Design System" right="09 · Patterns" />
    </>
  );
}

/* ============ SCREENS ============ */
function ScreensView() {
  return (
    <>
      <PageHero eyebrow="Forces · Screens" counter="11 / 11" title="The system," titleEm="composed."
        meta={[{ text: 'real compositions' }, { text: 'from the same parts' }]} />
      <SectionHeader id="screen-hero" num="01" title="Hero" desc="The opening frame — an oversized watermark behind a name, the live mark, and a role line. The field rests in Ambient here, then gathers as you scroll." />
      <Frame canvas label="HERO" style={{ padding: 0 }}>
        <div style={{ position: 'relative', minHeight: 280, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 'clamp(6rem,22vw,16rem)', letterSpacing: '-0.05em', color: 'rgba(255,255,255,0.035)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>Forces</span>
          <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: '0.7rem', textAlign: 'center', padding: '2rem 1.4rem' }}>
            <ForcesMark s={58} color="var(--accent)" animated />
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'clamp(2rem,5vw,3rem)', letterSpacing: '-0.035em', lineHeight: 1 }}>Zach Shallbetter</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '1rem', maxWidth: '40ch' }}>Experience architecture — the systems behind the screen.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.4rem' }}>
              {FORCES.slice(0, 4).map(f => <span className="ds-tag" key={f.f} style={{ '--cat': f.c }}><span className="ds-tag-dot" />{f.maps}</span>)}
            </div>
          </div>
        </div>
      </Frame>
      <SectionHeader id="screen-practice" num="02" title="Practice grid" desc="The matrix in application — number, glyph, name, force label, descriptor." />
      <Frame label="PRACTICE" style={{ padding: '1.4rem' }}>
        <div className="sg-grid cols-3">
          {FORCES.slice(0, 3).map((f, i) => (
            <div key={f.f} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--bg-canvas)', padding: '1.1rem', minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.6rem', color: f.c }}>{String(i + 1).padStart(2, '0')}</span>
                <i className={'g g-' + f.f} style={{ width: 16, height: 16, color: f.c }} /></div>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.15rem' }}>{f.maps}</div>
                <div className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: f.c, marginTop: 4 }}>{f.name} · {f.does.toLowerCase()}</div>
              </div>
            </div>
          ))}
        </div>
      </Frame>
      <SectionHeader id="screen-work" num="03" title="Work — accretion" desc="A list as accretion: each entry alternates side, gathering toward the center like matter pulled to a core. Number, title, proof line, discipline, year." />
      <div className="accretion-list">
        {[['01', 'Executable Design System', 'Design decisions encoded into components and states.', 'Design Systems', '2025', '#2dd4bf', false],
        ['02', 'AI-Assisted Search', 'Search shaped around intent and adaptive response.', 'AI Systems', '2024', '#a78bfa', true],
        ['03', 'Commerce Platform', 'A storefront that holds up under real load.', 'Commerce', '2023', '#ff9d5c', false],
        ['04', 'Motion Language', 'One easing curve carrying a whole product.', 'Motion', '2023', '#7dd3fc', true]].map(r => (
          <div key={r[0]} className={'accretion-row' + (r[6] ? ' align-r' : '')} style={{ '--cat': r[5] }}>
            <div className="a-title">{r[1]}</div>
            <div className="a-proof">{r[2]}</div>
            <div className="a-meta">{r[3]} · {r[4]}</div>
          </div>
        ))}
      </div>
      <SectionHeader id="screen-writing" num="04" title="Writing — stream" desc="Essays as a current: a horizontal lane you scrub sideways, mirroring the Lanes formation. Each card carries a discipline color, a title, and a read time." />
      <div className="writing-stream">
        {[['On Reciprocal Interfaces', 'Experience design', '8 min', '#c4b5fd'],
        ['The Invisible System', 'Architecture', '6 min', '#86e57f'],
        ['Force as a Design Primitive', 'Creative tech', '11 min', '#2dd4bf'],
        ['Coherence Over Consistency', 'Product strategy', '7 min', '#4da3ff'],
        ['When the Field Pushes Back', 'Motion', '5 min', '#7dd3fc']].map(w => (
          <div className="writing-card" key={w[0]} style={{ '--cat': w[3] }}>
            <div className="w-meta">
              <span className="ds-tag" style={{ '--cat': w[3] }}><span className="ds-tag-dot" />{w[1]}</span>
              <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--text-4)' }}>{w[2]}</span>
            </div>
            <h4>{w[0]}</h4>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: w[3] }}>Read →</span>
          </div>
        ))}
      </div>
      <SectionHeader id="screen-contact" num="05" title="Contact" desc="The absorbing close — a statement and a single node." />
      <Frame canvas label="CONTACT" style={{ padding: '3rem 1.6rem', textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'clamp(1.8rem,4vw,3rem)', letterSpacing: '-0.03em', lineHeight: 1 }}>Open to the <em style={{ fontStyle: 'normal', color: 'var(--coherence)' }}>right conversation.</em></h3>
        <a className="ds-btn" href="#" style={{ '--cat': '#ffce6b', marginTop: '1.6rem' }}>zach@zachshallbetter.com</a>
      </Frame>
      <SectionHeader id="screen-conversation" num="06" title="Conversation" desc="An assistant surface — app chrome, bubbles, a tool call, and an input." />
      <Frame label="CONVERSATION" style={{ padding: 0 }}>
        <div className="app-window" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
          <div className="app-chrome"><div className="app-chrome-dots"><span /><span /><span /></div><div className="app-url">forces.app / assistant</div></div>
          <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-subtle)' }}>
            <div className="bubble bubble-them"><span className="bubble-meta">Assistant</span>How should the field respond when a user engages two skills at once?</div>
            <div className="bubble bubble-us"><span className="bubble-meta">You</span>Wire threads between them and pull the field toward the midpoint.</div>
            <div className="bubble bubble-tool"><span className="bubble-meta">Tool</span>↳ setFormation('wells') · threads(2)</div>
            <div className="bubble bubble-them"><span className="bubble-meta">Assistant</span>Done — the set is connected and the field has pooled.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.9rem 1.2rem', borderTop: '1px solid var(--line)' }}>
            <input className="ds-input" placeholder="Message the field…" /><button className="ds-btn primary sm">Send</button>
          </div>
        </div>
      </Frame>
      <SectionHeader id="screen-dashboard" num="07" title="Dashboard" desc="Stats over a routed list — the system at a glance." />
      <Frame label="DASHBOARD" style={{ padding: '1.4rem' }}>
        <div className="sg-grid cols-3" style={{ marginBottom: '1rem' }}>
          {[['1,284', 'Active fields'], ['98.6%', 'Coherence'], ['3', 'Open threads']].map(s => (<div className="stat-card" key={s[1]}><span className="stat-label">{s[1]}</span><span className="stat-num">{s[0]}</span></div>))}
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <div className="list-row head"><span>ID</span><span>Field</span><span>Force</span><span>Status</span></div>
          {[['01', 'Product strategy', 'Attract', '#4da3ff', 'Live', 'g'], ['02', 'AI systems', 'Condition', '#a78bfa', 'Routed', 'b'], ['03', 'Commerce', 'Repel', '#ff6e9c', 'Review', 'y']].map(r => (
            <div className="list-row" key={r[0]}><span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{r[0]}</span><span>{r[1]}</span><span className="ds-tag" style={{ '--cat': r[3] }}><span className="ds-tag-dot" />{r[2]}</span><span className="dot-tag"><span className={'dot ' + r[5]} />{r[4]}</span></div>
          ))}
        </div>
      </Frame>
      <SectionHeader id="screen-settings" num="08" title="Settings" desc="Grouped form rows with toggles — the system's controls." />
      <Frame label="SETTINGS" style={{ padding: 0 }}>
        <div className="app-window" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
          <div className="app-chrome"><div className="app-chrome-dots"><span /><span /><span /></div><div className="app-url">forces.app / settings</div></div>
          <div style={{ padding: '1.4rem 1.6rem', display: 'grid', gap: '1px', background: 'var(--line)' }}>
            {[['Live field', 'Render the particle background', true], ['Reduced motion', 'Freeze animations', false], ['Threads', 'Wire engaged sets', true]].map((r, i) => (
              <div key={i} style={{ background: 'var(--bg-canvas)', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div><div style={{ fontWeight: 500 }}>{r[0]}</div><div style={{ fontSize: '0.85rem', color: 'var(--text-4)', marginTop: 2 }}>{r[1]}</div></div>
                <span className={'ds-toggle' + (r[2] ? ' on' : '')} />
              </div>
            ))}
          </div>
        </div>
      </Frame>
      <SectionHeader id="screen-onboarding" num="09" title="Onboarding" desc="A guided first run — step rail, a single focus, one clear action." />
      <Frame canvas label="ONBOARDING" style={{ padding: '2.4rem 1.6rem' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center', display: 'grid', gap: '1.2rem', justifyItems: 'center' }}>
          <div className="step-rail"><span className="step done">1</span><span className="step current">2</span><span className="step">3</span></div>
          <span className="ds-empty-ic" style={{ width: 52, height: 52 }}><ForcesMark s={26} color="var(--accent)" animated /></span>
          <div>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: '1.6rem', letterSpacing: '-0.03em' }}>Drop your first force.</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.98rem', lineHeight: 1.6, marginTop: '0.6rem' }}>Every element on a page can become a body in the field. Pick a force and watch the matter respond.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}><button className="ds-btn ghost sm">Skip</button><button className="ds-btn primary">Continue →</button></div>
        </div>
      </Frame>
      <PageFooter left="Forces — Design System" right="11 · Screens" />
    </>
  );
}

Object.assign(window, { LibraryView, PatternsView, ScreensView });
