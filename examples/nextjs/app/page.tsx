import dynamic from 'next/dynamic';

// Belt-and-suspenders: even though FieldCanvas is 'use client', dynamic ssr:false
// guarantees Next.js never executes engine code during SSR — the component is
// injected after hydration only.
const FieldCanvas = dynamic(
  () => import('./components/FieldCanvas').then((m) => m.FieldCanvas),
  { ssr: false },
);

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
