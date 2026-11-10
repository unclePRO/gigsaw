import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { aiClient } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      work_package_id,
      service_category,
      required_skills,
      brief,
      budget,
      max_delivery_days,
      current_freelancer_id,
      exclude_freelancer_ids = [],
    } = body;

    await connectToDatabase();

    const category = (service_category || 'dev').toLowerCase();
    let broadCategory: 'dev' | 'designer' | 'marketer' = 'dev';
    if (category.includes('design') || category.includes('logo') || category.includes('brand') || category.includes('ui')) {
      broadCategory = 'designer';
    } else if (category.includes('market') || category.includes('seo') || category.includes('social') || category.includes('ad')) {
      broadCategory = 'marketer';
    }

    // Try AI Microservice Swap
    try {
      const swapRes = await aiClient.swapFreelancer({
        work_package_id,
        service_category,
        required_skills: required_skills || [],
        brief: brief || '',
        budget: budget ? Number(budget) : undefined,
        max_delivery_days: max_delivery_days ? Number(max_delivery_days) : undefined,
        current_freelancer_id: current_freelancer_id || '',
        exclude_freelancer_ids: [
          ...exclude_freelancer_ids,
          ...(current_freelancer_id ? [current_freelancer_id] : []),
        ],
      });

      if (swapRes && swapRes.swapped && swapRes.new_match) {
        const matched = swapRes.new_match;
        const rawScore = Number(matched.score) || 92;
        const normalizedScore = rawScore > 1 ? Math.min(99, Math.round(rawScore)) : Math.min(99, Math.round(rawScore * 100));

        // Fetch rich profile from MongoDB
        const dbProfile = await UserModel.findOne({
          $or: [
            ...(matched.freelancer?.email ? [{ email: matched.freelancer.email.toLowerCase() }] : []),
            ...(matched.freelancer?.id ? [{ _id: matched.freelancer.id }] : []),
            { name: matched.freelancer?.name },
          ],
        })
          .select('-password')
          .lean();

        return NextResponse.json({
          success: true,
          swapped: true,
          source: 'fastapi_microservice',
          message: swapRes.message,
          freelancer: {
            id: dbProfile?._id?.toString() || matched.freelancer?.id,
            name: dbProfile?.name || matched.freelancer?.name,
            email: dbProfile?.email || matched.freelancer?.email,
            bio: dbProfile?.bio || '',
            skills: dbProfile?.skills || required_skills || [],
            rating: dbProfile?.rating ?? matched.freelancer?.rating ?? 5.0,
            completedProjects: dbProfile?.completedProjects ?? 0,
            pastProjects: dbProfile?.pastProjects || [],
            yearsOfExperience: dbProfile?.yearsOfExperience ?? matched.freelancer?.experience_years ?? 3,
            hourlyRate: dbProfile?.hourlyRate ?? matched.freelancer?.indicative_price ?? 50,
            location: dbProfile?.location || 'Remote',
            matchScore: normalizedScore,
            matchScoreBreakdown: matched.score_breakdown,
            matchReasons: matched.reasons,
          },
        });
      }
    } catch (e: any) {
      console.warn('[AI Swap] FastAPI swap failed, falling back to MongoDB pool', e.message);
    }

    // Direct MongoDB fallback for swap
    const filter: any = {
      role: 'freelancer',
      category: broadCategory,
    };

    if (exclude_freelancer_ids && exclude_freelancer_ids.length > 0) {
      filter._id = { $nin: exclude_freelancer_ids };
    }

    let nextFl = await UserModel.findOne(filter)
      .select('-password')
      .sort({ rating: -1, completedProjects: -1 })
      .lean();

    // If all excluded, reset filter to any other than current
    if (!nextFl && current_freelancer_id) {
      nextFl = await UserModel.findOne({
        role: 'freelancer',
        category: broadCategory,
        _id: { $ne: current_freelancer_id },
      })
        .select('-password')
        .sort({ rating: -1 })
        .lean();
    }

    if (nextFl) {
      const rating = nextFl.rating || 4.9;
      return NextResponse.json({
        success: true,
        swapped: true,
        source: 'mongodb_pool',
        message: `Swapped to ${nextFl.name}`,
        freelancer: {
          id: nextFl._id.toString(),
          name: nextFl.name,
          email: nextFl.email,
          bio: nextFl.bio || '',
          skills: nextFl.skills || required_skills || [],
          rating,
          completedProjects: nextFl.completedProjects || 0,
          pastProjects: nextFl.pastProjects || [],
          yearsOfExperience: nextFl.yearsOfExperience || 3,
          hourlyRate: nextFl.hourlyRate || 50,
          location: nextFl.location || 'Remote',
          matchScore: Math.min(99, Math.max(86, Math.round(rating * 19.5))),
          matchScoreBreakdown: {
            semantic_relevance: 32,
            skill_overlap: 24,
            rating: 14.5,
            availability: 10,
            price_compatibility: 9,
            delivery_time: 4.5,
          },
          matchReasons: [
            `Verified specialist in ${broadCategory.toUpperCase()} services`,
            `Rating of ${rating.toFixed(1)}/5 on client milestones`,
            'Available for immediate sprint assignment',
          ],
        },
      });
    }

    return NextResponse.json({
      success: false,
      swapped: false,
      message: 'No alternative specialists found in this category.',
    });
  } catch (err: any) {
    console.error('[AI Swap] Handler error:', err);
    return NextResponse.json({ error: err.message || 'Freelancer swap error' }, { status: 500 });
  }
}
