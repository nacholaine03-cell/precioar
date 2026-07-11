import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PreciosAr — Encontrá el precio más barato',
  description: 'Compará precios de MercadoLibre y supermercados en un solo lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-neutral-950 text-neutral-900">{children}</body>
    </html>
  );
}
