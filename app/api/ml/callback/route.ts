import { NextResponse } from 'next/server';
import { saveInitialToken } from '@/lib/ml';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Falta el parámetro code' }, { status: 400 });
  }

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.ML_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Fallo al canjear el code', detalle: await res.text() }, { status: 500 });
  }

  const data = await res.json();
  saveInitialToken(data.access_token, data.refresh_token, data.expires_in);

  return NextResponse.redirect(new URL('/?ml=conectado', request.url));
}
