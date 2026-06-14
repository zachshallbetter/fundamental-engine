/**
 * Bound Visual state mirroring (Body Matter Interaction): with mirroring enabled, a
 * representation/measurement visual receives its semantic source's feedback channels
 * (--d / --load / the metrics) on its own inline style — the sibling-SVG case CSS
 * inheritance can't reach. Exercised with fake styled elements (no document needed),
 * mirroring the visual-scan tests' style.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VisualBindingRegistry, MIRRORED_CHANNELS } from './visual-bindings.ts';

type Attrs = Record<string, string>;
type StyleMap = Record<string, string>;

function styledEl(attrs: Attrs = {}, style: StyleMap = {}): Element {
  const el = {
    _attrs: { ...attrs },
    _style: { ...style },
    isConnected: true,
    getAttribute(this: { _attrs: Attrs }, name: string): string | null {
      return name in this._attrs ? this._attrs[name]! : null;
    },
    style: {
      getPropertyValue(k: string): string {
        return (el as { _style: StyleMap })._style[k] ?? '';
      },
      setProperty(k: string, v: string): void {
        (el as { _style: StyleMap })._style[k] = v;
      },
      removeProperty(k: string): void {
        delete (el as { _style: StyleMap })._style[k];
      },
    },
  };
  return el as unknown as Element;
}
const styleOf = (el: Element): StyleMap => (el as unknown as { _style: StyleMap })._style;

test('setMirroring(true) copies the source feedback channels onto a representation visual', () => {
  const reg = new VisualBindingRegistry();
  const source = styledEl({}, { '--load': '0.42', '--d': '0.130', '--unrelated': '7' });
  const svg = styledEl({ 'aria-hidden': 'true' });
  reg.bind({ visual: svg, source, role: 'representation' });
  reg.setMirroring(true);
  assert.equal(styleOf(svg)['--load'], '0.42');
  assert.equal(styleOf(svg)['--d'], '0.130');
  assert.equal(styleOf(svg)['--unrelated'], undefined, 'only MIRRORED_CHANNELS cross');
});

test('a binding made while mirroring is on mirrors immediately', () => {
  const reg = new VisualBindingRegistry();
  reg.setMirroring(true);
  const source = styledEl({}, { '--mass': '0.900' });
  const meter = styledEl({ 'aria-hidden': 'true' });
  reg.bind({ visual: meter, source, role: 'measurement' });
  assert.equal(styleOf(meter)['--mass'], '0.900');
});

test('decorative and debug visuals do not mirror', () => {
  const reg = new VisualBindingRegistry();
  reg.setMirroring(true);
  const source = styledEl({}, { '--load': '1.000' });
  const deco = styledEl({ 'aria-hidden': 'true' });
  reg.bind({ visual: deco, source, role: 'decorative' });
  assert.equal(styleOf(deco)['--load'], undefined);
});

test('mirrorNow re-copies after the source advances (the observer path, driven by hand)', () => {
  const reg = new VisualBindingRegistry();
  const source = styledEl({}, { '--load': '0.100' });
  const svg = styledEl({ 'aria-hidden': 'true' });
  reg.bind({ visual: svg, source, role: 'representation' });
  reg.setMirroring(true);
  styleOf(source)['--load'] = '0.750'; // the engine writes the sink fill
  reg.mirrorNow(svg);
  assert.equal(styleOf(svg)['--load'], '0.750');
});

test('scan prunes a binding whose SOURCE element left the DOM (no observer pinned to a detached source)', () => {
  const reg = new VisualBindingRegistry();
  const source = styledEl({}, {});
  const svg = styledEl({ 'data-field-visual-role': 'representation' });
  reg.bind({ visual: svg, source, role: 'representation' });
  reg.setMirroring(true);
  assert.equal(reg.size, 1);

  // source removed while the visual stays mounted — the old prune (visual-only) would miss this.
  (source as unknown as { isConnected: boolean }).isConnected = false;
  reg.scan({ querySelectorAll: () => [] } as unknown as ParentNode, () => null);
  assert.equal(reg.get(svg), undefined, 'binding dropped when its source detaches');
  assert.equal(reg.size, 0, 'no lingering binding pinning the removed source');
});

test('empty source channels are not written; the channel list is the contract', () => {
  const reg = new VisualBindingRegistry();
  const source = styledEl({}, {}); // nothing written yet — a quiet field
  const svg = styledEl({ 'aria-hidden': 'true' });
  reg.bind({ visual: svg, source, role: 'representation' });
  reg.setMirroring(true);
  assert.deepEqual(styleOf(svg), {}, 'no phantom values');
  assert.ok(MIRRORED_CHANNELS.includes('--load') && MIRRORED_CHANNELS.includes('--field-density'));
});
