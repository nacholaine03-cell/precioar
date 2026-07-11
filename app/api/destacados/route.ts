import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Resultado } from '@/lib/types';

// Catálogo curado de MercadoLibre para mostrar antes de que el usuario busque algo.
// Los supermercados (62k+ productos) no tienen un "destacados" razonable sin
// una búsqueda, así que esta sección solo muestra electro/ropa.
export async function GET() {
  if (!supabase) return NextResponse.json({ resultados: [] });

  const { data, error } = await supabase
    .from('ml_productos')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(24);

  if (error || !data) return NextResponse.json({ resultados: [] });

  const resultados: Resultado[] = data.map((row) => ({
    fuente: 'mercadolibre',
    seccion: row.categoria === 'ropa' ? 'tienda' : 'ml',
    id: `ml-${row.id}`,
    titulo: row.titulo,
    precio: Number(row.precio),
    imagen: row.imagen,
    link: row.link,
  }));

  return NextResponse.json({ resultados });
}
