create extension if not exists pg_trgm;

-- Precio mínimo del día por producto, cadena Y provincia (agregado entre las
-- sucursales de esa provincia reportadas ese día — el CSV de SEPA trae una
-- fila por sucursal x producto, acá guardamos solo el más barato encontrado
-- por cadena+provincia, cruzando productos.csv con sucursales.csv por id_sucursal).
create table if not exists sepa_precios (
  id bigint generated always as identity primary key,
  cadena text not null,
  producto_id text not null,
  producto_nombre text not null,
  precio numeric not null,
  imagen text,
  provincia text not null default 'AR',
  actualizado_en timestamptz not null default now(),
  unique (cadena, producto_id)
);

-- Foto real del producto, buscada por EAN (producto_id) en OpenFoodFacts
-- (base de datos abierta y gratuita, sin los bloqueos de MercadoLibre).
-- La carga scripts/enrich-images.mjs, no sync-sepa (para no pisar fotos ya
-- buscadas cada vez que se sincronizan precios).
alter table sepa_precios add column if not exists imagen text;

-- Migración a precios por provincia (antes era uno solo por cadena a nivel país).
-- Vacía los datos agregados viejos: se repueblan solos con la próxima corrida
-- de sync-sepa, ahora con el detalle de provincia.
alter table sepa_precios add column if not exists provincia text not null default 'AR';
truncate table sepa_precios;
alter table sepa_precios drop constraint if exists sepa_precios_cadena_producto_id_key;
alter table sepa_precios add constraint sepa_precios_cadena_provincia_producto_id_key
  unique (cadena, provincia, producto_id);

create index if not exists sepa_precios_provincia_idx on sepa_precios (provincia);

create index if not exists sepa_precios_producto_trgm
  on sepa_precios using gin (producto_nombre gin_trgm_ops);

create index if not exists sepa_precios_cadena_idx on sepa_precios (cadena);

-- Catálogo curado de MercadoLibre: la API de búsqueda general está bloqueada
-- para apps no certificadas (política vigente desde abril 2025), así que los
-- productos se cargan a mano desde el panel /admin con su link de afiliado.
create table if not exists ml_productos (
  id bigint generated always as identity primary key,
  titulo text not null,
  precio numeric not null,
  imagen text,
  link text not null,
  categoria text not null default 'electrodomesticos', -- electrodomesticos | ropa | otros
  creado_en timestamptz not null default now()
);

alter table ml_productos add column if not exists categoria text not null default 'electrodomesticos';

create index if not exists ml_productos_titulo_trgm
  on ml_productos using gin (titulo gin_trgm_ops);

-- El buscador público usa la clave anónima (solo lectura). Las escrituras
-- (sync-sepa.mjs, /api/admin) usan la service role key, que ignora RLS.
alter table sepa_precios enable row level security;
alter table ml_productos enable row level security;

drop policy if exists "lectura publica sepa_precios" on sepa_precios;
create policy "lectura publica sepa_precios" on sepa_precios for select using (true);

drop policy if exists "lectura publica ml_productos" on ml_productos;
create policy "lectura publica ml_productos" on ml_productos for select using (true);
