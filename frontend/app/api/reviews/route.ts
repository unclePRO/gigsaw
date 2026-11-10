import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ReviewModel } from '@/models/Review';
import { ProjectModel } from '@/models/Project';
import { UserModel } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');

    const targetEmail = (emailParam || session?.user?.email)?.toLowerCase();
    if (!targetEmail) {
      return NextResponse.json({ error: 'Email parameter or active session required' }, { status: 400 });
    }

    await connectToDatabase();

    const reviews = await ReviewModel.find({ freelancerEmail: targetEmail })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, reviews });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, packageId, rating, reviewText } = body;

    if (!projectId || !packageId) {
      return NextResponse.json({ error: 'projectId and packageId are required' }, { status: 400 });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5 stars' }, { status: 400 });
    }

    if (!reviewText || !String(reviewText).trim()) {
      return NextResponse.json({ error: 'Written review text is required' }, { status: 400 });
    }

    await connectToDatabase();

    const project = await ProjectModel.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const pkg = project.workPackages.find((w) => w.id === packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Milestone work package not found' }, { status: 404 });
    }

    const flEmail = (pkg.assignedFreelancerEmail || '').toLowerCase().trim();
    if (!flEmail) {
      return NextResponse.json({ error: 'No freelancer assigned to this milestone' }, { status: 400 });
    }

    // Lookup freelancer user document if available
    const flUser = await UserModel.findOne({ email: flEmail });

    // 1. Create and save the Review document
    const newReview = await ReviewModel.create({
      freelancerId: flUser?._id?.toString() || pkg.assignedFreelancerId || 'fl-user',
      freelancerName: pkg.assignedFreelancerName || flUser?.name || 'Specialist',
      freelancerEmail: flEmail,
      merchantId: project.merchantId || (session.user as any).id || 'merchant-id',
      merchantName: project.merchantName || session.user.name || 'Merchant',
      merchantEmail: project.merchantEmail || session.user.email.toLowerCase(),
      projectId: project._id.toString(),
      projectName: project.projectName,
      packageId: pkg.id,
      packageTitle: pkg.title,
      category: pkg.category,
      rating: Math.round(numRating),
      reviewText: String(reviewText).trim(),
    });

    // 2. Update WorkPackage in Project
    pkg.status = 'Completed';
    pkg.reviewSubmitted = true;
    pkg.reviewRating = Math.round(numRating);
    pkg.reviewText = String(reviewText).trim();
    pkg.reviewedAt = new Date();

    // Check if all work packages in the project are completed
    const allCompleted = project.workPackages.every((wp) => wp.status === 'Completed');
    if (allCompleted) {
      project.status = 'completed';
    }

    await project.save();

    // 3. Recalculate and update freelancer's actual rating & completedProjects count in MongoDB
    const allFlReviews = await ReviewModel.find({ freelancerEmail: flEmail });
    const count = allFlReviews.length;
    const totalSum = allFlReviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avgRating = count > 0 ? Math.round((totalSum / count) * 10) / 10 : 0;

    if (flUser) {
      flUser.rating = avgRating;
      flUser.completedProjects = count;
      await flUser.save();
    } else {
      await UserModel.updateOne(
        { email: flEmail },
        { $set: { rating: avgRating, completedProjects: count } }
      );
    }

    return NextResponse.json({
      success: true,
      review: newReview,
      averageRating: avgRating,
      completedProjects: count,
      projectCompleted: allCompleted,
    });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}
