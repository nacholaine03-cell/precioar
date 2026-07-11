import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente con permisos de escritura (service role) — solo se usa en rutas de servidor.
export const supabaseAdmin = url && serviceKey ? createClient(url, serviceKey) : null;
