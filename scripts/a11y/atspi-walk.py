#!/usr/bin/env python3
"""Walk the AT-SPI2 tree of the Chrome document — the exact accessibility tree a screen reader consumes —
and print role/name/states per node, flagging canvases and anything with aria-hidden semantics."""
import pyatspi, sys
def walk(node, depth=0, out=None, limit=4000):
    if node is None or len(out) > limit: return
    try:
        role = node.getRoleName(); name = (node.name or '').strip().replace('\n', ' ')[:90]
        states = node.getState().getStates()
        st = ','.join(pyatspi.stateToString(s) for s in states if pyatspi.stateToString(s) in ('focusable', 'focused', 'visible', 'showing', 'invalid', 'invisible'))
    except Exception as e:
        out.append(f"{'  '*depth}<error {e}>"); return
    out.append(f"{'  '*depth}{role} | {name} | {st}")
    try:
        for i in range(node.childCount):
            walk(node.getChildAtIndex(i), depth + 1, out, limit)
    except Exception: pass
out = []
desktop = pyatspi.Registry.getDesktop(0)
for i in range(desktop.childCount):
    app = desktop.getChildAtIndex(i)
    try: aname = app.name
    except Exception: continue
    if 'chrom' not in (aname or '').lower(): continue
    out.append(f"APP {aname}")
    walk(app, 1, out)
print('\n'.join(out) if out else 'NO CHROME APPLICATION ON THE AT-SPI BUS')
