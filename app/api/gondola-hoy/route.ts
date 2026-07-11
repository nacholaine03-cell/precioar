import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Resultado } from '@/lib/types';

// SEPA no trae categoría por producto, así que agrupamos por palabras clave.
// No es perfecto, pero cubre bien los rubros más buscados de un súper.
const CATEGORIAS: { nombre: string; emoji: string; palabras: string[] }[] = [
  { nombre: 'Almacén', emoji: '🥫', palabras: ['fideos', 'arroz', 'harina', 'aceite', 'azucar', 'yerba', 'cafe', 'galletitas', 'atun', 'conserva'] },
  { nombre: 'Bebidas', emoji: '🥤', palabras: ['gaseosa', 'cerveza', 'vino', 'agua', 'jugo'] },
  { nombre: 'Limpieza', emoji: '🧼', palabras: ['detergente', 'lavandina', 'jabon polvo', 'limpiador', 'suavizante', 'lavavajilla'] },
  { nombre: 'Perfumería', emoji: '🧴', palabras: ['shampoo', 'papel higienico', 'pasta dental', 'desodorante', 'jabon tocador'] },
  { nombre: 'Lácteos', emoji: '🥛', palabras: ['leche', 'queso', 'yogur', 'manteca'] },
];

// Filtramos precios irrisorios (ej. $0.01) que son errores de carga en SEPA,
// no ofertas reales — si no, siempre "ganan" el ranking de más barato.
const PRECIO_MINIMO_RAZONABLE = 50;

function aResultado(row: any): Resultado {
  return {
    fuente: 'supermercado',
    seccion: 'gondola',
    id: `${row.cadena}-${row.producto_id}`,
    titulo: row.producto_nombre,
    precio: Number(row.precio),
    imagen: row.imagen ?? null,
    link: '#',
    cadena: row.cadena,
  };
}

// Sin provincia seleccionada, cada producto tiene una fila por provincia —
// hay que agrupar por cadena+producto para no mostrar el mismo varias veces.
function dedupeSinProvincia(filas: any[], provincia?: string): any[] {
  if (provincia) return filas;
  const porClave = new Map<string, any>();
  for (const fila of filas) {
    const clave = `${fila.cadena}-${fila.producto_id}`;
    const actual = porClave.get(clave);
    if (!actual || fila.precio < actual.precio) porClave.set(clave, fila);
  }
  return Array.from(porClave.values());
}

async function masBaratosDeCategoria(palabras: string[], limite: number, provincia?: string) {
  if (!supabase) return [];
  const condiciones = palabras.map((p) => `producto_nombre.ilike.%${p}%`).join(',');
  let builder = supabase
    .from('sepa_precios')
    .select('*')
    .or(condiciones)
    .gte('precio', PRECIO_MINIMO_RAZONABLE)
    .not('producto_nombre', 'ilike', '%envase%');
  if (provincia) builder = builder.eq('provincia', provincia);
  // Sin provincia pedimos de más porque después se agrupa por producto.
  const { data } = await builder.order('precio', { ascending: true }).limit(provincia ? limite : limite * 8);
  const filas = dedupeSinProvincia(data ?? [], provincia)
    .sort((a, b) => a.precio - b.precio)
    .slice(0, limite);
  return filas.map(aResultado);
}

async function ultimaActualizacion(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('sepa_precios')
    .select('actualizado_en')
    .order('actualizado_en', { ascending: false })
    .limit(1);
  return data?.[0]?.actualizado_en ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provincia = searchParams.get('provincia')?.trim() || undefined;

  const [categorias, carrusel, actualizado_en] = await Promise.all([
    Promise.all(
      CATEGORIAS.map(async (c) => ({
        nombre: c.nombre,
        emoji: c.emoji,
        items: await masBaratosDeCategoria(c.palabras, 8, provincia),
      }))
    ),
    masBaratosDeCategoria(CATEGORIAS.flatMap((c) => c.palabras), 12, provincia),
    ultimaActualizacion(),
  ]);

  return NextResponse.json({
    categorias: categorias.filter((c) => c.items.length > 0),
    carrusel,
    actualizado_en,
  });
}
