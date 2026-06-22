import { FieldField } from '@fundamental-engine/react';

const ITEMS = [
  { label: 'Production incident', strength: 1 },
  { label: 'Design review', strength: 0.62 },
  { label: 'PR #318 — signals-first', strength: 0.78 },
  { label: 'Weekly digest', strength: 0.3 },
];

// engagement is just an attribute the field reads — set it on hover/focus, live.
const engage = (e: React.SyntheticEvent<HTMLElement>) => e.currentTarget.setAttribute('data-active', '1');
const release = (e: React.SyntheticEvent<HTMLElement>) => e.currentTarget.setAttribute('data-active', '0');

export function App() {
  return (
    <main>
      {/* The window field, signals-first: it writes --field-* onto the [data-body] elements below and
          draws nothing. Pass render="dots" to see the particles instead. */}
      <FieldField />

      <h1 data-body="attract" data-feedback data-strength="1" data-range="320">Elements have mass.</h1>
      <p className="sub">Hover an item — the field reacts to engagement, no particles drawn.</p>
      <ul className="inbox">
        {ITEMS.map((it) => (
          <li
            key={it.label}
            tabIndex={0}
            data-body="attract"
            data-feedback
            data-strength={it.strength}
            data-range="180"
            onPointerEnter={engage}
            onPointerLeave={release}
            onFocus={engage}
            onBlur={release}
          >
            {it.label}
          </li>
        ))}
      </ul>
    </main>
  );
}
