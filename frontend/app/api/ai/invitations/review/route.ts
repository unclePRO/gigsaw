import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      freelancer_id,
      project_name,
      merchant_name,
      work_package_title,
      service_category,
      description,
      deliverables,
      allocated_price,
      estimated_days,
      currency,
    } = body;

    if (!work_package_title || allocated_price == null) {
      return NextResponse.json({ error: 'Missing required invitation parameters' }, { status: 400 });
    }

    const aiRes = await aiClient.reviewInvitation({
      freelancer_id: freelancer_id || 'fl-1',
      project_name: project_name || 'Client Project',
      merchant_name: merchant_name || 'Merchant',
      work_package_title,
      service_category: service_category || 'dev',
      description: description || '',
      deliverables: deliverables || [],
      allocated_price: Number(allocated_price),
      estimated_days: Number(estimated_days || 7),
      currency: currency || 'USD',
    });

    if (aiRes) {
      return NextResponse.json({
        success: true,
        source: 'fastapi_microservice',
        ...aiRes,
      });
    }

    // Local fallback review
    const price = Number(allocated_price);
    const days = Number(estimated_days || 7);
    const estimatedHours = Math.max(10, days * 5);
    const effectiveHourly = Math.round(price / estimatedHours);
    const isGoodRate = effectiveHourly >= 45;

    return NextResponse.json({
      success: true,
      source: 'local_fallback',
      feasibility_score: isGoodRate ? 88.0 : 68.0,
      feasibility_assessment: isGoodRate ? 'high' : 'moderate',
      market_rate_evaluation: `Offered milestone budget of $${price} equates to ~$${effectiveHourly}/hr for ~${estimatedHours} estimated working hours.`,
      estimated_hours: estimatedHours,
      pros: [
        `100% Payment Protection: Funds authorized via PayPal Multi-Seller Checkout for '${work_package_title}'.`,
        `Direct communication channel with client inside project workspace.`,
      ],
      watchouts: [
        `Confirm requirement specifications and deliverable checkpoints before marking complete.`,
      ],
      suggested_decision: isGoodRate ? 'accept' : 'counteroffer',
      recommended_counteroffer_amount: isGoodRate ? null : Math.round(price * 1.25),
      recommended_counteroffer_days: days,
      counteroffer_rationale: isGoodRate
        ? null
        : 'Suggested budget aligns with typical specialist baseline for multi-phase deliverables.',
    });
  } catch (err: any) {
    console.error('[Invitation Review AI API] Error:', err);
    return NextResponse.json({ error: err.message || 'Invitation review error' }, { status: 500 });
  }
}
