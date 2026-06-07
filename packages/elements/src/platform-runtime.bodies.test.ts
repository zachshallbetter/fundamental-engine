/**
 * Phase D2 — `syncBodies` registers the scan root's body elements into the MeasurementRegistry
 * exactly once. Tested over a fake sink + root (no DOM).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncBodies } from './platform-runtime.ts';

function fakeSink() {
  const registered = new Set<Element>();
  return {
    registered,
    has: (el: Element) => registered.has(el),
    register: (el: Element) => void registered.add(el),
  };
}

test('syncBodies registers each body element once and re-running adds nothing', () => {
  const a = {} as Element;
  const b = {} as Element;
  const root = { querySelectorAll: () => [a, b] as unknown as NodeListOf<Element> } as unknown as ParentNode;
  const sink = fakeSink();
  assert.equal(syncBodies(sink, root), 2, 'both newly registered');
  assert.equal(sink.registered.size, 2);
  assert.equal(syncBodies(sink, root), 0, 're-run registers nothing already present');
});

test('syncBodies picks up a newly added body on the next pass', () => {
  const a = {} as Element;
  const b = {} as Element;
  let list: Element[] = [a];
  const root = { querySelectorAll: () => list as unknown as NodeListOf<Element> } as unknown as ParentNode;
  const sink = fakeSink();
  assert.equal(syncBodies(sink, root), 1);
  list = [a, b]; // b mounts
  assert.equal(syncBodies(sink, root), 1, 'only the new element is added');
  assert.equal(sink.registered.size, 2);
});
