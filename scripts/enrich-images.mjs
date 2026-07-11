// Busca la foto real de cada producto de sepa_precios en OpenFoodFacts
// (base de datos abierta y gratuita, sin los bloqueos de MercadoLibre),
// usando el EAN (producto_id) que ya viene en los datos de SEPA.
//
// Uso: node scripts/enrich-images.mjs [termino] [limite]
//   node scripts/enrich-images.mjs aceite       -> hasta 500 productos que matcheen "aceite" sin imagen
//   node scripts/enrich-images.mjs "" 2000       -> hasta 2000 productos sin imagen, de cualquier categoría

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const termino = process.argv[2] ?? '';
const limite = Number(process.argv[3] ?? 500);

async function buscarImagen(ean) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1) return null;
    return data.product.image_front_url || data.product.image_url || null;
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local');
  const supabase = createClient(url, key, { realtime: { transport: ws } });

  let query = supabase
    .from('sepa_precios')
    .select('id, producto_id, producto_nombre')
    .is('imagen', null)
    .limit(limite);

  if (termino) query = query.ilike('producto_nombre', `%${termino}%`);

  const { data: filas, error } = await query;
  if (error) throw error;

  console.log(`Buscando fotos para ${filas.length} productos${termino ? ` ("${termino}")` : ''}...`);

  let encontradas = 0;
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const imagen = await buscarImagen(fila.producto_id);
    if (imagen) {
      const { error: updError } = await supabase.from('sepa_precios').update({ imagen }).eq('id', fila.id);
      if (!updError) encontradas++;
    }
    if ((i + 1) % 25 === 0 || i === filas.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${filas.length} revisados, ${encontradas} con foto`);
    }
    await new Promise((r) => setTimeout(r, 120)); // no saturar la API pública de OpenFoodFacts
  }

  console.log(`\nListo. ${encontradas}/${filas.length} productos con foto agregada.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
