# Fundamental × Next.js (App Router)

Shows how to use `@fundamental-engine/react` inside a Next.js App Router project without SSR errors.

## The pattern

`@fundamental-engine` code touches browser APIs. In Next.js App Router, mark the field component with `'use client'` — Next.js never executes client components during SSR, so no further guards are needed:

```tsx
// app/components/FieldCanvas.tsx
'use client';
import { FieldField } from '@fundamental-engine/react';
export function FieldCanvas() {
  return <FieldField render="dots" />;
}

// app/page.tsx (a Server Component)
import { FieldCanvas } from './components/FieldCanvas';
export default function Home() {
  return (
    <>
      <FieldCanvas />        {/* executed client-side only */}
      <main>…</main>
    </>
  );
}
```

The page stays a pure Server Component. Importing a `'use client'` component into an RSC is the App Router SSR boundary — no `dynamic(…, { ssr: false })` needed (that pattern is for the Pages Router, and throws in RSC).

## Run it

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # verifies the integration; output: 'export' → out/
```

## Dependencies

| Package | Version |
|---|---|
| `@fundamental-engine/react` | `^0.9.0` |
| `next` | `^15` |
| `react` / `react-dom` | `^18` |
