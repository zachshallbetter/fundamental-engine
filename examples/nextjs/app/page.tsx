// In App Router, importing a 'use client' component from a Server Component is
// already enough — Next.js never executes client components during SSR. The
// `dynamic(…, { ssr: false })` pattern is for the Pages Router or for Client
// Components that want to lazy-load another Client Component; it throws when
// used in a Server Component (Next.js 13+).
import { FieldCanvas } from './components/FieldCanvas';

export default function Home() {
  return (
    <>
      <FieldCanvas />
      <main>
        <h1 data-body="gravity" data-strength="1" data-range="360" data-feedback>
          Fundamental
        </h1>
        <p>
          A reciprocal DOM-physics field inside a Next.js App Router project. Every
          element with <code>data-body</code> bends the field; the field bends back.
        </p>
        <nav>
          <a href="#" data-body="attract" data-strength="0.9" data-range="300" data-feedback>
            pull me
          </a>
          <a href="#" data-body="charge" data-strength="0.8" data-range="260" data-feedback>
            charge me
          </a>
        </nav>
      </main>
    </>
  );
}
