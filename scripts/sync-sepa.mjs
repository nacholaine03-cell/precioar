// Descarga el ZIP diario de SEPA (Precios Claros), lo filtra a las cadenas
// objetivo, agrega el precio más barato por producto y lo sube a Supabase.
//
// Uso: npm run sync-sepa

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import unzipper from 'unzipper';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
const TMP_DIR = path.join(__dirname, '..', 'tmp-sepa');

// id_comercio -> nombre de cadena a mostrar. Confirmado inspeccionando un
// archivo real de SEPA el 2026-07-08. Jumbo/Disco no aparecieron ese día
// (Cencosud solo reportó Vea) — si en el futuro aparecen con otro id, agregarlos acá.
const CADENAS_OBJETIVO = {
  2: 'La Anónima',
  9: 'Vea',
  10: 'Carrefour',
  15: 'Día',
};

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const RESOURCE_IDS = {
  lunes: '0a9069a9-06e8-4f98-874d-da5578693290',
  martes: '9dc06241-cc83-44f4-8e25-c9b1636b8bc8',
  miercoles: '1e92cd42-4f94-4071-a165-62c4cb2ce23c',
  jueves: 'd076720f-a7f0-4af8-b1d6-1b99d5a90c14',
  viernes: '91bc072a-4726-44a1-85ec-4a8467aad27e',
  sabado: 'b3c3da5d-213d-41e7-8d74-f23fda0a3c30',
  domingo: 'f8e75128-515a-436e-bf8d-5c63a62f2005',
};

const DATASET_ID = '6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5';

function urlDelDia(dia) {
  const resourceId = RESOURCE_IDS[dia];
  return `https://datos.produccion.gob.ar/dataset/${DATASET_ID}/resource/${resourceId}/download/sepa_${dia}.zip`;
}

async function descargarZipDeHoy() {
  const dia = DIAS[new Date().getDay()];
  const url = urlDelDia(dia);
  console.log(`Descargando SEPA de hoy (${dia}): ${url}`);

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const zipPath = path.join(TMP_DIR, 'sepa.zip');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el ZIP de SEPA (${res.status})`);
  await fs.promises.writeFile(zipPath, Buffer.from(await res.arrayBuffer()));
  return zipPath;
}

async function extraer(zipPath) {
  const outDir = path.join(TMP_DIR, 'extracted');
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: outDir }))
    .promise();
  return outDir;
}

function encontrarZipsPorComercio(outDir) {
  // El zip diario trae una subcarpeta con fecha, y dentro un .zip por comercio.
  const fecha = fs.readdirSync(outDir).find((f) => fs.statSync(path.join(outDir, f)).isDirectory());
  const dir = path.join(outDir, fecha);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => path.join(dir, f));
}

async function leerComercioId(comercioZipPath) {
  const directory = await unzipper.Open.file(comercioZipPath);
  const entry = directory.files.find((f) => f.path === 'comercio.csv');
  if (!entry) return null;
  const content = (await entry.buffer()).toString('utf-8');
  const linea = content.split('\n')[1];
  if (!linea) return null;
  const idComercio = Number(linea.split('|')[0]);
  return idComercio;
}

// sucursales.csv: id_comercio|id_bandera|id_sucursal|nombre|tipo|calle|numero|
// latitud|longitud|observaciones|barrio|codigo_postal|localidad|provincia|...
async function leerProvinciaPorSucursal(comercioZipPath) {
  const directory = await unzipper.Open.file(comercioZipPath);
  const entry = directory.files.find((f) => f.path === 'sucursales.csv');
  if (!entry) return new Map();

  const contenido = (await entry.buffer()).toString('utf-8');
  const lineas = contenido.split('\n');
  const mapa = new Map(); // id_sucursal -> provincia

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i]) continue;
    const campos = lineas[i].split('|');
    const idSucursal = campos[2];
    const provincia = campos[13];
    if (idSucursal && provincia) mapa.set(idSucursal, provincia.trim());
  }

  return mapa;
}

async function agregarPreciosDeComercio(comercioZipPath, idComercio) {
  const provinciaPorSucursal = await leerProvinciaPorSucursal(comercioZipPath);

  const directory = await unzipper.Open.file(comercioZipPath);
  const entry = directory.files.find((f) => f.path === 'productos.csv');
  if (!entry) return new Map();

  const stream = entry.stream();
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const masBaratos = new Map(); // "producto_id|provincia" -> { nombre, precio, producto_id, provincia }
  let esHeader = true;

  for await (const linea of rl) {
    if (esHeader) {
      esHeader = false;
      continue;
    }
    if (!linea) continue;
    const campos = linea.split('|');
    // id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|productos_descripcion|
    // productos_cantidad_presentacion|productos_unidad_medida_presentacion|productos_marca|
    // productos_precio_lista|...
    const idSucursal = campos[2];
    const idProducto = campos[3];
    const descripcion = campos[5];
    const marca = campos[8];
    const precio = Number(campos[9]);

    if (!idProducto || !descripcion || !Number.isFinite(precio) || precio <= 0) continue;

    // A veces una sucursal de productos.csv no aparece en sucursales.csv
    // (local dado de baja, datos incompletos del día) — se cae a 'AR' genérico.
    const provincia = provinciaPorSucursal.get(idSucursal) || 'AR';
    const nombre = marca ? `${descripcion} ${marca}`.trim() : descripcion.trim();
    const clave = `${idProducto}|${provincia}`;
    const actual = masBaratos.get(clave);
    if (!actual || precio < actual.precio) {
      masBaratos.set(clave, { nombre, precio, producto_id: idProducto, provincia });
    }
  }

  return masBaratos;
}

async function subirASupabase(supabase, cadena, masBaratos) {
  const filas = Array.from(masBaratos.values()).map(({ producto_id, provincia, nombre, precio }) => ({
    cadena,
    producto_id,
    provincia,
    producto_nombre: nombre,
    precio,
    actualizado_en: new Date().toISOString(),
  }));

  // Lotes más chicos que antes: con la columna de provincia sumada al índice
  // único, los upserts son más lentos y un lote de 1000 llegaba a superar el
  // statement timeout de Supabase (se vio con Carrefour, se cortó a mitad).
  const LOTE = 250;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    let intentos = 0;
    while (true) {
      const { error } = await supabase
        .from('sepa_precios')
        .upsert(lote, { onConflict: 'cadena,provincia,producto_id' });
      if (!error) break;
      intentos++;
      if (intentos >= 3) throw error;
      await new Promise((r) => setTimeout(r, 1000 * intentos));
    }
    process.stdout.write(`\r  ${cadena}: ${Math.min(i + LOTE, filas.length)}/${filas.length} productos`);
  }
  console.log('');
}

// Borra de esa cadena todo lo que no se tocó en esta corrida (productos
// descontinuados, o que dejaron de reportarse) — solo se llama después de
// que la subida de esa cadena terminó bien, para no borrar datos buenos si
// esa cadena en particular falló a mitad de camino.
async function limpiarViejos(supabase, cadena, inicioCorrida) {
  const { error, count } = await supabase
    .from('sepa_precios')
    .delete({ count: 'exact' })
    .eq('cadena', cadena)
    .lt('actualizado_en', inicioCorrida);
  if (error) {
    console.error(`  No se pudo limpiar lo viejo de ${cadena}: ${error.message}`);
  } else if (count) {
    console.log(`  ${cadena}: ${count} productos viejos borrados (ya no se reportan)`);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local');
  }
  const supabase = createClient(url, key, { realtime: { transport: ws } });
  const inicioCorrida = new Date().toISOString();

  const zipPath = await descargarZipDeHoy();
  console.log('Extrayendo...');
  const outDir = await extraer(zipPath);
  const comercioZips = encontrarZipsPorComercio(outDir);

  for (const comercioZip of comercioZips) {
    try {
      const idComercio = await leerComercioId(comercioZip);
      const cadena = CADENAS_OBJETIVO[idComercio];
      if (!cadena) continue; // no es una de las cadenas que nos interesan

      console.log(`Procesando ${cadena} (comercio ${idComercio})...`);
      const masBaratos = await agregarPreciosDeComercio(comercioZip, idComercio);
      console.log(`  ${masBaratos.size} productos únicos encontrados`);
      await subirASupabase(supabase, cadena, masBaratos);
      await limpiarViejos(supabase, cadena, inicioCorrida);
    } catch (err) {
      console.error(`  Error procesando ${path.basename(comercioZip)}, se salta: ${err.message}`);
    }
  }

  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    console.warn(`No se pudo borrar ${TMP_DIR} (no afecta los datos subidos): ${err.message}`);
  }
  console.log('Listo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
