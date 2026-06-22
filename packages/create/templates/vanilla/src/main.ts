import { FieldField } from '@fundamental-engine/vanilla';

const list = document.querySelector<HTMLElement>('[data-field]')!;

// A CONTAINED, signals-only field: it runs the full simulation over the rows but draws nothing
// (render: 'none'). The only output is the --field-* CSS variables — the field is behaviour, not a
// particle background. `bounds` scopes it to this list instead of the window.
const field = new FieldField({ bounds: list, render: 'none', density: 1.4 });

// Engagement is just an attribute the field reads: hover or focus a row and it gathers the (invisible)
// matter toward itself; neighbours feel the shift. The CSS reads --field-density (--d) to show it.
for (const row of list.querySelectorAll<HTMLElement>('li')) {
  row.tabIndex = 0;
  const on = () => row.setAttribute('data-active', '1');
  const off = () => row.setAttribute('data-active', '0');
  row.addEventListener('pointerenter', on);
  row.addEventListener('pointerleave', off);
  row.addEventListener('focus', on);
  row.addEventListener('blur', off);
}

// `field` is the live FieldHandle — field.version, field.scan(), field.setRender('dots'), …
// To SEE particles instead of pure signals, swap render: 'none' → 'dots' above.
