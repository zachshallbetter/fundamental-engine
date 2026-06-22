// Importing the package registers <field-root> and boots the engine — that's the whole wiring.
// The field is signals-first: it writes --field-* onto the [data-body] elements; styles.css reacts.
import '@fundamental-engine/elements';

// Engage bodies on hover so the field gathers toward them (and neighbours respond), live.
for (const el of document.querySelectorAll<HTMLElement>('[data-body]')) {
  el.addEventListener('pointerenter', () => el.setAttribute('data-active', '1'));
  el.addEventListener('pointerleave', () => el.setAttribute('data-active', '0'));
}
