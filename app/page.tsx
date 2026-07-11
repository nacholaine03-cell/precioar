'use client';

import { useEffect, useState } from 'react';
import type { Resultado } from '@/lib/types';
import { PROVINCIAS, nombreProvincia } from '@/lib/provincias';

type Chip = 'todas' | 'ml' | 'tienda';

type Categoria = { nombre: string; emoji: string; items: Resultado[] };

const COLOR_CADENA: Record<string, string> = {
  Carrefour: 'bg-blue-600',
  Día: 'bg-red-600',
  'La Anónima': 'bg-orange-600',
  Vea: 'bg-emerald-600',
};

function formatearPrecio(precio: number) {
  return precio.toLocaleString('es-AR');
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [destacados, setDestacados] = useState<Resultado[]>([]);
  const [chip, setChip] = useState<Chip>('todas');
  const [carrusel, setCarrusel] = useState<Resultado[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [provincia, setProvincia] = useState('');
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? window.localStorage.getItem('provincia') : null;
    if (guardada) setProvincia(guardada);

    fetch('/api/destacados')
      .then((res) => res.json())
      .then((data) => setDestacados(data.resultados ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const qs = provincia ? `?provincia=${encodeURIComponent(provincia)}` : '';
    fetch(`/api/gondola-hoy${qs}`)
      .then((res) => res.json())
      .then((data) => {
        setCarrusel(data.carrusel ?? []);
        setCategorias(data.categorias ?? []);
        setActualizadoEn(data.actualizado_en ?? null);
      })
      .catch(() => {});
  }, [provincia]);

  const provinciaLabel = provincia ? nombreProvincia(provincia) : 'todo el país';
  const fechaActualizacion = actualizadoEn
    ? new Date(actualizadoEn).toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  function cambiarProvincia(valor: string) {
    setProvincia(valor);
    window.localStorage.setItem('provincia', valor);
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setBuscando(true);
    setBuscado(true);
    try {
      const qs = new URLSearchParams({ q: query });
      if (provincia) qs.set('provincia', provincia);
      const res = await fetch(`/api/buscar?${qs.toString()}`);
      const data = await res.json();
      setResultados(data.resultados ?? []);
    } finally {
      setBuscando(false);
    }
  }

  function limpiarBusqueda() {
    setBuscado(false);
    setResultados([]);
    setQuery('');
  }

  const mostrandoBusqueda = buscado;
  const fuente = mostrandoBusqueda ? resultados : destacados;

  const masBarato = mostrandoBusqueda ? resultados[0]?.id : undefined;
  const gondola = mostrandoBusqueda ? fuente.filter((r) => r.seccion === 'gondola') : [];
  const ml = fuente.filter((r) => r.seccion === 'ml' && (chip === 'todas' || chip === 'ml' || mostrandoBusqueda));
  const tienda = fuente.filter(
    (r) => r.seccion === 'tienda' && (chip === 'todas' || chip === 'tienda' || mostrandoBusqueda)
  );

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* BARRA DE UBICACIÓN — fija arriba de todo para que siempre quede claro qué se está mirando */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-emerald-400/20 bg-neutral-900/95 px-4 py-2.5 text-sm text-neutral-300 backdrop-blur">
        <span className="flex items-center gap-2">
          <span>📍</span>
          <label htmlFor="provincia" className="text-neutral-400">
            Viendo precios de:
          </label>
          <select
            id="provincia"
            value={provincia}
            onChange={(e) => cambiarProvincia(e.target.value)}
            className="rounded-md border border-emerald-400/40 bg-neutral-800 px-2 py-1 font-semibold text-white outline-none"
          >
            <option value="">Todo el país</option>
            {Object.entries(PROVINCIAS).map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </span>
        {fechaActualizacion && (
          <span className="flex items-center gap-1 text-xs text-neutral-400">
            <span>🕒</span>
            Súper actualizado el {fechaActualizacion} hs — cambia día a día, no en vivo
          </span>
        )}
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden pb-28 pt-20 sm:pb-36 sm:pt-28">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/heropar.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/90 via-neutral-950/85 to-neutral-950" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <span className="mb-5 inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
            PreciosAr
          </span>
          <h1 className="mb-5 text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
            Encontrá el precio
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-lime-300 bg-clip-text text-transparent">
              más barato, ya.
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-neutral-300">
            Comparamos MercadoLibre y los supermercados más grandes del país en un solo buscador.
          </p>

          <form
            onSubmit={buscar}
            className="mx-auto flex max-w-xl gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-emerald-950/50"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué estás buscando? Ej: aceite, zapatillas, calefactor..."
              className="flex-1 rounded-xl px-4 py-3 text-neutral-900 outline-none"
            />
            <button
              type="submit"
              disabled={buscando}
              className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {buscando ? '...' : 'Buscar'}
            </button>
          </form>

          {!mostrandoBusqueda && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {(
                [
                  ['todas', '✨ Destacados'],
                  ['ml', '📦 Electro y tecnología'],
                  ['tienda', '👕 Ropa y calzado'],
                ] as [Chip, string][]
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  onClick={() => setChip(valor)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    chip === valor
                      ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                      : 'border-white/15 text-neutral-300 hover:border-white/30'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!mostrandoBusqueda && carrusel.length > 0 && (
        <CarruselOfertas items={carrusel} provinciaLabel={provinciaLabel} />
      )}

      {/* RESULTADOS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        {mostrandoBusqueda && (
          <button
            onClick={limpiarBusqueda}
            className="mb-6 text-sm text-neutral-400 underline decoration-neutral-600 hover:text-neutral-200"
          >
            ← Volver a destacados
          </button>
        )}

        {buscado && !buscando && resultados.length === 0 && (
          <p className="text-center text-neutral-400">No encontramos resultados para &quot;{query}&quot;.</p>
        )}

        {!mostrandoBusqueda &&
          categorias.map((c) => (
            <SeccionCategoria key={c.nombre} categoria={c} provinciaLabel={provinciaLabel} />
          ))}

        {!mostrandoBusqueda && ml.length === 0 && tienda.length === 0 && (
          <p className="text-center text-neutral-500">Todavía no hay productos cargados en esta categoría.</p>
        )}

        {gondola.length > 0 && (
          <SeccionGondola items={gondola} masBaratoId={masBarato} />
        )}

        {ml.length > 0 && (
          <SeccionML items={ml} masBaratoId={masBarato} />
        )}

        {tienda.length > 0 && (
          <SeccionTienda items={tienda} masBaratoId={masBarato} />
        )}
      </section>
    </main>
  );
}

function SeccionGondola({ items, masBaratoId }: { items: Resultado[]; masBaratoId?: string }) {
  return (
    <div className="mb-16">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-2xl">🛒</span>
        <h2 className="text-xl font-bold text-white">Góndola de supermercado</h2>
        <span className="text-sm text-neutral-500">— comparación entre cadenas</span>
      </div>
      <div className="rounded-2xl bg-gradient-to-b from-amber-100 to-amber-50 p-5 shadow-inner">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((r) => (
            <div
              key={r.id}
              className={`relative rounded-lg border-2 bg-white p-3 shadow-sm ${
                r.id === masBaratoId ? 'border-emerald-500' : 'border-amber-200'
              }`}
            >
              {r.id === masBaratoId && (
                <span className="absolute -top-2.5 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  MÁS BARATO
                </span>
              )}
              {r.imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen} alt={r.titulo} className="mb-2 h-20 w-full object-contain" />
              )}
              <span
                className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                  COLOR_CADENA[r.cadena ?? ''] ?? 'bg-neutral-600'
                }`}
              >
                {r.cadena}
              </span>
              <p className="mb-2 line-clamp-2 min-h-[2.5rem] text-xs font-medium text-neutral-800">{r.titulo}</p>
              <p className="text-lg font-black text-neutral-900">${formatearPrecio(r.precio)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeccionML({ items, masBaratoId }: { items: Resultado[]; masBaratoId?: string }) {
  return (
    <div className="mb-16">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-2xl">📦</span>
        <h2 className="text-xl font-bold text-white">Electrodomésticos y tecnología</h2>
        <span className="text-sm text-neutral-500">— estilo MercadoLibre</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((r) => (
          <a
            key={r.id}
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`group overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-xl ${
              r.id === masBaratoId ? 'ring-2 ring-emerald-500' : ''
            }`}
          >
            <div
              className="relative flex h-36 items-center justify-center overflow-hidden"
              style={
                !r.imagen
                  ? {
                      backgroundColor: '#fffbeb',
                      backgroundImage:
                        'repeating-linear-gradient(135deg, rgba(217,119,6,0.08) 0px, rgba(217,119,6,0.08) 2px, transparent 2px, transparent 14px)',
                    }
                  : undefined
              }
            >
              {r.id === masBaratoId && (
                <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  MÁS BARATO
                </span>
              )}
              {r.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen} alt={r.titulo} className="h-full w-full object-contain p-4" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-md ring-1 ring-amber-200">
                  📦
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="mb-1 line-clamp-2 min-h-[2.5rem] text-sm text-neutral-700">{r.titulo}</p>
              <p className="mb-2 text-xl font-bold text-neutral-900">${formatearPrecio(r.precio)}</p>
              <span className="inline-block rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-neutral-900 transition group-hover:bg-yellow-300">
                Comprar en MercadoLibre →
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function SeccionTienda({ items, masBaratoId }: { items: Resultado[]; masBaratoId?: string }) {
  return (
    <div className="mb-16">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-2xl">👕</span>
        <h2 className="text-xl font-bold text-white">Moda y calzado</h2>
        <span className="text-sm text-neutral-500">— estilo tienda</span>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((r) => (
          <a key={r.id} href={r.link} target="_blank" rel="noopener noreferrer" className="group">
            <div
              className="relative mb-3 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 via-neutral-900 to-emerald-950"
              style={
                !r.imagen
                  ? {
                      backgroundImage:
                        'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle at 30% 20%, rgba(52,211,153,0.15), transparent 55%)',
                      backgroundSize: '18px 18px, 100% 100%',
                    }
                  : undefined
              }
            >
              {r.id === masBaratoId && (
                <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  MÁS BARATO
                </span>
              )}
              {r.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.imagen}
                  alt={r.titulo}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-4xl backdrop-blur transition duration-300 group-hover:scale-105 group-hover:bg-white/15">
                  👕
                </span>
              )}
            </div>
            <p className="mb-1 line-clamp-2 text-sm font-medium text-neutral-100">{r.titulo}</p>
            <p className="text-lg font-bold text-white">${formatearPrecio(r.precio)}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function CarruselOfertas({ items, provinciaLabel }: { items: Resultado[]; provinciaLabel: string }) {
  // Duplicamos la lista para que el loop de la animación sea continuo (sin salto).
  const loop = [...items, ...items];
  return (
    <div className="border-y border-white/10 bg-gradient-to-r from-emerald-900/40 via-neutral-950 to-emerald-900/40 py-5">
      <p className="mx-auto mb-3 max-w-6xl px-4 text-xs font-semibold uppercase tracking-widest text-emerald-400">
        🔥 Los precios más bajos de hoy en {provinciaLabel}
      </p>
      <div className="flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 gap-4 px-4">
          {loop.map((r, i) => (
            <div
              key={`${r.id}-${i}`}
              className="flex w-56 shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
            >
              {r.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen} alt={r.titulo} className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl">
                  🛒
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs text-neutral-300">{r.cadena}</p>
                <p className="truncate text-sm font-medium text-white">{r.titulo}</p>
                <p className="text-sm font-bold text-emerald-400">${formatearPrecio(r.precio)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeccionCategoria({ categoria, provinciaLabel }: { categoria: Categoria; provinciaLabel: string }) {
  return (
    <div className="mb-16">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-2xl">{categoria.emoji}</span>
        <h2 className="text-xl font-bold text-white">Lo más barato en {categoria.nombre}</h2>
        <span className="text-sm text-neutral-500">— hoy, en {provinciaLabel}</span>
      </div>
      <div className="rounded-2xl bg-gradient-to-b from-amber-100 to-amber-50 p-5 shadow-inner">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categoria.items.map((r, i) => (
            <div
              key={r.id}
              className={`relative rounded-lg border-2 bg-white p-3 shadow-sm ${
                i === 0 ? 'border-emerald-500' : 'border-amber-200'
              }`}
            >
              {i === 0 && (
                <span className="absolute -top-2.5 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  MÁS BARATO
                </span>
              )}
              {r.imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen} alt={r.titulo} className="mb-2 h-16 w-full object-contain" />
              )}
              <span
                className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                  COLOR_CADENA[r.cadena ?? ''] ?? 'bg-neutral-600'
                }`}
              >
                {r.cadena}
              </span>
              <p className="mb-2 line-clamp-2 min-h-[2.5rem] text-xs font-medium text-neutral-800">{r.titulo}</p>
              <p className="text-lg font-black text-neutral-900">${formatearPrecio(r.precio)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
