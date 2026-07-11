# Tiendaw (PreciosAr) — Buscador de ofertas

Buscador que compara precios de un catálogo curado de MercadoLibre (con link de afiliado)
y supermercados (Carrefour, Vea, Día, La Anónima — vía datos abiertos SEPA).

## Cómo funciona cada parte

### MercadoLibre — catálogo curado (no búsqueda en vivo)

Desde abril 2025 MercadoLibre bloqueó el acceso a su API de búsqueda/catálogo para
aplicaciones no certificadas (error `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`), y certificarse
exige ya tener una app con usuarios recurrentes durante 3 meses — imposible para un sitio nuevo.

Por eso los productos de MercadoLibre se cargan **a mano** desde el panel `/admin`:
buscás el producto en MercadoLibre, generás tu link de afiliado (barra azul o Central de
Afiliados), y lo cargás con título, precio e imagen. El buscador del sitio consulta esa
tabla (`ml_productos`), no la API de MercadoLibre en vivo.

El código de integración OAuth (`lib/ml.ts`, `/api/ml/*`) queda armado y funcionando por si
en el futuro se consigue la certificación de MercadoLibre — hoy no se usa en el buscador.

### Supermercados — SEPA (datos abiertos, automático)

`npm run sync-sepa` descarga el ZIP diario de SEPA (Precios Claros), lo filtra a Carrefour,
Vea, Día y La Anónima, y sube a Supabase el precio más barato por producto. Conviene
correrlo una vez por día.

**Importante**: SEPA solo tiene productos de supermercado (alimentos, limpieza, higiene) —
no incluye electrodomésticos ni electrónica. Búsquedas como "calefactor" o "TV" solo van a
traer resultados del catálogo curado de MercadoLibre; la comparación con supermercados
aplica a cosas tipo "aceite", "fideos", "café", "shampoo", etc.

Jumbo y Disco (Cencosud) no aparecieron en los datos de SEPA al momento de armar esto —
solo Vea. Si en algún momento empiezan a reportar, hay que sumar su `id_comercio` en
`scripts/sync-sepa.mjs` (`CADENAS_OBJETIVO`).

## Puesta en marcha

Copiá `.env.local.example` a `.env.local` y completá:

### 1. Supabase

1. Creá un proyecto en https://supabase.com.
2. Corré el contenido de `supabase/schema.sql` en el SQL Editor del proyecto.
3. Copiá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
   (Settings → API) a `.env.local`.

### 2. Panel de administración

`ADMIN_SECRET` es la clave para entrar a `/admin` y cargar productos de MercadoLibre.
Ya tiene un valor generado en `.env.local`; se puede cambiar por cualquier otro.

### 3. Programa de Afiliados de MercadoLibre (para cobrar comisión)

Inscribite en la Central de Afiliados y Creadores (`mercadolibre.com.ar/l/afiliados`).
Cuando cargues un producto en `/admin`, el link tiene que ser el que te da esa herramienta
(con tu `matt_tool` de tracking) — sin eso el buscador funciona igual, pero no vas a cobrar
comisión.

### 4. Cargar precios de supermercados

```
npm run sync-sepa
```

### 5. Correr el sitio

MercadoLibre exige HTTPS para el redirect URI de su OAuth (usado por `/api/ml/authorize`,
hoy no activo en el buscador pero queda disponible). Por eso `npm run dev` levanta HTTPS local
con certificado autofirmado (el navegador va a avisar la primera vez, hay que aceptarlo).

```
npm install
npm run dev -- -p 5800
```

Sitio: `https://localhost:5800` — Panel admin: `https://localhost:5800/admin`

### (Opcional, ya no necesario para el buscador) Conectar MercadoLibre vía OAuth

Si en el futuro se consigue certificación y se quiere reactivar la búsqueda en vivo:

1. App creada en https://developers.mercadolibre.com.ar/devcenter con redirect URI
   `https://<tu-dominio-o-túnel>/api/ml/callback` (no acepta `localhost`, hace falta un
   dominio real — para desarrollo local se puede usar `ngrok http https://localhost:5800`).
2. `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI` en `.env.local`.
3. Entrar una vez a `/api/ml/authorize` para guardar el token en `data/ml-token.json`.
4. Volver a llamar `buscarML()` (en `lib/ml.ts`) desde `/api/buscar` en vez de `buscarMLCurado()`.
