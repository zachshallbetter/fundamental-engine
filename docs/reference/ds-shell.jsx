/* ──────────────────────────────────
   FIELD DS — SHELL: TopBar · ViewportShell · helpers
────────────────────────────────── */
const { useState, useEffect, useRef } = React;

/* the Forces mark — a central body with bodies orbiting in its field (solid
   particles). Static SVG for the small / favicon / lockup spots; the live
   particle version is <ForcesMarkLive> (used in the brand hero). */
function ForcesMark({ s = 22, color, animated, spin }) {
  const cls = 'fm' + (animated ? ' fm-animated' : '') + (spin ? ' fm-spin' : '');
  const c = color || 'currentColor';
  return (
    <svg className={cls} width={s} height={s} viewBox="0 0 441.4 421.5" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible', color: c }}>
      <g fill="none" stroke={c} strokeWidth="21" strokeLinecap="round" strokeMiterlimit="10">
        <circle cx="230.4" cy="210.9" r="89.1" />
        <g className="fm-spinner">
          <path d="M393.7,327.2c12.6-17.7,22.5-37.8,29-59.8,31.2-106.2-29.6-217.6-135.8-248.8-44.1-12.9-89-10.1-128.7,5.3" />
          <circle cx="369.9" cy="354.8" r="34.7" />
          <circle cx="45.2" cy="286.4" r="34.7" />
          <path d="M61.7,318.5c44.5,70,128.4,105.3,209.6,88.3" />
          <circle cx="139" cy="315.4" r="16.1" fill={c} stroke="none" />
          <circle cx="92" cy="65.7" r="22.2" fill={c} stroke="none" />
        </g>
      </g>
    </svg>
  );
}
window.ForcesMark = ForcesMark;

/* ForcesMarkLive — the animated mark: a solid central body with bodies and
   dust orbiting it, each glowing by size. Canvas-based; inherits `color`. */
function ForcesMarkLive({ size = 120, color = 'var(--accent)' }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current; if (!host) return;
    const stop = window.buildForcesMark(host, { size, color });
    return stop;
  }, [size, color]);
  return <div ref={ref} className="fm-live" style={{ width: size, height: size }} />;
}
window.ForcesMarkLive = ForcesMarkLive;

/* a force glyph (reuses lab.css .g.g-<force>) */
function Glyph({ f = 'attract', s = 16, color }) {
  return <i className={'g g-' + f} style={{ width: s, height: s, color: color || 'currentColor', display: 'inline-block' }} />;
}
window.Glyph = Glyph;

const VIEW_TABS = (window.DS_NAV || []).flatMap(g => g.tabs);

function FieldToggle({ live, setLive }) {
  return (
    <button className={'field-toggle' + (live ? ' on' : '')} onClick={() => setLive(!live)}
      aria-pressed={live} aria-label={live ? 'Field is live — click to calm' : 'Activate the field'}
      title={live ? 'Field is live — click to calm' : 'Activate the field'}>
      <span className="ft-dot" />
    </button>
  );
}

function TopBar({ view, setView, sectionLinks, live, setLive }) {
  const links = sectionLinks?.[view] || [];
  const groups = window.DS_NAV || [];
  return (
    <nav className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-row">
          <div className="wordmark" onClick={() => setView('brand')}>
            <span className="wordmark-glyph"><ForcesMark s={20} color="var(--accent)" /></span>
            <span className="wordmark-name">Forces</span>
            <span className="wordmark-tag">Design System · v0.2</span>
          </div>
          <div className="pill-nav">
            {groups.map((g, gi) => (
              <React.Fragment key={g.group}>
                {gi > 0 && <span className="pill-nav-sep" title={g.group} />}
                {g.tabs.map(t => (
                  <button key={t.id} className={'pill-nav-item' + (view === t.id ? ' active' : '')} onClick={() => setView(t.id)}>{t.label}</button>
                ))}
              </React.Fragment>
            ))}
          </div>
          <div className="top-bar-tools">
            <FieldToggle live={live} setLive={setLive} />
          </div>
        </div>
        {links.length > 0 && (
          <div className="section-nav">
            {links.map(l => <a key={l.id} href={'#' + l.id}>{l.label}</a>)}
          </div>
        )}
      </div>
    </nav>
  );
}

function ViewportShell({ children }) {
  const wrapperRef = useRef(null);
  const [bp, setBp] = useState('xl');

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width;
        let b = 'xl';
        if (w < 480) b = 'xs'; else if (w < 640) b = 'sm'; else if (w < 820) b = 'md'; else if (w < 1100) b = 'lg';
        setBp(b);
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="viewport-shell">
      <div ref={wrapperRef} className="viewport-wrapper" data-bp={bp}>
        {children}
      </div>
    </div>
  );
}

function PageCorners() {
  return <div className="page-corners" aria-hidden="true"><div className="corner corner-tl"></div><div className="corner corner-tr"></div><div className="corner corner-bl"></div><div className="corner corner-br"></div></div>;
}

/* FieldCell — a self-contained particle field inside a frame, at any size */
function FieldCell({ force, formation, color, count, height = 130, style }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.makeFieldCell) return;
    inst.current = window.makeFieldCell(ref.current, { force, formation, color, count });
    return () => { if (inst.current) inst.current.destroy(); };
  }, []);
  useEffect(() => { if (inst.current) inst.current.set({ force, formation, color }); }, [force, formation, color]);
  return <canvas ref={ref} className="field-cell" style={{ width: '100%', height, display: 'block', ...style }} />;
}
window.FieldCell = FieldCell;

function SectionHeader({ id, num, title, desc }) {
  return (
    <div className="sg-header" id={id}>
      <span className="id-label"><span className="num">{num}</span> {title.toUpperCase()}</span>
      <h2 className="sg-section-title">{title}</h2>
      {desc && <p className="sg-section-desc">{desc}</p>}
    </div>
  );
}

function PageHero({ eyebrow, counter, title, titleEm, meta = [] }) {
  return (
    <header className="sg-hero">
      <div className="hero-grid">
        <div className="hero-left">
          <div className="hero-eyebrow-row">
            <span className="hero-eyebrow">{eyebrow}</span>
            <span className="hero-rule" />
            {counter && <span className="hero-counter mono">{counter}</span>}
          </div>
          <h1 className="hero-title" data-body="attract" data-strength="0.3" data-range="440">{title}{titleEm && <> <em className="hero-liveword" data-body="attract" data-strength="0.95" data-range="300" data-feedback data-fmin="600" data-fmax="800" data-opsz="96">{titleEm}</em></>}</h1>
        </div>
        <div className="hero-right">
          <div className="hero-meta">
            {meta.map((m, i) => <div key={i} className="hero-meta-row">{m.live && <span className="dot"></span>}<span>{m.text}</span></div>)}
          </div>
        </div>
      </div>
      <div className="hero-baseline" aria-hidden="true"><span className="hero-tick">◆</span><div className="hero-baseline-rule" /><span className="hero-tick">◆</span></div>
    </header>
  );
}

function Frame({ label, children, canvas, style }) {
  return <div className={canvas ? 'frame-canvas' : 'frame'} style={style}>{label && <div className="frame-label">{label}</div>}{children}</div>;
}

function PageFooter({ left, right }) {
  return <footer className="page-footer"><div className="page-footer-meta">{left}</div><div className="page-footer-meta">{right}</div></footer>;
}

/* Formula — a mono expression block for the physics views */
function Formula({ children, color }) {
  return <div className="ds-formula" style={color ? { '--cc': color } : {}}>{children}</div>;
}

/* DemoStage — a live-field demo container. Shows a "go live" overlay when
   the reciprocal field is off, so the affordance is always clear. */
function DemoStage({ label, hint, height = 300, children, style }) {
  return (
    <div className="demo-stage" style={{ height, ...style }}>
      {label && <span className="demo-label">{label}</span>}
      {children}
      {hint && <span className="demo-hint">{hint}</span>}
      <span className="demo-veil"><span className="demo-veil-msg">Activate the <b>Reciprocal Field</b> ↗ to interact</span></span>
    </div>
  );
}

Object.assign(window, { TopBar, FieldToggle, ViewportShell, PageCorners, SectionHeader, PageHero, Frame, PageFooter, Formula, DemoStage, VIEW_TABS });
