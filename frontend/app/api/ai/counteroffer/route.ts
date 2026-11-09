import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';
import { IAiCounterofferAnalysis } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      original_quotation,
      proposed_amount,
      proposed_delivery_days,
      message,
      project_budget_remaining,
    } = body;

    if (!original_quotation || proposed_amount === undefined || proposed_delivery_days === undefined) {
      return NextResponse.json(
        { error: 'original_quotation, proposed_amount, and proposed_delivery_days are required.' },
        { status: 400 }
      );
    }

    // 1. Try FastAPI AI microservice
    try {
      const aiResult = await aiClient.analyzeCounteroffer({
        original_quotation: {
          quotation_id: original_quotation.quotation_id || 'q-default',
          freelancer_id: original_quotation.freelancer_id || 'fl-default',
          work_package_id: original_quotation.work_package_id || 'wp-default',
          amount: original_quotation.amount,
          delivery_days: Number(original_quotation.delivery_days) || 7,
          scope: original_quotation.scope || 'Standard milestone scope',
          status: original_quotation.status || 'pending',
        },
        proposed_amount,
        proposed_delivery_days: Number(proposed_delivery_days),
        message: message || '',
        project_budget_remaining,
      });

      if (aiResult) {
        return NextResponse.json({
          success: true,
          analysis: aiResult,
          source: 'fastapi_microservice',
        });
      }
    } catch (err: any) {
      console.warn('[AI Counteroffer] FastAPI unreachable, using local algorithmic fallback:', err.message);
    }

    // 2. High-precision Local Fallback
    const origAmt = Number(original_quotation.amount) || 1;
    const propAmt = Number(proposed_amount);
    const amount_delta = Math.round((propAmt - origAmt) * 100) / 100;
    const percentage_delta = Math.round((amount_delta / origAmt) * 1000) / 10;
    const origDays = Number(original_quotation.delivery_days) || 7;
    const propDays = Number(proposed_delivery_days);
    const delivery_days_delta = propDays - origDays;

    let budget_impact = 'Budget Neutral';
    let recommendation = 'Counteroffer aligns with original quote.';

    if (amount_delta > 0) {
      if (percentage_delta <= 15) {
        budget_impact = `Moderate +${percentage_delta}% price adjustment absorbable within project contingency buffer.`;
        recommendation = `Recommended to approve if the specialist's scope notes justify accelerated or premium execution.`;
      } else {
        budget_impact = `Significant +${percentage_delta}% price increase exceeding typical milestone variance.`;
        recommendation = `Suggest negotiating scope or confirming additional deliverables before authorization.`;
      }
    } else if (amount_delta < 0) {
      budget_impact = `Favorable ${percentage_delta}% savings on milestone budget.`;
      recommendation = `Highly recommended for acceptance provided proposed turnaround meets project deadlines.`;
    }

    if (delivery_days_delta > 0) {
      recommendation += ` Note: Proposed schedule extends delivery by ${delivery_days_delta} day(s).`;
    } else if (delivery_days_delta < 0) {
      recommendation += ` Note: Expedited delivery (${Math.abs(delivery_days_delta)} day(s) faster than original estimate).`;
    }

    const fallbackAnalysis: IAiCounterofferAnalysis = {
      amount_delta,
      percentage_delta,
      delivery_days_delta,
      budget_impact,
      recommendation,
      approval_required: true,
    };

    return NextResponse.json({
      success: true,
      analysis: fallbackAnalysis,
      source: 'local_engine',
    });
  } catch (error: any) {
    console.error('Error analyzing counteroffer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze counteroffer.' },
      { status: 500 }
    );
  }
}
