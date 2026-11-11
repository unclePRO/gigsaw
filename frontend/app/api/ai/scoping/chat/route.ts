import { NextRequest, NextResponse } from 'next/server';
import { aiClient, AiClientError } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initial_goal, messages, current_budget, currency, extracted_spec, project_name } = body;

    if (!initial_goal || typeof initial_goal !== 'string') {
      return NextResponse.json({ error: 'initial_goal is required' }, { status: 400 });
    }

    let aiRes;
    try {
      // Call FastAPI Project Scoping Assistant (No fake local fallbacks)
      aiRes = await aiClient.scopingChat({
        initial_goal,
        messages: Array.isArray(messages) ? messages : [],
        current_budget: current_budget ? Number(current_budget) : undefined,
        currency: currency || 'USD',
        extracted_spec: extracted_spec || {},
        project_name: project_name || undefined,
      });
    } catch (err: any) {
      console.error('[Scoping Chat API] FastAPI error:', err);
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

    if (!aiRes) {
      return NextResponse.json(
        {
          error: 'ai_service_unavailable',
          message: 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.',
          retryable: true,
          retry_after_seconds: 5,
        },
        { status: 503, headers: { 'Retry-After': '5' } }
      );
    }

    // Inspect if budget was mentioned or changed in spec/response
    let budgetChanged = Boolean(aiRes.budget_changed);
    let newBudget = aiRes.current_budget ?? current_budget;
    const spec = aiRes.extracted_spec || {};
    const budgetMention = spec.budget || spec.budget_notes || spec.target_budget || spec.current_budget;
    if (budgetMention) {
      const match = String(budgetMention).replace(/,/g, '').match(/(\d+(\.\d+)?)/);
      if (match) {
        const parsed = Number(match[1]);
        if (!isNaN(parsed) && parsed > 0 && parsed !== Number(current_budget)) {
          newBudget = parsed;
          budgetChanged = true;
        }
      }
    }

    const resolvedProjectName =
      aiRes.project_name ||
      project_name ||
      spec.project_name ||
      null;

    return NextResponse.json({
      success: true,
      source: 'fastapi_microservice',
      project_name: resolvedProjectName,
      current_budget: newBudget != null ? Number(newBudget) : undefined,
      currency: aiRes.currency || currency || 'USD',
      budget_changed: budgetChanged,
      ...aiRes,
    });
  } catch (err: any) {
    console.error('[Scoping Chat API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Scoping chat error' },
      { status: 500 }
    );
  }
}
