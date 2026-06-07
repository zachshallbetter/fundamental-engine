import { cellForce } from './cell-force.ts';
import { HTMLElementBase } from './base.ts';

/** A single particle in the cell's pool (frame-local coordinates). */
interface CellParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * `<forces-cell force="swirl" color="#2dd4bf">` — an in-frame field surface (§25.1).
 *
 * A standalone field sized to its container that renders *one* force, with its own
 * lightweight particle pool, its own pointer interaction, and a lifecycle that pauses
 * when off-screen. It is **not** the §-engine: it's a lighter "demo/poster" engine,
 * completely separate from the page `<forces-field>` and the core field loop.
 *
 * - `ResizeObserver` re-fits the canvas (DPR-aware) and rebuilds the pool.
 * - `IntersectionObserver` gates the rAF loop — paused when off-screen.
 * - Honours `prefers-reduced-motion`: renders one static frame, no animation.
 */
export class ForcesCell extends HTMLElementBase {
  static readonly observedAttributes = ['force', 'color', 'count'];

  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private particles: CellParticle[] = [];
  private raf = 0;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;

  /** frame box in CSS pixels (post-DPR transform space). */
  private boxW = 0;
  private boxH = 0;

  /** cursor in frame-local CSS px, or null when absent. */
  private cursorX: number | null = null;
  private cursorY: number | null = null;

  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerLeave: () => void;
  private readonly tick: () => void;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent =
      ':host{display:block;position:relative}' +
      'canvas{width:100%;height:100%;display:block}';
    this.canvas = document.createElement('canvas');
    root.append(style, this.canvas);

    this.onPointerMove = (e: PointerEvent): void => {
      const rect = this.canvas.getBoundingClientRect();
      this.cursorX = e.clientX - rect.left;
      this.cursorY = e.clientY - rect.top;
    };
    this.onPointerLeave = (): void => {
      this.cursorX = null;
      this.cursorY = null;
    };
    this.tick = (): void => {
      this.step();
      this.raf = requestAnimationFrame(this.tick);
    };
  }

  /** the force this cell demonstrates (§25.1). */
  get force(): string {
    return this.getAttribute('force') ?? 'attract';
  }

  /** dot colour. */
  get color(): string {
    return this.getAttribute('color') ?? '#4da3ff';
  }

  /** particle count; `0` (default) means auto-size to the frame area. */
  get count(): number {
    const v = Number(this.getAttribute('count'));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  }

  attributeChangedCallback(): void {
    // force/color read live each frame; count change rebuilds on next resize.
    if (this.isPrefersReducedMotion() && this.ctx) this.step();
  }

  connectedCallback(): void {
    // a decorative demo surface — hide it from assistive tech (§18 a11y).
    if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this);
    this.fit();

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) this.start();
      else this.stop();
    });
    this.intersectionObserver.observe(this);

    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('pointerleave', this.onPointerLeave);
  }

  disconnectedCallback(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.removeEventListener('pointermove', this.onPointerMove);
    this.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private isPrefersReducedMotion(): boolean {
    return (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Fit the canvas to the element box (DPR-aware) and rebuild the pool. */
  private fit(): void {
    if (!this.ctx) return;
    const rect = this.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.boxW = w;
    this.boxH = h;

    const dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.buildPool();

    // Static cells (reduced motion or off-screen) get one fresh frame.
    if (!this.raf) this.step();
  }

  /** Build the particle pool sized to the frame area. */
  private buildPool(): void {
    const area = this.boxW * this.boxH;
    const n = this.count > 0 ? this.count : clamp(Math.round(area / 9000), 16, 90);
    const pool: CellParticle[] = [];
    for (let i = 0; i < n; i++) {
      pool.push({
        x: Math.random() * this.boxW,
        y: Math.random() * this.boxH,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }
    this.particles = pool;
  }

  private start(): void {
    if (this.raf) return;
    if (this.isPrefersReducedMotion()) {
      this.step(); // one static frame, no loop
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Advance + render one frame. */
  private step(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.boxW;
    const H = this.boxH;
    const cx = W / 2;
    const cy = H / 2;
    const reach = Math.min(W, H) * 0.62;
    const force = this.force;
    const color = this.color;
    const animate = this.raf !== 0;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    for (const p of this.particles) {
      if (animate) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const { ax, ay } = cellForce(force, dx, dy, reach);
        p.vx += ax;
        p.vy += ay;

        // Per-cell cursor repel (§25.1).
        if (this.cursorX !== null && this.cursorY !== null) {
          const rx = p.x - this.cursorX;
          const ry = p.y - this.cursorY;
          const dd = Math.hypot(rx, ry);
          if (dd > 0 && dd < 80) {
            const push = (1 - dd / 80) * 1.8;
            p.vx += (rx / dd) * push;
            p.vy += (ry / dd) * push;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;

        // Wrap edges.
        if (p.x < 0) p.x += W;
        else if (p.x >= W) p.x -= W;
        if (p.y < 0) p.y += H;
        else if (p.y >= H) p.y -= H;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('forces-cell')) {
  customElements.define('forces-cell', ForcesCell);
}

/**
 * `<field-cell>` — field-ui-migration alias of `<forces-cell>` (a thin subclass, since the
 * registry forbids two tag names per constructor). Identical behaviour; prefer `<field-cell>`
 * in new markup. `<forces-cell>` keeps working until the migration removal version.
 */
export class FieldCell extends ForcesCell {}

if (typeof customElements !== 'undefined' && !customElements.get('field-cell')) {
  customElements.define('field-cell', FieldCell);
}

declare global {
  interface HTMLElementTagNameMap {
    'forces-cell': ForcesCell;
    'field-cell': FieldCell;
  }
}
