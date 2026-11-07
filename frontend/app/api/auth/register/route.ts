import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, category, hourlyRate, title, bio, paypalEmail, skills } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Name, email, password, and role are required.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (role === 'freelancer' && !category) {
      return NextResponse.json(
        { error: 'Category (dev, designer, or marketer) is required for freelancer accounts.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await UserModel.findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserModel.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      category: role === 'freelancer' ? category : undefined,
      title: title || (role === 'freelancer' ? `${category?.toUpperCase()} Specialist` : 'Business Owner'),
      hourlyRate: Number(hourlyRate) || 50,
      bio: bio || '',
      paypalEmail: paypalEmail || normalizedEmail,
      skills: Array.isArray(skills) ? skills : [],
      rating: 5.0,
      completedProjects: 0,
      pastProjects: [],
      availability: 'available',
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          category: newUser.category,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user profile in MongoDB.' },
      { status: 500 }
    );
  }
}
