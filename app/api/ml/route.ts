import { NextResponse } from 'next/server';
import { buscarML } from '@/lib/ml';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ resultados: [] });

  const resultados = await buscarML(q);
  return NextResponse.json({ resultados });
}
