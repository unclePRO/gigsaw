import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { packageId, message } = body;

    if (!packageId || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'packageId and message are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const project = await ProjectModel.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const pkg = project.workPackages.find((w) => w.id === packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Work package not found.' }, { status: 404 });
    }

    const progressEntry = {
      id: `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message: message.trim(),
      authorName: session.user.name || 'User',
      authorRole: (session.user as any).role || 'freelancer',
      timestamp: new Date().toISOString(),
    };

    if (!pkg.progressUpdates) {
      pkg.progressUpdates = [];
    }
    pkg.progressUpdates.push(progressEntry as any);

    await project.save();

    return NextResponse.json({ success: true, progressEntry }, { status: 201 });
  } catch (error: any) {
    console.error('Error posting progress update:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post progress update' },
      { status: 500 }
    );
  }
}
