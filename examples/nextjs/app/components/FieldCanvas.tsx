'use client';

import { FieldField } from '@fundamental-engine/react';
import type { FieldHandle } from '@fundamental-engine/react';

/**
 * The field runs in a 'use client' component so Next.js never tries to SSR
 * @fundamental-engine code (it references browser APIs). The parent page imports
 * this via `dynamic(…, { ssr: false })` for belt-and-suspenders safety.
 */
export function FieldCanvas() {
  const onReady = (field: FieldHandle) => {
    field.scan();
    (window as unknown as { field?: FieldHandle }).field = field;
  };

  return <FieldField accent="#4da3ff" render="dots" onReady={onReady} />;
}
