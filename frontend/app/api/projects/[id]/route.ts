import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';
import { normalizePackageBudgets } from '@/lib/budget';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    const project = await ProjectModel.findById(id).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Dynamic self-heal 1: Budget distribution normalization for projects awaiting funding
    const targetBudget = Number(project.totalBudget) || 0;
    const currentSum = (project.workPackages || []).reduce(
      (s: number, w: any) => s + (Number(w.allocatedPrice) || 0),
      0
    );
    if (
      targetBudget > 0 &&
      project.workPackages?.length > 0 &&
      currentSum !== targetBudget &&
      (project.status === 'draft' || project.status === 'ON_HOLD' || project.status === 'READY_TO_FUND' || !project.status)
    ) {
      normalizePackageBudgets(project.workPackages, targetBudget);
      project.allocatedTotal = targetBudget;
      project.savings = 0;
      await ProjectModel.updateOne(
        { _id: project._id },
        {
          $set: {
            workPackages: project.workPackages,
            allocatedTotal: targetBudget,
            savings: 0,
          },
        }
      );
    }

    // Dynamic self-heal 2: if all freelancer invites are accepted, update to READY_TO_FUND
    const allAccepted =
      project.workPackages?.length > 0 &&
      project.workPackages.every((w: any) => w.inviteStatus === 'accepted');

    if (allAccepted && (project.status === 'draft' || project.status === 'ON_HOLD' || !project.status)) {
      project.status = 'READY_TO_FUND';
      await ProjectModel.updateOne({ _id: project._id }, { $set: { status: 'READY_TO_FUND' } });
    } else if (!allAccepted && project.status === 'READY_TO_FUND') {
      project.status = 'ON_HOLD';
      await ProjectModel.updateOne({ _id: project._id }, { $set: { status: 'ON_HOLD' } });
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error('Error fetching project by ID:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch project from MongoDB' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      packageId,
      status,
      projectStatus,
      action,
      deliverableLink,
      deliverableNotes,
      closureRequested,
    } = body;

    await connectToDatabase();

    const project = await ProjectModel.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Handle specialist swap action
    if (action === 'swap_freelancer') {
      const { newFreelancer } = body;
      if (!packageId || !newFreelancer) {
        return NextResponse.json({ error: 'packageId and newFreelancer payload are required for swap' }, { status: 400 });
      }

      const pkg = project.workPackages.find((w) => w.id === packageId);
      if (!pkg) {
        return NextResponse.json({ error: 'Work package not found in project' }, { status: 404 });
      }

      const oldName = pkg.assignedFreelancerName || 'Specialist';
      pkg.assignedFreelancerId = newFreelancer.id || newFreelancer._id;
      pkg.assignedFreelancerName = newFreelancer.name;
      pkg.assignedFreelancerEmail = newFreelancer.email;
      if (newFreelancer.rating) pkg.assignedFreelancerRating = newFreelancer.rating;
      if (newFreelancer.completedProjects !== undefined) pkg.assignedFreelancerCompletedProjects = newFreelancer.completedProjects;
      if (newFreelancer.bio) pkg.assignedFreelancerBio = newFreelancer.bio;
      if (newFreelancer.skills) pkg.assignedFreelancerSkills = newFreelancer.skills;
      if (newFreelancer.location) pkg.assignedFreelancerLocation = newFreelancer.location;
      if (newFreelancer.yearsOfExperience) pkg.assignedFreelancerYearsOfExperience = newFreelancer.yearsOfExperience;
      pkg.inviteStatus = 'invited';
      pkg.status = 'Pending';

      // If the project was previously READY_TO_FUND, it must revert to ON_HOLD to await the new specialist's confirmation
      if (project.status === 'READY_TO_FUND') {
        project.status = 'ON_HOLD';
      }

      // Append real-time notice into project team chat
      project.messages.push({
        id: `msg-swap-${Date.now()}`,
        senderId: 'system',
        senderName: 'Gigsaw AI Assistant',
        senderEmail: 'assistant@gigsaw.com',
        senderRole: 'ai_assistant',
        message: `🔄 Specialist Update: ${newFreelancer.name} has been invited to replace ${oldName} for milestone "${pkg.title}".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      await project.save();
      return NextResponse.json({
        success: true,
        message: `Successfully invited ${newFreelancer.name} to milestone "${pkg.title}".`,
        project,
      });
    }

    // Handle project-level cancellation
    if (action === 'cancel' || projectStatus === 'cancelled' || status === 'cancelled') {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        const isMerchantOwner = project.merchantEmail?.toLowerCase() === userEmail;
        if (!isMerchantOwner && (session.user as any).role !== 'merchant') {
          return NextResponse.json({ error: 'Only the project merchant owner can cancel this project' }, { status: 403 });
        }
      }

      project.status = 'cancelled';
      // Mark any unfinished work packages as Cancelled
      if (Array.isArray(project.workPackages)) {
        project.workPackages.forEach((pkg) => {
          if (pkg.status !== 'Completed') {
            pkg.status = 'Cancelled';
          }
        });
      }

      await project.save();
      return NextResponse.json({
        success: true,
        message: 'Project cancelled successfully',
        project,
      });
    }

    // Handle package-level updates
    if (packageId) {
      const pkg = project.workPackages.find((w) => w.id === packageId);
      if (!pkg) {
        return NextResponse.json({ error: 'Work package not found in project' }, { status: 404 });
      }

      if (status) pkg.status = status;
      if (deliverableLink !== undefined) pkg.deliverableLink = deliverableLink;
      if (deliverableNotes !== undefined) pkg.deliverableNotes = deliverableNotes;
      if (closureRequested !== undefined) pkg.closureRequested = Boolean(closureRequested);

      await project.save();
      return NextResponse.json({ success: true, project });
    }

    return NextResponse.json(
      { error: 'Either packageId or project-level action is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update project in MongoDB' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await connectToDatabase();

    const project = await ProjectModel.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Cancel project safely
    project.status = 'cancelled';
    if (Array.isArray(project.workPackages)) {
      project.workPackages.forEach((pkg) => {
        if (pkg.status !== 'Completed') {
          pkg.status = 'Cancelled';
        }
      });
    }

    await project.save();
    return NextResponse.json({
      success: true,
      message: 'Project cancelled successfully',
      project,
    });
  } catch (error: any) {
    console.error('Error cancelling project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel project in MongoDB' },
      { status: 500 }
    );
  }
}
