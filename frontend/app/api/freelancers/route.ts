import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const serviceCategory = searchParams.get('serviceCategory');

    const query: any = { role: 'freelancer' };
    if (category && ['dev', 'designer', 'marketer'].includes(category)) {
      query.category = category;
    }
    if (serviceCategory) {
      query.serviceCategories = serviceCategory;
    }

    // Never return password
    const freelancers = await UserModel.find(query)
      .select('-password')
      .sort({ rating: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, count: freelancers.length, freelancers });
  } catch (error: any) {
    console.error('Error fetching freelancers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch freelancers from MongoDB' },
      { status: 500 }
    );
  }
}
