'use client';

import { useEffect, useState } from 'react';

type Producto = {
  id: number;
  titulo: string;
  precio: number;
  imagen: string | null;
  link: string;
  categoria: string;
};

export default function Admin() {
  const [secret, setSecret] = useState('');
  const [conectado, setConectado] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({ titulo: '', precio: '', imagen: '', link: '', categoria: 'electrodomesticos' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const guardado = typeof window !== 'undefined' ? window.localStorage.getItem('admin_secret') : null;
    if (guardado) {
      setSecret(guardado);
      cargar(guardado);
    }
  }, []);

  async function cargar(clave: string) {
    const res = await fetch('/api/admin/productos', { headers: { 'x-admin-secret': clave } });
    if (res.ok) {
      const data = await res.json();
      setProductos(data.productos ?? []);
      setConectado(true);
      window.localStorage.setItem('admin_secret', clave);
    } else {
      setError('Clave incorrecta');
      setConectado(false);
    }
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/admin/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setForm({ titulo: '', precio: '', imagen: '', link: '', categoria: form.categoria });
      cargar(secret);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    await fetch(`/api/admin/productos?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret },
    });
    cargar(secret);
  }

  if (!conectado) {
    return (
      <main className="mx-auto max-w-sm px-4 py-20">
        <h1 className="mb-4 text-xl font-bold">Panel de administración</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cargar(secret);
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Clave de administrador"
            className="rounded-lg border border-neutral-300 px-4 py-2"
          />
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-white">
            Entrar
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-xl font-bold">Panel de administración — Productos MercadoLibre</h1>

      <form onSubmit={agregar} className="mb-10 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-2">
        <input
          required
          placeholder="Título del producto"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
        />
        <input
          required
          type="number"
          step="0.01"
          placeholder="Precio"
          value={form.precio}
          onChange={(e) => setForm({ ...form, precio: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          placeholder="URL de imagen (opcional)"
          value={form.imagen}
          onChange={(e) => setForm({ ...form, imagen: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          required
          placeholder="Link de MercadoLibre (con tu matt_tool de afiliado)"
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
        />
        <select
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
        >
          <option value="electrodomesticos">Electrodomésticos / Tecnología (modo MercadoLibre)</option>
          <option value="ropa">Ropa / Calzado (modo tienda)</option>
          <option value="otros">Otros</option>
        </select>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2"
        >
          {guardando ? 'Guardando...' : 'Agregar producto'}
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      </form>

      <h2 className="mb-3 font-semibold">Productos cargados ({productos.length})</h2>
      <div className="flex flex-col gap-2">
        {productos.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div>
              <p className="font-medium">{p.titulo}</p>
              <p className="text-sm text-neutral-500">
                ${p.precio.toLocaleString('es-AR')} · {p.categoria}
              </p>
            </div>
            <button onClick={() => eliminar(p.id)} className="text-sm text-red-600">
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
