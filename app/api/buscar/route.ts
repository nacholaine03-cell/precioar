import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Resultado } from '@/lib/types';

// Palabras demasiado cortas/comunes en español como para aportar algo a la
// búsqueda — si las dejamos, matchean como substring de cualquier cosa
// (ej. "no" aparece dentro de "mig-NO-n") y llenan de ruido los resultados.
const VACIAS = new Set([
  'de', 'la', 'el', 'los', 'las', 'no', 'en', 'con', 'sin', 'para', 'por',
  'un', 'una', 'del', 'al', 'y', 'o', 'x',
]);

function palabras(query: string): string[] {
  return query
    .split(/\s+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 2 && !VACIAS.has(p))
    .slice(0, 6);
}

type FilaConRelevancia = { fila: any; relevancia: number };

// Primero intenta que TODAS las palabras aparezcan (más preciso, relevancia
// máxima). Si eso no devuelve nada — típico cuando alguien pega una
// descripción larga de otro sitio y SEPA usa nombres mucho más cortos —
// reintenta pidiendo que aparezca AL MENOS UNA palabra, calculando cuántas
// matchea cada fila para poder ordenar por relevancia y no solo por precio.
// Sin provincia seleccionada, cada producto tiene una fila por provincia
// (el más barato encontrado ahí) — hay que agrupar por cadena+producto y
// quedarnos con la más barata de todas, si no el mismo producto aparece
// repetido una vez por provincia.
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

async function buscarConFallback(
  tabla: string,
  columna: string,
  query: string,
  provincia?: string,
  limite = 20
): Promise<FilaConRelevancia[]> {
  if (!supabase) return [];
  const terminos = palabras(query);
  if (terminos.length === 0) return [];

  // Sin provincia, pedimos de más porque después se agrupa (dedupeSinProvincia)
  // y el resultado final tiene que seguir teniendo `limite` productos distintos.
  const limiteConsulta = provincia ? limite : limite * 6;

  let builder = supabase.from(tabla).select('*');
  for (const palabra of terminos) {
    builder = builder.ilike(columna, `%${palabra}%`);
  }
  if (provincia) builder = builder.eq('provincia', provincia);
  const { data } = await builder.order('precio', { ascending: true }).limit(limiteConsulta);
  if (data && data.length > 0) {
    const filas = dedupeSinProvincia(data, provincia)
      .sort((a, b) => a.precio - b.precio)
      .slice(0, limite);
    return filas.map((fila) => ({ fila, relevancia: terminos.length }));
  }

  if (terminos.length > 1) {
    const condiciones = terminos.map((p) => `${columna}.ilike.%${p}%`).join(',');
    let builderAmplio = supabase.from(tabla).select('*').or(condiciones);
    if (provincia) builderAmplio = builderAmplio.eq('provincia', provincia);
    const { data: dataAmplia } = await builderAmplio.limit(500);
    if (!dataAmplia) return [];

    const conRelevancia = dedupeSinProvincia(dataAmplia, provincia).map((fila: any) => {
      const texto = String(fila[columna]).toLowerCase();
      const relevancia = terminos.filter((t) => texto.includes(t)).length;
      return { fila, relevancia };
    });

    return conRelevancia
      .sort((a, b) => b.relevancia - a.relevancia || a.fila.precio - b.fila.precio)
      .slice(0, limite);
  }

  return [];
}

// La búsqueda en vivo contra la API de MercadoLibre (lib/ml.ts) está bloqueada
// para apps no certificadas — ver README. Mientras tanto, usamos el catálogo
// curado que se carga desde /admin.
async function buscarMLCurado(query: string): Promise<Resultado[]> {
  const filas = await buscarConFallback('ml_productos', 'titulo', query);

  return filas.map(({ fila: row, relevancia }): Resultado => ({
    fuente: 'mercadolibre',
    seccion: row.categoria === 'ropa' ? 'tienda' : 'ml',
    id: `ml-${row.id}`,
    titulo: row.titulo,
    precio: Number(row.precio),
    imagen: row.imagen,
    link: row.link,
    relevancia,
  }));
}

async function buscarSupermercados(query: string, provincia?: string): Promise<Resultado[]> {
  const filas = await buscarConFallback('sepa_precios', 'producto_nombre', query, provincia);

  return filas.map(({ fila: row, relevancia }): Resultado => ({
    fuente: 'supermercado',
    seccion: 'gondola',
    id: `${row.cadena}-${row.producto_id}`,
    titulo: row.producto_nombre,
    precio: Number(row.precio),
    imagen: row.imagen ?? null,
    link: '#',
    cadena: row.cadena,
    relevancia,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const provincia = searchParams.get('provincia')?.trim() || undefined;

  if (!q) {
    return NextResponse.json({ resultados: [] });
  }

  const [ml, supermercados] = await Promise.all([buscarMLCurado(q), buscarSupermercados(q, provincia)]);

  const resultados = [...ml, ...supermercados].sort(
    (a, b) => (b.relevancia ?? 0) - (a.relevancia ?? 0) || a.precio - b.precio
  );

  return NextResponse.json({ resultados });
}
