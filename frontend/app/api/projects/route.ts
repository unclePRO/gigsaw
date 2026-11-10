import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');

    const email = session?.user?.email || emailParam;
    const role = (session?.user as any)?.role;

    let query: any = {};

    if (email) {
      if (role === 'freelancer') {
        const userCat = (session?.user as any)?.category;
        // Find projects where this freelancer is assigned to any work package or matched by category
        query = {
          $or: [
            { 'workPackages.assignedFreelancerEmail': email.toLowerCase() },
            { 'workPackages.assignedFreelancerId': (session?.user as any)?.id },
            ...(userCat ? [{ 'workPackages.category': userCat }] : []),
          ],
        };
      } else {
        query = { merchantEmail: email.toLowerCase() };
      }
    }

    const projects = await ProjectModel.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, count: projects.length, projects });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects from MongoDB' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      projectName,
      merchantPrompt,
      totalBudget,
      allocatedTotal,
      savings,
      workPackages,
      paypalOrderId,
      merchantId,
      merchantName,
      merchantEmail,
      aiAnalysis,
      dependencyPlan,
      assumptions,
      risks,
    } = body;

    if (!merchantPrompt || !totalBudget || !workPackages) {
      return NextResponse.json(
        { error: 'merchantPrompt, totalBudget, and workPackages are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const finalMerchantId = (session?.user as any)?.id || merchantId || 'guest-merchant';
    const finalMerchantName = session?.user?.name || merchantName || 'Merchant';
    const finalMerchantEmail = (session?.user?.email || merchantEmail || 'merchant@example.com').toLowerCase();

    const newProject = await ProjectModel.create({
      merchantId: finalMerchantId,
      merchantName: finalMerchantName,
      merchantEmail: finalMerchantEmail,
      projectName: projectName || 'New Launch Project',
      merchantPrompt,
      totalBudget: Number(totalBudget),
      allocatedTotal: Number(allocatedTotal) || workPackages.reduce((s: number, w: any) => s + (w.allocatedPrice || 0), 0),
      savings: Number(savings) || 0,
      workPackages,
      status: body.status || 'ON_HOLD',
      paypalOrderId: paypalOrderId || undefined,
      aiAnalysis,
      dependencyPlan,
      assumptions,
      risks,
    });

    return NextResponse.json({ success: true, project: newProject }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create project in MongoDB' },
      { status: 500 }
    );
  }
}
