'use client';

import { FieldField } from '@fundamental-engine/react';
import type { FieldHandle } from '@fundamental-engine/react';

/**
 * The field runs in a 'use client' component so Next.js never executes
 * @fundamental-engine code during SSR (it references browser APIs). The parent page
 * is a Server Component that imports this directly — that import IS the App Router
 * SSR boundary, so no `dynamic(…, { ssr: false })` wrapper is needed (that pattern is
 * for the Pages Router and throws inside an RSC).
 */
export function FieldCanvas() {
  const onReady = (field: FieldHandle) => {
    field.scan();
    (window as unknown as { field?: FieldHandle }).field = field;
  };

  return <FieldField accent="#4da3ff" render="dots" onReady={onReady} />;
}
