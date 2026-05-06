import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const base = process.env.CATALOG_SERVICE_URL;
  try {
    const res = await fetch(`${base}/health`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
}
