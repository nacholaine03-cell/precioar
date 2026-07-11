import fs from 'node:fs';
import path from 'node:path';
import type { Resultado } from './types';

const TOKEN_PATH = path.join(process.cwd(), 'data', 'ml-token.json');

type TokenFile = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
};

function readToken(): TokenFile | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function writeToken(token: TokenFile) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function saveInitialToken(access_token: string, refresh_token: string, expires_in: number) {
  writeToken({ access_token, refresh_token, expires_at: Date.now() + expires_in * 1000 });
}

async function refreshAccessToken(refresh_token: string): Promise<TokenFile> {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo refrescar el token de ML (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const token: TokenFile = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  writeToken(token);
  return token;
}

async function getValidAccessToken(): Promise<string | null> {
  const token = readToken();
  if (!token) return null;
  // Refresh 5 minutes before expiry
  if (Date.now() > token.expires_at - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(token.refresh_token);
    return refreshed.access_token;
  }
  return token.access_token;
}

export async function buscarML(query: string): Promise<Resultado[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=20`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const affiliateId = process.env.ML_AFFILIATE_ID;

  return (data.results ?? []).map((item: any): Resultado => {
    const link = affiliateId ? `${item.permalink}?matt_tool=${affiliateId}&matt_word=${affiliateId}` : item.permalink;
    return {
      fuente: 'mercadolibre',
      id: item.id,
      titulo: item.title,
      precio: item.price,
      imagen: item.thumbnail ?? null,
      link,
    };
  });
}
