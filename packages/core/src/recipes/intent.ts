/**
 * The intent compiler (authoring-and-recipes §4). Authors describe intent ("draw-focus") and the
 * compiler emits the concrete force tokens, attributes, and render layers. It is inspectable: the
 * compiled output is plain data the author can read back. Tokens use the current names (viscosity,
 * wall — not the legacy drag/reflect).
 */
import type { RenderLayer } from './schema.ts';

export interface IntentPreset {
  /** force tokens the intent compiles to. */
  body: string[];
  /** default range in px. */
  range?: number;
  /** enable DOM write-back. */
  feedback?: boolean;
  /** render layers the intent turns on. */
  render?: RenderLayer[];
}

/** The intent → composition table (authoring §4), mapped to real force tokens. */
export const INTENT_PRESETS: Readonly<Record<string, IntentPreset>> = {
  'draw-focus': { body: ['attract'], range: 280, feedback: true },
  'clear-space': { body: ['repel'], range: 240 },
  'show-motion': { body: ['stream'], render: ['trails'] },
  'show-relationship': { body: ['memory'], render: ['links'] },
  'contain-energy': { body: ['viscosity', 'wall'] },
  ignite: { body: ['thermal', 'fieldflow'], render: ['heatmap', 'particles'] },
  stabilize: { body: ['viscosity', 'cohesion'] },
  warn: { body: ['repel', 'thermal'], feedback: true },
};

/** The concrete authoring output a compiled intent produces. */
export interface CompiledIntent {
  /** the `data-body` value. */
  body: string;
  strength?: number;
  range?: number;
  feedback: boolean;
  render: RenderLayer[];
  /** the data-* attribute set, ready to apply to an element. */
  attributes: Record<string, string>;
}

export interface IntentOptions {
  /** maps to data-strength (authoring's data-intensity). */
  intensity?: number;
  /** raises thermal/contrast for risky states (authoring's data-risk). */
  risk?: 'low' | 'medium' | 'high';
}

/**
 * Compile an intent + options into a concrete body composition. Returns null for an unknown intent
 * (the author should see that, not get silent defaults).
 */
export function compileIntent(intent: string, opts: IntentOptions = {}): CompiledIntent | null {
  const preset = INTENT_PRESETS[intent];
  if (!preset) return null;
  const body = [...preset.body];
  // a high-risk intent adds a thermal warning layer if not already present
  if (opts.risk === 'high' && !body.includes('thermal')) body.push('thermal');

  const attributes: Record<string, string> = { 'data-body': body.join(' ') };
  if (opts.intensity != null) attributes['data-strength'] = String(opts.intensity);
  if (preset.range != null) attributes['data-range'] = String(preset.range);
  if (preset.feedback) attributes['data-feedback'] = '';
  if (preset.render?.length) attributes['data-render'] = preset.render.join(' ');

  return {
    body: body.join(' '),
    strength: opts.intensity,
    range: preset.range,
    feedback: preset.feedback ?? false,
    render: preset.render ?? ['particles'],
    attributes,
  };
}

/** The known intent names, for inspectors / autocomplete. */
export function knownIntents(): string[] {
  return Object.keys(INTENT_PRESETS);
}
