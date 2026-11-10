import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export const dynamic = 'force-dynamic';

// Helper to verify user is Merchant or an Assigned Freelancer on the project
async function checkProjectAccess(projectId: string, userEmail: string) {
  const project = await ProjectModel.findById(projectId);
  if (!project) return null;

  const email = userEmail.toLowerCase();
  const isMerchant = project.merchantEmail.toLowerCase() === email;
  const isAssignedFreelancer = project.workPackages.some(
    (wp) => wp.assignedFreelancerEmail?.toLowerCase() === email
  );

  if (!isMerchant && !isAssignedFreelancer) {
    return false;
  }

  return project;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const project = await checkProjectAccess(params.id, session.user.email);
    if (project === null) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project === false) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a participant in this project group chat.' },
        { status: 403 }
      );
    }

    // Build participants list for chat header
    const participants = [
      {
        name: project.merchantName,
        email: project.merchantEmail,
        role: 'Merchant',
      },
      ...project.workPackages
        .filter((wp) => wp.assignedFreelancerEmail)
        .map((wp) => ({
          name: wp.assignedFreelancerName || 'Specialist',
          email: wp.assignedFreelancerEmail,
          role: wp.category.toUpperCase(),
        })),
    ];

    return NextResponse.json({
      success: true,
      projectName: project.projectName,
      messages: project.messages || [],
      participants,
    });
  } catch (error: any) {
    console.error('Chat fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const project = await checkProjectAccess(params.id, session.user.email);
    if (project === null) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project === false) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to post in this chat group.' },
        { status: 403 }
      );
    }

    const isAi = Boolean(body.isAiAssistant);
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: isAi ? 'ai-coordinator' : ((session.user as any).id || session.user.email),
      senderName: isAi ? 'AI Coordinator' : (session.user.name || 'User'),
      senderEmail: isAi ? 'ai@gigsaw.local' : session.user.email,
      senderRole: isAi ? 'ai_assistant' : (((session.user as any).role || 'freelancer') as 'merchant' | 'freelancer'),
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    project.messages.push(newMessage as any);
    await project.save();

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
  } catch (error: any) {
    console.error('Chat post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post message' },
      { status: 500 }
    );
  }
}
