/**
 * Completion Flare — the "that just happened, here" pattern (#567).
 *
 * This pattern exists because consumers kept building it by hand and building it in the wrong
 * place. The CAPMPrep integration (and others after it) drove a 60fps rAF loop that maxed a
 * transient value into `--d` and decayed it over ~0.6s — writing the channel the ENGINE owns, so
 * the app's flare and the engine's eased density fought over one custom property, and every
 * consumer shipped its own animation driver to do it.
 *
 * The engine's answer is `FieldHandle.pulse(body, energy)`: a decaying one-shot on its own channel
 * (`--field-pulse`), stepped by the field loop. The consumer's event handler is one call; there is
 * no driver to write and nothing to fight over.
 *
 * What this pattern adds on top of the primitive is the STANDING half — the body that gathers
 * matter while it is engaged, so a flare lands on something that already has presence rather than
 * on an inert box. The flare itself stays imperative on purpose (see `notes`).
 *
 * Experimental: lives beside the wayfinding pair in EXPERIMENTAL_PATTERNS, outside the locked 64.
 */
import type { FieldRecipe } from './schema.ts';

export const COMPLETION_FLARE: FieldRecipe = {
  id: 'completion-flare',
  name: 'Completion Flare',
  intent: 'mark an achievement on the body it happened to — a bright transient that decays, over a body that holds its own presence',
  naturalField: 'electromagnetic',
  status: 'experimental',
  primitives: ['attract'],
  concepts: ['flare', 'achievement', 'transient', 'decay', 'acknowledgement'],
  conditions: ['active'],
  bodies: [
    // ONE body, and deliberately a modest one: the standing state is a gentle gather while the
    // element is engaged, so the flare has somewhere to land. The event itself is not a force —
    // `pulse()` moves no matter at all, which is exactly what keeps a celebration from shoving
    // the rest of the page around.
    { body: 'attract', strength: 0.8, range: 220, feedback: true, when: 'active' },
  ],
  render: ['particles'],
  metrics: ['density', 'pulse'],
  diagnostics: ['inspector'],
  accessibility: {
    reducedMotion:
      'the flare is a value, not a movement: --field-pulse still rises and falls on a frozen field (the decay runs on wall time, not the motion budget), so style it as a colour/weight step under prefers-reduced-motion instead of a scale or travel',
    meaningWithoutMotion:
      'the completion is announced in the DOM by the host (a status message, a state change); the flare is an accent on that announcement, never the only report of it',
  },
  notes:
    'Composition: the standing `attract` + `data-feedback` is declarative; the flare is `field.pulse(el)` from the handler that already knows the thing completed. That split is on purpose — the engine has no inbound event vocabulary (`data-on` runs the other way: a field trigger OUT to a DOM CustomEvent), so a declared trigger would have to name an app event the engine cannot see. Read `--field-pulse` alongside `--d` in your own CSS; they are separate channels and never overwrite each other. Energy is additive and saturates at 1, so a burst of completions reads as one brighter flare rather than a stutter. Do NOT reach for `burst(x, y)` here: that is a blast that shoves and heats matter at screen coordinates, and it is not attached to the body the event belongs to.',
};

/** The flare patterns — currently the one completion pattern. */
export const FLARE_PATTERNS: readonly FieldRecipe[] = [COMPLETION_FLARE];
