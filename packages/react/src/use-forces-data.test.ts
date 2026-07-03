import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer from 'react-test-renderer';
// Import the BUILT door — node --test type-strips .ts but does not transform JSX, so tests never
// touch the .tsx source. (Same convention as field.test.ts.)
import { useForcesData } from '../dist/index.js';

/**
 * #989 — useForcesData must bind even when the host node is NOT present on the first effect pass.
 * The old effect had `[]` deps and read `containerRef.current` once: null-on-mount meant the binding
 * was skipped forever. The fix tracks the node in STATE so the mount effect re-runs on attach.
 *
 * react-test-renderer runs effects under `act()` without a DOM. We attach the hook's `containerRef`
 * to a real element node via `ref={containerRef}`; `createNodeMock` supplies the stub host element
 * React writes into `.current` at commit. A conditional `{visible && <div ref/>}` reproduces the
 * bug: the host mounts on a LATER render, after the first (null) effect pass. Binding state is read
 * from the hook's `bindingRef` AFTER `act()` — the mount effect runs post-commit, not during render.
 * (`bindData`'s record→body diff is covered by @fundamental-engine/dom; here we prove the retry.)
 */

// Tell React this is an act() environment so effects flush inside act(). Use React's own `act`
// (react-test-renderer's bundled act does not honor the flag) and await it so effects settle.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const act = React.act;

/** The smallest element surface bindData touches for an empty record set: an ownerDocument that can
 *  make elements, plus appendChild. Empty records → no children are created. */
function stubContainer() {
  const make = () => ({
    dataset: {},
    id: '',
    className: '',
    style: {},
    attributes: [],
    appendChild() {},
    removeAttribute() {},
    setAttribute() {},
    remove() {},
  });
  return {
    ownerDocument: { createElement: () => make() },
    appendChild() {},
  };
}

// react-test-renderer hands host refs a mock — supply our stub container for every host node.
const nodeMock = () => stubContainer();

test('binds once the container attaches AFTER the first render (null-first-pass retry)', async () => {
  let show = (_v: boolean) => {};
  let api: { bindingRef: { current: unknown }; inspect: () => unknown } | null = null;

  function Harness() {
    const [visible, setVisible] = React.useState(false); // host absent on first render
    const { containerRef, bindingRef, inspect } = useForcesData([], (r) => ({ id: r.id, body: r.id }));
    show = setVisible;
    api = { bindingRef, inspect };
    // The host <div> only appears once `visible` — its ref attaches on a LATER commit.
    return visible ? React.createElement('div', { ref: containerRef }) : null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: nodeMock });
  });

  // First render: no host mounted → container null → no binding (the exact bug condition pre-fix).
  assert.equal(api!.bindingRef.current, null, 'no binding while the container is absent');
  assert.equal(api!.inspect(), null);

  // The host node appears; its ref attaches and the mount effect must re-run and bind.
  await act(async () => {
    show(true);
  });

  assert.notEqual(api!.bindingRef.current, null, 'binding created once the container attached (retry fired)');

  await act(async () => {
    renderer.unmount();
  });

  // and the mount effect's cleanup nulls the binding on unmount.
  assert.equal(api!.bindingRef.current, null, 'binding torn down on unmount');
});

test('binds on mount when the host is present from the first render', async () => {
  let api: { bindingRef: { current: unknown }; inspect: () => unknown } | null = null;

  function Harness() {
    const { containerRef, bindingRef, inspect } = useForcesData([], (r) => ({ id: r.id, body: r.id }));
    api = { bindingRef, inspect };
    return React.createElement('div', { ref: containerRef }); // host present from the start
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness), { createNodeMock: nodeMock });
  });

  assert.notEqual(api!.bindingRef.current, null, 'binding exists after mount when the host is present');

  await act(async () => {
    renderer.unmount();
  });
});
