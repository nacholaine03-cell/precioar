import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function autorizado(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  return !!secret && secret === process.env.ADMIN_SECRET;
}

export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('ml_productos')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ productos: data });
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });

  const body = await request.json();
  const { titulo, precio, imagen, link, categoria } = body;

  if (!titulo || !precio || !link) {
    return NextResponse.json({ error: 'Faltan campos: título, precio y link son obligatorios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('ml_productos').insert({
    titulo,
    precio: Number(precio),
    imagen: imagen || null,
    link,
    categoria: categoria || 'electrodomesticos',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabaseAdmin.from('ml_productos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
