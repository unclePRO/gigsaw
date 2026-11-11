import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const AI_BASE_URL =
  process.env.AI_SERVICE_URL ||
  process.env.NEXT_PUBLIC_AI_MICROSERVICE_URL ||
  process.env.AI_MICROSERVICE_URL ||
  'http://localhost:8001';

export async function GET() {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s quick check

  try {
    const res = await fetch(`${AI_BASE_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (res.ok) {
      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      return NextResponse.json({
        online: true,
        status: 'online',
        latencyMs,
        provider: data.provider || 'gemini',
        service: 'gigsaw-ai',
      });
    }

    return NextResponse.json({
      online: false,
      status: 'waking_up',
      httpStatus: res.status,
      latencyMs,
      message: 'AI Service returned non-200. Container may be initializing.',
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted');

    return NextResponse.json({
      online: false,
      status: 'waking_up',
      isTimeout,
      latencyMs,
      message: isTimeout
        ? 'AI backend on Render is sleeping and spinning up (typically takes 30-50s).'
        : `Connecting to AI service (${err.message || 'connection refused'}). Container waking up.`,
    });
  }
}
