import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, project_name, merchant_name, members, messages, action = 'kickoff' } = body;

    if (!project_name) {
      return NextResponse.json({ error: 'project_name is required' }, { status: 400 });
    }

    const aiRes = await aiClient.chatRoomAssist({
      project_id,
      project_name,
      merchant_name: merchant_name || 'Merchant',
      members: members || [],
      messages: messages || [],
      action,
    });

    if (aiRes) {
      return NextResponse.json({
        success: true,
        source: 'fastapi_microservice',
        ...aiRes,
      });
    }

    // Fallback response if microservice is offline
    if (action === 'kickoff') {
      const flNames = (members || [])
        .filter((m: any) => m.role === 'freelancer')
        .map((m: any) => m.name);
      const teamList = flNames.length > 0 ? flNames.join(', ') : 'the assembled specialists';

      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        action: 'kickoff',
        message: `👋 Welcome to the team room for ${project_name}! ${merchant_name || 'Merchant'} has hired ${teamList}. All milestones are escrow-secured with PayPal. Feel free to introduce yourselves and coordinate deliverable handoffs.`,
        action_items: flNames.map((n: string) => ({
          task: `Confirm deliverable schedule and access`,
          assignee: n,
          status: 'pending',
        })),
        summary: `Project room initialized with ${flNames.length} specialist(s).`,
      });
    }

    if (action === 'action_items') {
      return NextResponse.json({
        success: true,
        source: 'local_fallback',
        action: 'action_items',
        message: 'Current milestone tasks and pending deliverables:',
        action_items: [
          { task: 'Review milestone requirements', assignee: merchant_name || 'Merchant', status: 'pending' },
          { task: 'Provide initial draft / design mockups', assignee: 'Assigned Specialist', status: 'pending' },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      source: 'local_fallback',
      action,
      message: 'Discussion underway. Milestones progress tracked in escrow.',
      summary: 'Team coordinating deliverables.',
      action_items: [],
    });
  } catch (err: any) {
    console.error('[Chat Room AI API] Error:', err);
    return NextResponse.json({ error: err.message || 'Chat room assistant error' }, { status: 500 });
  }
}
