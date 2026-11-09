import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

const FALLBACK_QUESTIONS = [
  {
    question: 'What is the theme or brand aesthetic you have in mind? (e.g., minimalist modern, artisan boutique, bold tech)',
    suggestions: ['Minimalist & Modern', 'Artisan Boutique', 'Bold & Vibrant', 'Corporate Professional'],
  },
  {
    question: 'Do you already have digital assets (logos, photography, menus) or should our design specialists build them from scratch?',
    suggestions: ['Have logo & copy ready', 'Need everything designed from scratch', 'Have photos, need logo', 'Starting fresh'],
  },
  {
    question: 'What is your target launch turnaround time (in weeks or days)?',
    suggestions: ['1 to 2 weeks (Rush Sprint)', '3 to 4 weeks (Standard)', '6 to 8 weeks', 'Flexible timeframe'],
  },
  {
    question: 'Are there any specific tech stack or platform integrations needed (e.g., Next.js, Stripe, Shopify, Online Ordering)?',
    suggestions: ['Next.js & Custom Web', 'Shopify Storefront', 'Online Menu & Ordering', 'Open to recommendation'],
  },
  {
    question: 'Is there any specific reference website or competitor whose vibe you want to match?',
    suggestions: ['Modern upscale feel', 'Local neighborhood vibe', 'Clean SaaS layout', 'Creative concept'],
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initial_goal, messages, current_budget, currency, extracted_spec } = body;

    if (!initial_goal || typeof initial_goal !== 'string') {
      return NextResponse.json({ error: 'initial_goal is required' }, { status: 400 });
    }

    // Call FastAPI Project Scoping Assistant
    const aiRes = await aiClient.scopingChat({
      initial_goal,
      messages: Array.isArray(messages) ? messages : [],
      current_budget: current_budget ? Number(current_budget) : undefined,
      currency: currency || 'USD',
      extracted_spec: extracted_spec || {},
    });

    if (aiRes) {
      return NextResponse.json({
        success: true,
        source: 'fastapi_microservice',
        ...aiRes,
      });
    }

    // Fallback scoping assistant if microservice is offline
    const userMessages = (messages || []).filter((m: any) => m.role === 'user');
    const turnIndex = userMessages.length;
    const completeness = Math.min(1.0, 0.25 + turnIndex * 0.2);
    const isReady = turnIndex >= 3;

    if (isReady) {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        reply: "Excellent! I have gathered all key parameters regarding your project vision, turnaround, and requirements. Click **Finalize Details & Match Specialists** to review the decomposed team and budget plan.",
        clarifying_question: null,
        suggested_replies: ['Finalize Details & Build Team', 'Review Requirements', 'Add More Details'],
        extracted_spec: extracted_spec || {},
        completeness_score: completeness,
        is_ready_to_finalize: true,
        ready_for_decomposition: true,
        recommended_action: 'ready_to_finalize',
      });
    }

    const currentStep = FALLBACK_QUESTIONS[turnIndex % FALLBACK_QUESTIONS.length];
    return NextResponse.json({
      success: true,
      source: 'local_fallback',
      reply: currentStep.question,
      clarifying_question: currentStep.question,
      suggested_replies: currentStep.suggestions,
      extracted_spec: extracted_spec || {},
      completeness_score: completeness,
      is_ready_to_finalize: false,
      ready_for_decomposition: false,
      recommended_action: 'continue_asking',
    });
  } catch (err: any) {
    console.error('[Scoping Chat API] Error:', err);
    return NextResponse.json({ error: err.message || 'Scoping chat error' }, { status: 500 });
  }
}
