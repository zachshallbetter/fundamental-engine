/** Sample an inline SVG path into field-local points for the core `morph` force. */
export function sampleSvgTarget(
  root: ParentNode,
  _body: HTMLElement,
  selector: string,
  originX: number,
  originY: number,
): readonly { x: number; y: number }[] | undefined {
  if (!selector.startsWith('#')) return undefined;
  let target: Element | null;
  try {
    target = root.querySelector(selector);
  } catch {
    return undefined;
  }
  if (!target) return undefined;
  if (target.namespaceURI !== 'http://www.w3.org/2000/svg' || target.localName !== 'path') return undefined;
  const path = target as SVGPathElement;
  let matrix: DOMMatrix | null;
  let length: number;
  try {
    matrix = path.getScreenCTM();
    length = path.getTotalLength();
  } catch {
    return undefined;
  }
  if (!matrix || !Number.isFinite(length) || length <= 0) return undefined;
  const svg = path.ownerSVGElement;
  if (!svg) return undefined;
  const points: { x: number; y: number }[] = [];
  const count = 96;
  for (let i = 0; i < count; i++) {
    try {
      const p = path.getPointAtLength((length * i) / count);
      const screen = svg.createSVGPoint();
      screen.x = p.x;
      screen.y = p.y;
      const transformed = screen.matrixTransform(matrix);
      points.push({ x: transformed.x - originX, y: transformed.y - originY });
    } catch {
      return undefined;
    }
  }
  return points;
}
