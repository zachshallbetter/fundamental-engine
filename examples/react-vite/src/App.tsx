import { useRef } from 'react';
import { FieldField } from '@fundamental-engine/react';
import type { FieldHandle } from '@fundamental-engine/react';

/**
 * Canonical React usage of Fundamental.
 *
 * `<FieldField>` mounts a fixed, full-viewport canvas behind the app and runs
 * the engine on it. Any element carrying `data-body` becomes a *body* that bends
 * the field; the field's local density bends the bodies back (reciprocity).
 * `render="dots"` opts into drawing — the default render mode is 'none'.
 */
export function App() {
  const fieldRef = useRef<FieldHandle | null>(null);

  return (
    <>
      <FieldField
        accent="#4da3ff"
        render="dots"
        onReady={(field) => {
          fieldRef.current = field;
          // Re-pick-up [data-body] elements once React has painted them.
          field.scan();
          // Expose the live handle so the smoke test can read particleCount().
          (window as unknown as { field?: FieldHandle }).field = field;
        }}
      />

      <main className="page">
        <h1 data-body="gravity" data-strength="1" data-range="360" data-feedback>
          Fundamental
        </h1>

        <p className="lede">
          A reciprocal DOM-physics field, mounted with one React component. The
          words below are <em>bodies</em>: they bend the invisible field, and the
          field bends back.
        </p>

        <nav className="links">
          <a
            href="#pull"
            data-body="attract"
            data-strength="0.9"
            data-range="320"
            data-feedback
          >
            pull me
          </a>
          <a
            href="#charge"
            data-body="charge"
            data-strength="0.8"
            data-range="280"
            data-feedback
          >
            charge me
          </a>
          <button
            type="button"
            data-body="sink"
            data-strength="1"
            data-range="240"
            data-absorb="0"
            data-max="50"
            data-feedback
            onClick={() =>
              fieldRef.current?.burst(window.innerWidth / 2, window.innerHeight / 2)
            }
          >
            burst
          </button>
        </nav>
      </main>
    </>
  );
}
