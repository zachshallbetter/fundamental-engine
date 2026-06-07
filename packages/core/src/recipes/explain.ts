/**
 * Explain This Field + Field Diff (authoring-and-recipes §11, §12). Every scene should be
 * explainable in plain language, and every parameter change should be describable as a difference.
 * Both are pure string builders over a recipe / metric snapshots, using the force passports so the
 * explanation reflects the real physics (magnetism curves, fieldflow carries).
 */
import { passportFor } from '../contracts/passport.ts';
import type { SceneRecipe } from './schema.ts';

/** A plain-language explanation of what a scene does, grounded in the force passports. */
export function explainScene(r: SceneRecipe): string {
  const parts: string[] = [];
  for (const b of r.bodies) {
    const tokens = b.body.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const p = passportFor(t);
      if (!p) continue;
      parts.push(`a ${p.label.toLowerCase()} layer (${p.designUse})`);
    }
  }
  const bodyText = parts.length
    ? parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
    : 'no bodies';

  // a transport note when fieldflow rides another force's field
  const tokens = r.bodies.flatMap((b) => b.body.split(/\s+/));
  const transportNote = tokens.includes('fieldflow')
    ? ' Matter follows the field geometry because of fieldflow, not the field-owning force itself.'
    : '';

  const render = r.render.length ? ` The active render stack is ${r.render.join(', ')}.` : '';
  return `"${r.name}" — ${r.intent}. It has ${bodyText}.${transportNote}${render}`;
}

/** A metric snapshot for diffing (e.g. { entropy: 0.22, speed: 1.4, densityCenter: 0.61 }). */
export type MetricSnapshot = Readonly<Record<string, number>>;

/** A plain-language diff between two metric snapshots (authoring §12). */
export function fieldDiff(before: MetricSnapshot, after: MetricSnapshot): string {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const fmt = (s: MetricSnapshot): string =>
    keys.map((k) => `${k} ${k in s ? s[k]!.toFixed(2) : '—'}`).join(', ');
  const changes = keys
    .filter((k) => k in before && k in after && before[k] !== after[k])
    .map((k) => {
      const d = after[k]! - before[k]!;
      return `${k} ${d > 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(2)}`;
    });
  const change = changes.length ? changes.join('; ') : 'no change';
  return `Before: ${fmt(before)}\nAfter: ${fmt(after)}\nChange: ${change}.`;
}
