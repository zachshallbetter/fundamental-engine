/* ──────────────────────────────────
   FORCES — MARK EXPLORATION
   Candidate marks for the Forces identity. Each is a 48-grid SVG that
   inherits `color` (so it works in accent, ink, or knockout). Concepts
   lean on the brand thesis: forces, fields, reciprocity, bodies.
────────────────────────────────── */
const SW = 2.3;

const MARKS = {
  /* 0 — CURRENT: four arrows converging on a node */
  current: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none" />
      <path d="M24 5 V14" /><path d="M20 10 L24 14 L28 10" />
      <path d="M24 43 V34" /><path d="M20 38 L24 34 L28 38" />
      <path d="M5 24 H14" /><path d="M10 20 L14 24 L10 28" />
      <path d="M43 24 H34" /><path d="M38 20 L34 24 L38 28" />
    </g>
  ),

  /* 1 — RECIPROCAL CYCLE: two arc-arrows, action ↔ reaction */
  cycle: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 24 A15 15 0 0 1 39 24" />
      <path d="M35 20 L39 24 L43 20" />
      <path d="M39 24 A15 15 0 0 1 9 24" />
      <path d="M13 28 L9 24 L5 28" />
    </g>
  ),

  /* 2 — DIPOLE FIELD: two poles, curved field lines bowing around */
  dipole: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 8 C 13 16, 13 32, 24 40" />
      <path d="M24 8 C 35 16, 35 32, 24 40" />
      <path d="M24 8 C 5 15, 5 33, 24 40" opacity="0.45" />
      <path d="M24 8 C 43 15, 43 33, 24 40" opacity="0.45" />
      <circle cx="24" cy="8" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="24" cy="40" r="2.6" fill="currentColor" stroke="none" />
    </g>
  ),

  /* 3 — FREE BODY: a node with force vectors radiating (a force diagram) */
  freebody: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="3.8" fill="currentColor" stroke="none" />
      <path d="M24 19 V7" /><path d="M20 11 L24 7 L28 11" />
      <path d="M20 28 L10 38" /><path d="M10 32.5 L10 38 L15.5 38" />
      <path d="M28 28 L38 38" /><path d="M38 32.5 L38 38 L32.5 38" />
    </g>
  ),

  /* 4 — ORBIT: a body, an orbit, a satellite — bodies in a field */
  orbit: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="24" cy="24" rx="17" ry="8" transform="rotate(-22 24 24)" />
      <circle cx="24" cy="24" r="4" fill="currentColor" stroke="none" />
      <circle cx="39.8" cy="17.6" r="2.6" fill="currentColor" stroke="none" />
    </g>
  ),

  /* 5 — FIELD WARP: parallel lines bending into a body (lensing) */
  warp: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11 C 22 13, 31 18, 35.5 23" />
      <path d="M7 24 H33" />
      <path d="M7 37 C 22 35, 31 30, 35.5 25" />
      <circle cx="37" cy="24" r="3.4" fill="currentColor" stroke="none" />
    </g>
  ),

  /* 6 — RECIPROCAL PAIR: two bodies, each pulling the other */
  pair: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="24" r="3.6" fill="currentColor" stroke="none" />
      <circle cx="36" cy="24" r="3.6" fill="currentColor" stroke="none" />
      <path d="M17 17.5 H31" /><path d="M27.5 14 L31 17.5 L27.5 21" />
      <path d="M31 30.5 H17" /><path d="M20.5 27 L17 30.5 L20.5 34" />
    </g>
  ),

  /* 7 — APERTURE: six chords forming an iris — forces meeting */
  aperture: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 8 L33.5 13.5 L33.5 24" />
      <path d="M33.5 24 L33.5 34.5 L24 40" />
      <path d="M24 40 L14.5 34.5 L14.5 24" />
      <path d="M14.5 24 L14.5 13.5 L24 8" />
      <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
    </g>
  ),

  /* 8 — F-VECTOR: an F whose arms are force vectors */
  fvector: (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 8 V40" />
      <path d="M15 10 H35" /><path d="M31 6 L35 10 L31 14" />
      <path d="M15 24 H29" /><path d="M25 20 L29 24 L25 28" />
    </g>
  ),

  /* 9 — ORBITAL: a central body, orbital trajectories, and bodies caught
     in the field (some solid, some hollow). The orbits are where the
     particles live. Faithful to the supplied geometry. */
  orbital: (
    <g fill="none" stroke="currentColor" strokeWidth="21" strokeLinecap="round" strokeMiterlimit="10">
      <circle cx="230.4" cy="210.9" r="89.1" />
      <path d="M393.7,327.2c12.6-17.7,22.5-37.8,29-59.8,31.2-106.2-29.6-217.6-135.8-248.8-44.1-12.9-89-10.1-128.7,5.3" />
      <circle cx="369.9" cy="354.8" r="34.7" />
      <circle cx="45.2" cy="286.4" r="34.7" />
      <path d="M61.7,318.5c44.5,70,128.4,105.3,209.6,88.3" />
      <circle cx="139" cy="315.4" r="16.1" fill="currentColor" stroke="none" />
      <circle cx="92" cy="65.7" r="22.2" fill="currentColor" stroke="none" />
    </g>
  ),
};

/* per-mark viewBox (default 48-grid) */
const MARK_VB = { orbital: '0 0 441.4 421.5' };

function Mark({ name, s = 48, color = 'currentColor', style }) {
  return (
    <svg width={s} height={s} viewBox={MARK_VB[name] || '0 0 48 48'} preserveAspectRatio="xMidYMid meet"
      style={{ color, display: 'block', overflow: 'visible', ...style }}>
      {MARKS[name]}
    </svg>
  );
}
window.Mark = Mark;
window.MARK_NAMES = Object.keys(MARKS);
