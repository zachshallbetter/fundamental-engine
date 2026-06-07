/**
 * Field design tokens, roles, and the output-variable catalog (worldclass §11/§12, interaction
 * §5/§11/§13). Tuning knobs as `--field-*` custom properties, the `data-field-role` value set, and
 * the full list of `--field-*` variables the field can write back (including the attention/memory
 * sub-variables). Pure data + a CSS string builder. (Distinct from `config/tokens.ts`, which is the
 * force-palette token set.)
 */

/** Field tuning tokens (worldclass §11), field-first names. */
export const FIELD_DESIGN_TOKENS: Readonly<Record<string, string>> = {
  '--field-motion-calm': '0.2',
  '--field-motion-active': '0.8',
  '--field-range-sm': '180px',
  '--field-range-md': '320px',
  '--field-range-lg': '520px',
  '--field-density-soft': '0.25',
  '--field-density-lit': '0.65',
  '--field-entropy-warning': '0.72',
};

/** The design tokens as a CSS rule (drop into a stylesheet). */
export function fieldTokensCss(selector = ':root'): string {
  const body = Object.entries(FIELD_DESIGN_TOKENS)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/** Field roles (worldclass §12) — `data-field-role` values. */
export const FIELD_ROLES = ['source', 'sink', 'anchor', 'boundary', 'sensor', 'display'] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

/** Whether a string is a known field role. */
export function isFieldRole(s: string): s is FieldRole {
  return (FIELD_ROLES as readonly string[]).includes(s);
}

/**
 * The full `--field-*` output-variable catalog the field can write back, including the attention
 * and memory sub-variables (interaction §5/§11/§13) and layout shift. The core loop writes the
 * primary metrics today; the sub-vars are the agreed names for the agent layer to emit.
 */
export const FIELD_OUTPUT_VARS = [
  '--field-density',
  '--field-attention',
  '--field-heat',
  '--field-entropy',
  '--field-coherence',
  '--field-memory',
  '--field-pressure',
  '--field-pull-x',
  '--field-pull-y',
  '--field-attention-share',
  '--field-attention-rank',
  '--field-related-attention',
  '--field-path-use',
  '--field-user-wake',
  '--field-layout-shift',
] as const;
