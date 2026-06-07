/**
 * VisualBindingRegistry — bind an expressive visual layer (SVG, Canvas, WebGL) to its semantic DOM
 * source without duplicating meaning or harming accessibility. The native primitive field-ui wishes
 * existed: a declarative "this visual represents that semantic element; don't double-expose it".
 *
 * The semantic source stays real HTML; the visual is `aria-hidden` unless it carries independent
 * meaning. `lint()` flags orphan visuals and accessibility hazards.
 */

export type VisualRole = 'decorative' | 'representation' | 'debug' | 'relationship' | 'measurement';

export interface VisualBinding {
  visual: Element;
  semanticSource: Element | null;
  role: VisualRole;
  accessibility: {
    ariaHidden: boolean;
    /** does this role require a semantic source to exist? */
    semanticSourceRequired: boolean;
    /** would screen readers see duplicate text from the visual? */
    duplicateSemantics: boolean;
  };
}

export interface VisualLintWarning {
  visual: Element;
  code: 'orphan-representation' | 'visual-not-hidden' | 'duplicate-semantics';
  severity: 'warning' | 'error';
  message: string;
}

const ariaHidden = (el: Element): boolean => el.getAttribute('aria-hidden') === 'true';

export class VisualBindingRegistry {
  private readonly bindings = new Map<Element, VisualBinding>();

  /** Bind a visual layer to a semantic source. `representation`/`relationship`/etc. need a source. */
  bind(opts: { visual: Element; source?: Element | null; role: VisualRole }): VisualBinding {
    const required = opts.role === 'representation' || opts.role === 'relationship';
    const b: VisualBinding = {
      visual: opts.visual,
      semanticSource: opts.source ?? null,
      role: opts.role,
      accessibility: {
        ariaHidden: ariaHidden(opts.visual),
        semanticSourceRequired: required,
        duplicateSemantics: false,
      },
    };
    this.bindings.set(opts.visual, b);
    return b;
  }

  get(visual: Element): VisualBinding | undefined {
    return this.bindings.get(visual);
  }

  all(): VisualBinding[] {
    return [...this.bindings.values()];
  }

  /** Accessibility lint over the bindings (visual-language §16 rules). */
  lint(): VisualLintWarning[] {
    const out: VisualLintWarning[] = [];
    for (const b of this.bindings.values()) {
      if (b.accessibility.semanticSourceRequired && !b.semanticSource)
        out.push({ visual: b.visual, code: 'orphan-representation', severity: 'error', message: `a ${b.role} visual must bind a semantic source` });
      if (b.role !== 'representation' && !b.accessibility.ariaHidden)
        out.push({ visual: b.visual, code: 'visual-not-hidden', severity: 'warning', message: `a ${b.role} visual with no independent meaning should be aria-hidden` });
    }
    return out;
  }
}
