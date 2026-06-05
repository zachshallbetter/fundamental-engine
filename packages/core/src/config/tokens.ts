/**
 * Design tokens (§25.2) — the force palette + coherence + ease as CSS custom
 * properties, derived from the canonical catalog (the single source of truth).
 * Consumers can inject `cssTokens()` into a <style> so CSS can reference
 * `var(--f-attract)`, `var(--coherence)`, `var(--ease)`.
 */
import { FORCES } from './forces.config.ts';

/** A `selector { --f-*: …; --coherence: …; --ease: …; }` block (§25.2). */
export function cssTokens(selector = ':root'): string {
  const lines = FORCES.map((f) => `  --f-${f.id}: ${f.color};`);
  lines.push('  --f-condition: var(--f-jet);');
  lines.push('  --coherence: #ffce6b;');
  lines.push('  --ease: cubic-bezier(0.16, 1, 0.3, 1);');
  return `${selector} {\n${lines.join('\n')}\n}`;
}
