# Fundamental × Next.js (App Router)

Shows how to use `@fundamental-engine/react` inside a Next.js App Router project without SSR errors.

## The pattern

`@fundamental-engine` code touches browser APIs. In Next.js, keep it inside a `'use client'` component and load it dynamically with `ssr: false`:

```tsx
// app/components/FieldCanvas.tsx
'use client';
import { FieldField } from '@fundamental-engine/react';
export function FieldCanvas() {
  return <FieldField render="dots" />;
}

// app/page.tsx
import dynamic from 'next/dynamic';
const FieldCanvas = dynamic(
  () => import('./components/FieldCanvas').then(m => m.FieldCanvas),
  { ssr: false }
);
```

The page itself remains a Server Component — only the field layer is client-side.

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
