import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { packageId, status, deliverableLink, deliverableNotes, closureRequested } = body;

    if (!packageId) {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 });
    }

    await connectToDatabase();

    const project = await ProjectModel.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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
  } catch (error: any) {
    console.error('Error updating project work package:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update work package in MongoDB' },
      { status: 500 }
    );
  }
}
