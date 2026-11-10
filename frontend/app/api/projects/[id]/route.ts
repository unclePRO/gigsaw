import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

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
