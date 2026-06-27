import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fundamental × Next.js',
  description: 'Reciprocal DOM-physics field in a Next.js App Router project.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
