import { NextRequest, NextResponse } from 'next/server';
import { aiClient } from '@/lib/aiClient';
import { IAiProgressSummary } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_name, tasks } = body;

    if (!project_name || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'project_name and tasks array are required.' },
        { status: 400 }
      );
    }

    // 1. Try FastAPI AI microservice
    try {
      const summary = await aiClient.getProgressSummary({
        project_name,
        tasks,
      });

      if (summary) {
        return NextResponse.json({
          success: true,
          progress: summary,
          source: 'fastapi_microservice',
        });
      }
    } catch (err: any) {
      console.warn('[AI Progress] FastAPI unreachable, falling back to local progress analyzer:', err.message);
    }

    // 2. High-precision Local Fallback
    const totalCount = tasks.length || 1;
    const completed_count = tasks.filter((t) => t.status === 'completed').length;
    const in_progress_count = tasks.filter((t) => t.status === 'in_progress').length;
    const blockedTasksList = tasks.filter((t) => t.status === 'blocked');
    const blocked_tasks = blockedTasksList.map((t) => t.name);
    const overdue_tasks: string[] = [];

    const completion_percentage = Math.round((completed_count / totalCount) * 100);

    let summaryText = `Project "${project_name}" is currently at ${completion_percentage}% completion with ${completed_count} of ${totalCount} milestones fulfilled.`;
    if (blocked_tasks.length > 0) {
      summaryText += ` Alert: ${blocked_tasks.length} milestone(s) are blocked by dependencies or pending revision.`;
    } else if (in_progress_count > 0) {
      summaryText += ` ${in_progress_count} milestone(s) are actively progressing on schedule.`;
    }

    const recommended_actions: string[] = [];
    if (blocked_tasks.length > 0) {
      recommended_actions.push(`Review feedback for blocked milestone "${blocked_tasks[0]}" to unblock dependent team tasks.`);
    }
    if (in_progress_count > 0) {
      recommended_actions.push('Check in with active specialists via Project Team Chat for interim deliverables.');
    }
    if (completed_count === totalCount) {
      recommended_actions.push('All milestones completed! Review final assets and finalize project delivery.');
    } else {
      recommended_actions.push('Verify PayPal escrow funding balance for upcoming milestone releases.');
    }

    const fallbackSummary: IAiProgressSummary = {
      project_name,
      completion_percentage,
      completed_count,
      in_progress_count,
      blocked_tasks,
      overdue_tasks,
      summary: summaryText,
      recommended_actions,
    };

    return NextResponse.json({
      success: true,
      progress: fallbackSummary,
      source: 'local_engine',
    });
  } catch (error: any) {
    console.error('Error analyzing project progress:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze project progress.' },
      { status: 500 }
    );
  }
}
