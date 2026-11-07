import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await UserModel.findOne({ email: session.user.email.toLowerCase() })
      .select('-password')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: user });
  } catch (error: any) {
    console.error('Error fetching freelancer profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      bio,
      hourlyRate,
      skills,
      pastProjects,
      paypalEmail,
      availability,
      serviceCategories,
      yearsOfExperience,
      typicalDeliveryDays,
      indicativeProjectPrice,
      location,
      priceBasis,
    } = body;

    await connectToDatabase();

    const updatedUser = await UserModel.findOneAndUpdate(
      { email: session.user.email.toLowerCase() },
      {
        $set: {
          ...(title !== undefined && { title }),
          ...(bio !== undefined && { bio }),
          ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
          ...(Array.isArray(skills) && { skills }),
          ...(Array.isArray(pastProjects) && { pastProjects }),
          ...(paypalEmail !== undefined && { paypalEmail }),
          ...(availability !== undefined && { availability }),
          ...(Array.isArray(serviceCategories) && { serviceCategories }),
          ...(yearsOfExperience !== undefined && { yearsOfExperience: Number(yearsOfExperience) }),
          ...(typicalDeliveryDays !== undefined && { typicalDeliveryDays: Number(typicalDeliveryDays) }),
          ...(indicativeProjectPrice !== undefined && {
            indicativeProjectPrice: Number(indicativeProjectPrice),
          }),
          ...(location !== undefined && { location }),
          ...(priceBasis !== undefined && { priceBasis }),
        },
      },
      { new: true }
    )
      .select('-password')
      .lean();

    return NextResponse.json({ success: true, profile: updatedUser });
  } catch (error: any) {
    console.error('Error updating freelancer profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
