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

    const existingUser = await UserModel.findOne({ email: session.user.email.toLowerCase() });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const finalTitle = title !== undefined ? title : existingUser.title;
    const finalBio = bio !== undefined ? bio : existingUser.bio;
    const finalHourlyRate = hourlyRate !== undefined ? Number(hourlyRate) : existingUser.hourlyRate;
    const finalSkills = Array.isArray(skills) ? skills : existingUser.skills;
    const finalYears = yearsOfExperience !== undefined ? Number(yearsOfExperience) : existingUser.yearsOfExperience;
    const finalDeliveryDays = typicalDeliveryDays !== undefined ? Number(typicalDeliveryDays) : existingUser.typicalDeliveryDays;
    const finalLocation = location !== undefined ? location : existingUser.location;

    const isComplete = Boolean(
      finalTitle && String(finalTitle).trim().length > 0 &&
      finalBio && String(finalBio).trim().length > 0 &&
      finalHourlyRate && Number(finalHourlyRate) > 0 &&
      finalSkills && finalSkills.length > 0 &&
      finalYears !== undefined && finalYears !== null && !isNaN(Number(finalYears)) && Number(finalYears) >= 0 &&
      finalDeliveryDays !== undefined && finalDeliveryDays !== null && !isNaN(Number(finalDeliveryDays)) && Number(finalDeliveryDays) >= 1 &&
      finalLocation && String(finalLocation).trim().length > 0
    );

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
          isProfileComplete: isComplete,
        },
      },
      { new: true }
    )
      .select('-password')
      .lean();

    return NextResponse.json({ success: true, profile: updatedUser, isProfileComplete: isComplete });
  } catch (error: any) {
    console.error('Error updating freelancer profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
