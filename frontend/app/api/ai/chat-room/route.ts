import { NextRequest, NextResponse } from 'next/server';
import { aiClient, AiClientError } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, project_name, merchant_name, members, messages, action = 'kickoff' } = body;

    if (!project_name) {
      return NextResponse.json({ error: 'project_name is required' }, { status: 400 });
    }

    try {
      const aiRes = await aiClient.chatRoomAssist({
        project_id,
        project_name,
        merchant_name: merchant_name || 'Merchant',
        members: members || [],
        messages: messages || [],
        action,
      });

      return NextResponse.json({
        success: true,
        source: 'fastapi_microservice',
        ...aiRes,
      });
    } catch (err: any) {
      console.error('[Chat Room AI API] FastAPI error:', err);
      const status = err instanceof AiClientError ? err.status : 503;
      const retryAfter = err instanceof AiClientError ? (err.retryAfterSeconds || 5) : 5;
      return NextResponse.json(
        {
          error: 'ai_service_unavailable',
          message: err.message || 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.',
          detail: err.message,
          retryable: true,
          retry_after_seconds: retryAfter,
        },
        {
          status: status || 503,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }
  } catch (err: any) {
    console.error('[Chat Room AI API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Chat room assistant error' },
      { status: 500 }
    );
  }
}
