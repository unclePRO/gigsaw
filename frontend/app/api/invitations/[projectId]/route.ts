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
    const { action, packageId, proposedAmount, proposedDeliveryDays, notes } = body;

    const allowedActions = ['accept', 'decline', 'counteroffer', 'accept_counteroffer', 'decline_counteroffer'];
    if (!action || !allowedActions.includes(action) || !packageId) {
      return NextResponse.json(
        { error: `action (${allowedActions.join('/')}) and packageId are required.` },
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

    const isMerchant = project.merchantEmail?.toLowerCase() === userEmail;

    if (action === 'accept_counteroffer' || action === 'decline_counteroffer') {
      if (!isMerchant) {
        return NextResponse.json(
          { error: 'Forbidden: Only the project merchant can review counteroffers.' },
          { status: 403 }
        );
      }

      if (action === 'accept_counteroffer') {
        if (pkg.quotationAmount) {
          pkg.allocatedPrice = pkg.quotationAmount;
        }
        if (pkg.quotationDeliveryDays) {
          pkg.estimatedDays = pkg.quotationDeliveryDays;
        }
        pkg.quotationStatus = 'accepted';
        pkg.inviteStatus = 'accepted';
        pkg.status = project.status === 'FUNDED_IN_PROGRESS' || project.status === 'funded' ? 'In Progress' : 'Pending';

        // Recalculate totals
        project.allocatedTotal = project.workPackages.reduce((s, w) => s + (w.allocatedPrice || 0), 0);
        project.savings = Math.max(0, project.totalBudget - project.allocatedTotal);

        const allAccepted =
          project.workPackages.length > 0 &&
          project.workPackages.every((w) => w.inviteStatus === 'accepted');

        if (allAccepted && project.status !== 'funded' && project.status !== 'FUNDED_IN_PROGRESS') {
          project.status = 'READY_TO_FUND';
        }
      } else {
        pkg.quotationStatus = 'declined';
      }

      await project.save();

      return NextResponse.json({
        success: true,
        action,
        packageId,
        quotationStatus: pkg.quotationStatus,
        allocatedPrice: pkg.allocatedPrice,
        estimatedDays: pkg.estimatedDays,
        inviteStatus: pkg.inviteStatus,
        status: pkg.status,
      });
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
      pkg.status = project.status === 'FUNDED_IN_PROGRESS' || project.status === 'funded' ? 'In Progress' : 'Pending';
      // If was unassigned, assign to this freelancer
      if (!pkg.assignedFreelancerEmail) {
        pkg.assignedFreelancerEmail = userEmail;
        pkg.assignedFreelancerName = session.user.name || 'Freelancer';
        pkg.assignedFreelancerId = (session.user as any).id;
      }

      const allAccepted =
        project.workPackages.length > 0 &&
        project.workPackages.every((w) => w.inviteStatus === 'accepted');

      if (allAccepted && project.status !== 'funded' && project.status !== 'FUNDED_IN_PROGRESS') {
        project.status = 'READY_TO_FUND';
      }
    } else if (action === 'counteroffer') {
      pkg.quotationStatus = 'counteroffer';
      pkg.quotationAmount = Number(proposedAmount) || pkg.allocatedPrice;
      pkg.quotationDeliveryDays = Number(proposedDeliveryDays) || pkg.estimatedDays || 7;
      pkg.quotationScope = notes || pkg.description;
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
      quotationStatus: pkg.quotationStatus,
      quotationAmount: pkg.quotationAmount,
    });
  } catch (error: any) {
    console.error('Error handling invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update invitation status' },
      { status: 500 }
    );
  }
}
