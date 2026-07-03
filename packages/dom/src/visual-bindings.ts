/**
 * VisualBindingRegistry — bind an expressive visual layer (SVG, Canvas, WebGL) to its semantic DOM
 * source without duplicating meaning or harming accessibility. The native primitive Fundamental wishes
 * existed: a declarative "this visual represents that semantic element; don't double-expose it".
 *
 * The semantic source stays real HTML; the visual is `aria-hidden` unless it carries independent
 * meaning. `lint()` flags orphan visuals and accessibility hazards.
 *
 * Declarative authoring: mark the visual with `data-field-visual-for` (id/selector of the semantic
 * source) and `data-field-visual-role`, then call `scan(root)` to register it. This is the bridge from
 *   semantic HTML + data attributes → VisualBindingRegistry
 * It does NOT extract glyph outlines or generate vector geometry — it only binds an authored visual
 * layer to its source so the field can lint and inspect the pairing.
 *
 * State mirroring (Body Matter Interaction — the Bound Visual tier): the element absorbs field
 * matter; the visual layer shows what that absorption means; the semantic text remains the source
 * of meaning. CSS custom properties don't cross to siblings, so with mirroring enabled
 * (`setMirroring(true)` — the platform default) every `representation`/`measurement` visual
 * receives its source's feedback channels (`--d`/`--field-density`, `--load`, the measured
 * metrics — see MIRRORED_CHANNELS) copied onto its own inline style: an aria-hidden SVG beside a
 * sink heading thickens its contours from `var(--load)` exactly as if it were the body itself.
 * Change-gated via a MutationObserver on the source's style attribute — no polling, no frame cost
 * while the field is quiet.
 */
import { warnIfFrameFrequent } from './dev-warn.ts';

export type VisualRole = 'decorative' | 'representation' | 'debug' | 'relationship' | 'measurement';

const VISUAL_ROLES: readonly VisualRole[] = ['decorative', 'representation', 'debug', 'relationship', 'measurement'];
const isVisualRole = (v: string | null): v is VisualRole => v != null && (VISUAL_ROLES as readonly string[]).includes(v);
/** roles that re-present existing meaning and therefore require a semantic source. */
const requiresSource = (role: VisualRole): boolean => role === 'representation' || role === 'relationship';

export interface VisualBinding {
  visual: Element;
  semanticSource: Element | null;
  role: VisualRole;
  accessibility: {
    ariaHidden: boolean;
    /** does this role require a semantic source to exist? */
    semanticSourceRequired: boolean;
    /** would screen readers see duplicate text from the visual? (source-bound but not hidden) */
    duplicateSemantics: boolean;
  };
}

export interface VisualLintWarning {
  visual: Element;
  code: 'orphan-representation' | 'visual-not-hidden' | 'duplicate-semantics';
  severity: 'warning' | 'error';
  message: string;
}

/** A warning raised while scanning the DOM for declarative bindings (resolution-time, not a11y). */
export interface VisualBindingScanWarning {
  element: Element;
  /** 'unresolved-source' | 'missing-source' | 'invalid-role' */
  reason: string;
  value?: string;
}
export interface VisualBindingScanResult {
  total: number;
  bound: number;
  unresolved: number;
  warnings: VisualBindingScanWarning[];
}

const ariaHidden = (el: Element): boolean => el.getAttribute('aria-hidden') === 'true';

/** The feedback channels a bound visual mirrors from its semantic source — the engine's write-back
 *  lanes (density, sink load, causality, measured metrics). One list, shared with the docs. */
export const MIRRORED_CHANNELS: readonly string[] = [
  '--d',
  '--field-density',
  '--load',
  '--lit',
  '--entropy',
  '--coherence',
  '--temperature',
  '--field-heatmap-density',
];

/** roles that re-present source state and therefore receive mirrored feedback channels. */
const mirrorsState = (b: VisualBinding): boolean =>
  b.semanticSource != null && (b.role === 'representation' || b.role === 'measurement');

type Styled = Element & { style?: { getPropertyValue(k: string): string; setProperty(k: string, v: string): void; removeProperty(k: string): void } };

/** Build the default document-backed source resolver for a scan root (the §"resolution policy"). */
function defaultResolver(root: ParentNode): (ref: string) => Element | null {
  const doc: Document | null =
    (root as Partial<Document>).nodeType === 9 ? (root as unknown as Document) : ((root as Element).ownerDocument ?? null);
  const trySelector = (host: ParentNode | null, sel: string): Element | null => {
    if (!host || typeof host.querySelector !== 'function') return null;
    try {
      return host.querySelector(sel);
    } catch {
      return null; // invalid selector → not a crash
    }
  };
  return (ref: string): Element | null => {
    if (!ref) return null;
    if (ref.startsWith('#')) return trySelector(root, ref) ?? trySelector(doc, ref);
    // bare value: prefer getElementById, then fall back to a (validated) selector
    const byId = doc?.getElementById?.(ref) ?? null;
    if (byId) return byId;
    return trySelector(root, ref);
  };
}

export class VisualBindingRegistry {
  private readonly bindings = new Map<Element, VisualBinding>();
  private mirroring = false;
  private readonly observers = new Map<Element, MutationObserver>();

  /** Bind a visual layer to a semantic source. `representation`/`relationship` need a source. */
  bind(opts: { visual: Element; source?: Element | null; role: VisualRole }): VisualBinding {
    const required = requiresSource(opts.role);
    const hidden = ariaHidden(opts.visual);
    const b: VisualBinding = {
      visual: opts.visual,
      semanticSource: opts.source ?? null,
      role: opts.role,
      accessibility: {
        ariaHidden: hidden,
        semanticSourceRequired: required,
        // a source-bound visual that is NOT hidden re-exposes the source's meaning to AT
        duplicateSemantics: required && !hidden && !!opts.source,
      },
    };
    this.bindings.set(opts.visual, b);
    if (this.mirroring) this.watch(b);
    return b;
  }

  /**
   * Turn source→visual state mirroring on or off for every current and future binding (the Bound
   * Visual tier of Body Matter Interaction). On: each `representation`/`measurement` visual gets an
   * immediate copy of its source's MIRRORED_CHANNELS plus a style-attribute observer that re-copies
   * whenever the engine writes the source (change-gated — quiet field, zero work). Off: observers
   * disconnect; already-mirrored values are left in place (the visual keeps its last honest state).
   */
  setMirroring(on: boolean): void {
    this.mirroring = on;
    if (!on) {
      for (const obs of this.observers.values()) obs.disconnect();
      this.observers.clear();
      return;
    }
    for (const b of this.bindings.values()) this.watch(b);
  }

  /** Copy the source's current feedback channels onto the visual's inline style (one pass). */
  mirrorNow(visual: Element): void {
    const b = this.bindings.get(visual);
    if (!b || !mirrorsState(b)) return;
    const src = b.semanticSource as Styled;
    const dst = b.visual as Styled;
    if (!src.style?.getPropertyValue || !dst.style?.setProperty) return; // non-styled host (tests, SSR)
    for (const channel of MIRRORED_CHANNELS) {
      const value = src.style.getPropertyValue(channel);
      if (value !== '' && value !== dst.style.getPropertyValue(channel)) dst.style.setProperty(channel, value);
    }
  }

  private watch(b: VisualBinding): void {
    this.unwatch(b.visual);
    if (!mirrorsState(b)) return;
    this.mirrorNow(b.visual);
    if (typeof MutationObserver === 'undefined' || !b.semanticSource) return;
    const obs = new MutationObserver(() => this.mirrorNow(b.visual));
    obs.observe(b.semanticSource, { attributes: true, attributeFilter: ['style'] });
    this.observers.set(b.visual, obs);
  }

  private unwatch(visual: Element): void {
    const obs = this.observers.get(visual);
    if (obs) {
      obs.disconnect();
      this.observers.delete(visual);
    }
  }

  /**
   * Discover declarative bindings under `root`: elements carrying `data-field-visual-for` (the source
   * id/selector) and/or `data-field-visual-role`. Calls `bind()` for each. Idempotent — bindings are
   * keyed by the visual element, so re-scanning updates role/source/aria-hidden without duplicating,
   * and disconnected visuals are pruned. `resolve` defaults to a document-backed resolver.
   */
  scan(root: ParentNode, resolve: (ref: string) => Element | null = defaultResolver(root)): VisualBindingScanResult {
    // layout-traversal trap: scan() walks the DOM with querySelectorAll to (re)discover declarative
    // bindings. It is meant to run on mount / mutation, not every frame — warn once (dev-only) if it
    // is being called at frame frequency. Once bound, mirroring is change-gated via MutationObserver,
    // so per-frame rescans are pure overhead.
    warnIfFrameFrequent(
      'VISUAL_BINDING_SCAN',
      'VisualBindingRegistry.scan() is being called at frame frequency — it walks the DOM (querySelectorAll) to rediscover bindings. Scan on mount / DOM mutation, not every frame (mirroring is already change-gated via MutationObserver).',
    );
    // navigation hygiene: drop bindings whose visual OR source left the DOM (and stop mirroring
    // them). Pruning only on the visual leaves a MutationObserver pinned to a removed source —
    // holding that detached source subtree alive for as long as the visual stays mounted.
    for (const [el, b] of this.bindings)
      if (el.isConnected === false || b.semanticSource?.isConnected === false) {
        this.unwatch(el);
        this.bindings.delete(el);
      }

    const visuals = [...root.querySelectorAll('[data-field-visual-for], [data-field-visual-role], [data-visual-for]')];
    const warnings: VisualBindingScanWarning[] = [];
    let unresolved = 0;

    for (const visual of visuals) {
      const value = visual.getAttribute('data-field-visual-for') ?? visual.getAttribute('data-visual-for');
      const roleAttr = visual.getAttribute('data-field-visual-role');

      let role: VisualRole;
      if (roleAttr == null) {
        role = 'representation'; // role omitted but selected via data-field-visual-for → representation
      } else if (isVisualRole(roleAttr)) {
        role = roleAttr;
      } else {
        role = 'representation'; // invalid role → default + warn
        warnings.push({ element: visual, reason: 'invalid-role', value: roleAttr });
      }

      const source = value ? resolve(value) : null;
      if (requiresSource(role) && !source) {
        unresolved++;
        warnings.push({ element: visual, reason: value ? 'unresolved-source' : 'missing-source', value: value ?? undefined });
      }

      this.bind({ visual, source, role });
    }

    return { total: visuals.length, bound: visuals.length, unresolved, warnings };
  }

  get(visual: Element): VisualBinding | undefined {
    return this.bindings.get(visual);
  }

  all(): VisualBinding[] {
    return [...this.bindings.values()];
  }

  get size(): number {
    return this.bindings.size;
  }

  /** Accessibility lint over the bindings (visual-language §16 rules). */
  lint(): VisualLintWarning[] {
    const out: VisualLintWarning[] = [];
    for (const b of this.bindings.values()) {
      if (b.accessibility.semanticSourceRequired && !b.semanticSource)
        out.push({ visual: b.visual, code: 'orphan-representation', severity: 'error', message: `a ${b.role} visual must bind a semantic source` });
      else if (!b.accessibility.ariaHidden) {
        if (requiresSource(b.role))
          out.push({ visual: b.visual, code: 'duplicate-semantics', severity: 'warning', message: `a ${b.role} visual must be aria-hidden so assistive tech reads only the semantic source` });
        else
          out.push({ visual: b.visual, code: 'visual-not-hidden', severity: 'warning', message: `a ${b.role} visual with no independent meaning should be aria-hidden` });
      }
    }
    return out;
  }
}
