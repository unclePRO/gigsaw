import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    const body = await req.json();
    const { action, packageId } = body;

    if (!action || !['accept', 'decline'].includes(action) || !packageId) {
      return NextResponse.json(
        { error: 'action (accept/decline) and packageId are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const userEmail = session.user.email.toLowerCase();
    const pkg = project.workPackages.find((w) => w.id === packageId);

    if (!pkg) {
      return NextResponse.json({ error: 'Work package not found.' }, { status: 404 });
    }

    // Verify assignment to this freelancer
    const isAssigned =
      !pkg.assignedFreelancerEmail ||
      pkg.assignedFreelancerEmail.toLowerCase() === userEmail ||
      pkg.category === (session.user as any).category;

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'Forbidden: You are not assigned to this milestone.' },
        { status: 403 }
      );
    }

    if (action === 'accept') {
      pkg.inviteStatus = 'accepted';
      pkg.status = 'In Progress';
      // If was unassigned, assign to this freelancer
      if (!pkg.assignedFreelancerEmail) {
        pkg.assignedFreelancerEmail = userEmail;
        pkg.assignedFreelancerName = session.user.name || 'Freelancer';
        pkg.assignedFreelancerId = (session.user as any).id;
      }
    } else {
      pkg.inviteStatus = 'declined';
      pkg.status = 'Pending';
    }

    await project.save();

    return NextResponse.json({
      success: true,
      action,
      packageId,
      inviteStatus: pkg.inviteStatus,
      status: pkg.status,
    });
  } catch (error: any) {
    console.error('Error handling invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update invitation status' },
      { status: 500 }
    );
  }
}
