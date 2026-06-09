/**
 * The HARD gate for the frozen public API surface (field-ui 0.x). This file is typechecked by
 * `pnpm check:api` (tsconfig.api.json). It imports every frozen VALUE and TYPE from its owning
 * package, so removing, renaming, or changing the kind of any frozen symbol becomes a COMPILE ERROR
 * right here — the freeze cannot be broken silently.
 *
 * The human-readable contract is docs/canonical/field-ui-api-stability.md; the shared data (for the
 * runtime element/attribute lock and the docs page) is scripts/api-surface.data.mjs. Editing this
 * file changes the public contract — see the compatibility rules in that doc.
 *
 * Note: a value-import of a type-only export (or vice versa) is itself an error under
 * verbatimModuleSyntax, so these imports also lock each symbol's KIND, not just its presence.
 */
import { createField as coreCreateField, compileRecipe } from '@field-ui/core';
import type { FieldRecipe, FieldHost, FieldHandle, OverlayMode } from '@field-ui/core';
import { browserHost, createFieldPlatform, applyRecipe, bindData } from '@field-ui/platform';
import type { FieldPlatform } from '@field-ui/platform';
import { createField as vanillaCreateField, browserHost as vanillaBrowserHost } from '@field-ui/vanilla';

// Reference every frozen VALUE so its removal/rename is a compile error here.
const FROZEN_VALUES = [
  coreCreateField,
  compileRecipe,
  browserHost,
  createFieldPlatform,
  applyRecipe,
  bindData,
  vanillaCreateField,
  vanillaBrowserHost,
] as const;
void FROZEN_VALUES;

// Reference every frozen TYPE so its removal/rename is a compile error here.
export type __FrozenTypes = [FieldRecipe, FieldHost, FieldPlatform];

// Field Surfaces (additive): lock the overlay-surface API onto the handle, so removing/renaming
// `setOverlay` or `OverlayMode` becomes a compile error here too. See field-ui-api-stability.md.
export type __OverlayApi = [FieldHandle['setOverlay'], OverlayMode];
