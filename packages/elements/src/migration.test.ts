/**
 * field-ui migration: component aliases (docs/planning-archive/field-ui-migration-plan.md §3). The live
 * `customElements.define` calls are guarded for SSR and so are not exercised in the node:test
 * harness (no DOM) — same as the original `forces-field` / `forces-cell` registrations. What is
 * checkable here is that importing the package is SSR-safe and that the field-* alias classes
 * exist and subclass the originals, sharing their behaviour and body contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ForcesField,
  ForcesCell,
  FieldField,
  FieldRoot,
  FieldCell,
  FIELD_REGISTER_BODY,
  FIELD_UNREGISTER_BODY,
  FIELD_UPDATE_BODY,
} from './index.ts';

test('forces-* element aliases subclass their field-* canonicals', () => {
  // FieldField/FieldCell are canonical; the forces-* aliases subclass them, and <field-root>
  // is a thin subclass of FieldField — so the old tags keep the same behaviour and contract.
  assert.ok(ForcesField.prototype instanceof FieldField, '<forces-field> ⊂ FieldField');
  assert.ok(FieldRoot.prototype instanceof FieldField, '<field-root> ⊂ FieldField');
  assert.ok(ForcesCell.prototype instanceof FieldCell, '<forces-cell> ⊂ FieldCell');
  // static inheritance too, so observedAttributes / behaviour carry over unchanged
  assert.equal(Object.getPrototypeOf(ForcesField), FieldField);
  assert.equal(Object.getPrototypeOf(ForcesCell), FieldCell);
});

test('elements re-exports the field:* event aliases', () => {
  assert.equal(FIELD_REGISTER_BODY, 'field:register-body');
  assert.equal(FIELD_UNREGISTER_BODY, 'field:unregister-body');
  assert.equal(FIELD_UPDATE_BODY, 'field:update-body');
});
