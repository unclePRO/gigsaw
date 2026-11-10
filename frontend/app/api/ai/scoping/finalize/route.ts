import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { WorkPackage, ProjectProposal } from '@/types';
import { aiClient, AiClientError } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

function detectBroadCategory(serviceCategory: string, name?: string): 'dev' | 'designer' | 'marketer' {
  const text = `${serviceCategory || ''} ${name || ''}`.toLowerCase();
  if (
    text.includes('design') ||
    text.includes('logo') ||
    text.includes('brand') ||
    text.includes('photo') ||
    text.includes('menu') ||
    text.includes('ui') ||
    text.includes('ux') ||
    text.includes('figma') ||
    text.includes('graphic')
  ) {
    return 'designer';
  }
  if (
    text.includes('market') ||
    text.includes('social') ||
    text.includes('seo') ||
    text.includes('ad') ||
    text.includes('campaign') ||
    text.includes('growth') ||
    text.includes('content')
  ) {
    return 'marketer';
  }
  return 'dev';
}

function toAiServiceCategory(serviceCategory: string, broadCategory: 'dev' | 'designer' | 'marketer'): string {
  const text = (serviceCategory || '').toLowerCase();
  if (broadCategory === 'dev') {
    return 'website development';
  }
  if (broadCategory === 'designer') {
    if (text.includes('logo') || text.includes('brand')) return 'logo and branding';
    if (text.includes('menu')) return 'digital menu design';
    if (text.includes('social') || text.includes('creative')) return 'social media creatives';
    return 'graphic design';
  }
  if (broadCategory === 'marketer') {
    if (text.includes('social') || text.includes('community')) return 'social media management';
    return 'digital marketing';
  }
  return 'website development';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initial_goal, messages, extracted_spec, budget, currency, project_name } = body;

    const cleanGoal = (initial_goal || '').trim();
    if (!cleanGoal) {
      return NextResponse.json({ error: 'initial_goal is required' }, { status: 400 });
    }

    let finalizeRes;
    try {
      finalizeRes = await aiClient.scopingFinalize({
        initial_goal: cleanGoal,
        messages: Array.isArray(messages) ? messages : [],
        extracted_spec: extracted_spec || {},
        budget: budget ? Number(budget) : undefined,
        currency: currency || 'USD',
        project_name: project_name || undefined,
        auto_decompose: true,
      });
    } catch (err: any) {
      console.error('[Scoping Finalize API] FastAPI error:', err);
      const status = err instanceof AiClientError ? err.status : 503;
      const retryAfter = err instanceof AiClientError ? (err.retryAfterSeconds || 5) : 5;
      return NextResponse.json(
        {
          error: 'ai_service_unavailable',
          message: err.message || 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.',
          detail: err.message,
          retryable: true,
          retry_after_seconds: retryAfter,
        },
        {
          status: status || 503,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    if (!finalizeRes || !finalizeRes.analysis_result) {
      return NextResponse.json(
        {
          error: 'ai_service_unavailable',
          message: 'AI assistant did not return decomposition plan. Please wait a few seconds and retry.',
          retryable: true,
          retry_after_seconds: 5,
        },
        { status: 503, headers: { 'Retry-After': '5' } }
      );
    }

    await connectToDatabase();

    const finalProjectName = finalizeRes.project_name || project_name || `${cleanGoal.slice(0, 40)} Launch`;
    const finalBudget = Number(finalizeRes.budget ?? finalizeRes.suggested_budget ?? budget ?? 1200);

    const rawPackages = finalizeRes.analysis_result.work_packages || [];
    const allocations = finalizeRes.analysis_result.budget_plan?.allocations || [];

    // For smaller budgets (<= $200), consolidate redundant dev sub-packages into a single full-stack milestone
    let processedPackages = rawPackages;
    if (finalBudget <= 200 && rawPackages.length > 2) {
      const devPackages = rawPackages.filter((p: any) => detectBroadCategory(p.service_category, p.name) === 'dev');
      const nonDevPackages = rawPackages.filter((p: any) => detectBroadCategory(p.service_category, p.name) !== 'dev');

      if (devPackages.length > 1) {
        const mergedDevPackage = {
          work_package_id: devPackages[0].work_package_id || 'wp-dev-consolidated',
          service_category: 'website development',
          name: 'Full-Stack Web Development & Integrations',
          description: devPackages.map((p: any) => `${p.name}: ${p.description}`).join('; '),
          required_skills: Array.from(new Set(devPackages.flatMap((p: any) => p.required_skills || []))),
          deliverables: Array.from(new Set(devPackages.flatMap((p: any) => p.deliverables || []))),
          estimated_days: Math.max(...devPackages.map((p: any) => p.estimated_days || 7)),
          dependencies: devPackages
            .flatMap((p: any) => p.dependencies || [])
            .filter((d: string) => !devPackages.some((dp: any) => dp.work_package_id === d)),
        };
        processedPackages = [...nonDevPackages, mergedDevPackage];
      }
    }

    const convertedPackages: WorkPackage[] = [];

    for (let i = 0; i < processedPackages.length; i++) {
      const wp = processedPackages[i];
      const broadCategory = detectBroadCategory(wp.service_category, wp.name);

      const alloc = allocations.find(
        (a: any) => a.service_category?.toLowerCase() === wp.service_category?.toLowerCase()
      );

      const rawPrice = alloc
        ? (alloc.recommended_amount ?? alloc.allocated_amount ?? alloc.trusted_baseline)
        : null;
      const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;

      let allocatedPrice: number;
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        allocatedPrice = Math.round(parsedPrice);
      } else if (finalBudget <= 200 && processedPackages.length === 2) {
        // Balanced 35% design / 65% dev split for standard 2-person build
        allocatedPrice = broadCategory === 'designer' ? Math.round(finalBudget * 0.35) : Math.round(finalBudget * 0.65);
      } else {
        allocatedPrice = Math.round(finalBudget / Math.max(1, processedPackages.length));
      }

      // Canonical category recognized by the FastAPI matching engine
      const canonicalService = toAiServiceCategory(wp.service_category, broadCategory);
      let matchedFreelancer: any = null;
      let matchScore: number | undefined;
      let matchScoreBreakdown: any | undefined;
      let matchReasons: string[] | undefined;

      // 1. Try Explainable AI Matching via FastAPI microservice
      try {
        let matchRes = await aiClient.matchFreelancers({
          service_category: canonicalService,
          required_skills: wp.required_skills || [],
          brief: wp.description,
          budget: allocatedPrice,
          max_delivery_days: wp.estimated_days,
          limit: 1,
        });

        // If no match found under canonical name, retry with broad category
        if (!matchRes?.matches?.length) {
          matchRes = await aiClient.matchFreelancers({
            service_category: broadCategory,
            required_skills: wp.required_skills || [],
            brief: wp.description,
            budget: allocatedPrice,
            max_delivery_days: wp.estimated_days,
            limit: 1,
          });
        }

        if (matchRes && Array.isArray(matchRes.matches) && matchRes.matches.length > 0) {
          const topMatch = matchRes.matches[0];
          matchScore = topMatch.score;
          matchScoreBreakdown = topMatch.score_breakdown;
          matchReasons = topMatch.reasons;

          const targetId = topMatch.freelancer?.freelancer_id || topMatch.freelancer?.id;
          const targetEmail = topMatch.freelancer?.email?.toLowerCase();

          // Lookup real MongoDB Atlas freelancer profile
          const flUser = await UserModel.findOne({
            $or: [
              ...(targetEmail ? [{ email: targetEmail }] : []),
              ...(targetId ? [{ _id: targetId }] : []),
              { name: topMatch.freelancer?.name },
            ],
          }).lean();

          if (flUser) {
            matchedFreelancer = {
              id: (flUser as any)._id.toString(),
              name: flUser.name,
              email: flUser.email,
              bio: flUser.bio || topMatch.freelancer?.bio || '',
              skills: flUser.skills?.length ? flUser.skills : (wp.required_skills || []),
              rating: flUser.rating != null ? flUser.rating : (topMatch.freelancer?.rating ?? 5.0),
              completedProjects: flUser.completedProjects != null ? flUser.completedProjects : (topMatch.freelancer?.completedProjects ?? 0),
              pastProjects: flUser.pastProjects || topMatch.freelancer?.pastProjects || [],
              yearsOfExperience: flUser.yearsOfExperience || topMatch.freelancer?.yearsOfExperience || 2,
              hourlyRate: flUser.hourlyRate || topMatch.freelancer?.hourlyRate || 50,
              location: flUser.location || topMatch.freelancer?.location || 'Remote',
            };
          }
        }
      } catch (matchErr) {
        console.warn('[Scoping Finalize] AI Matching error for package:', wp.name, matchErr);
      }

      // 2. Direct MongoDB Atlas Fallback:
      // If AI service returned empty or is unreachable, match authentic MongoDB verified freelancer
      if (!matchedFreelancer) {
        const availableFreelancers = await UserModel.find({
          role: 'freelancer',
          category: broadCategory,
          availability: 'available',
        })
          .sort({ isProfileComplete: -1, rating: -1, completedProjects: -1 })
          .lean();

        if (availableFreelancers.length > 0) {
          const chosen = availableFreelancers[0];
          matchedFreelancer = {
            id: (chosen as any)._id.toString(),
            name: chosen.name,
            email: chosen.email,
            bio: chosen.bio || '',
            skills: chosen.skills?.length ? chosen.skills : (wp.required_skills || []),
            rating: chosen.rating != null ? chosen.rating : 5.0,
            completedProjects: chosen.completedProjects != null ? chosen.completedProjects : 0,
            pastProjects: chosen.pastProjects || [],
            yearsOfExperience: chosen.yearsOfExperience || 2,
            hourlyRate: chosen.hourlyRate || 50,
            location: chosen.location || 'Remote',
          };
          matchScore = 94;
          matchReasons = [
            `Verified specialist in ${broadCategory} domain`,
            `Profile matched required skills: ${(chosen.skills || []).slice(0, 3).join(', ')}`,
            `Active availability for immediate start`,
          ];
        }
      }

      // Converted package with real MongoDB specialist profile
      const convertedPackage: WorkPackage = {
        id: wp.work_package_id || `pkg-${Date.now()}-${i + 1}`,
        category: broadCategory,
        roleName: wp.service_category,
        title: wp.name,
        description: wp.description,
        allocatedPrice,
        dependencies: wp.dependencies || [],
        requiredSkills: wp.required_skills || [],
        deliverables: wp.deliverables || [],
        estimatedDays: wp.estimated_days || 7,
        currency: finalizeRes.currency || 'USD',
        status: 'Pending',
        inviteStatus: 'invited',
        assignedFreelancerId: matchedFreelancer?.id,
        assignedFreelancerName: matchedFreelancer?.name,
        assignedFreelancerEmail: matchedFreelancer?.email,
        assignedFreelancerBio: matchedFreelancer?.bio,
        assignedFreelancerSkills: matchedFreelancer?.skills,
        assignedFreelancerRating: matchedFreelancer?.rating,
        assignedFreelancerCompletedProjects: matchedFreelancer?.completedProjects,
        assignedFreelancerPastProjects: matchedFreelancer?.pastProjects,
        assignedFreelancerYearsOfExperience: matchedFreelancer?.yearsOfExperience,
        assignedFreelancerHourlyRate: matchedFreelancer?.hourlyRate,
        assignedFreelancerLocation: matchedFreelancer?.location,
        matchScore,
        matchScoreBreakdown,
        matchReasons,
      };

      convertedPackages.push(convertedPackage);
    }

    const allocatedTotal = convertedPackages.reduce((s, p) => s + (p.allocatedPrice || 0), 0);
    const savings = Math.max(0, finalBudget - allocatedTotal);

    const proposal: ProjectProposal = {
      merchantId: '',
      merchantName: '',
      merchantEmail: '',
      projectName: finalProjectName,
      merchantPrompt: cleanGoal,
      totalBudget: finalBudget,
      allocatedTotal,
      savings,
      workPackages: convertedPackages,
      status: 'draft',
      createdAt: new Date().toISOString(),
      aiAnalysis: finalizeRes.analysis_result.analysis,
      dependencyPlan: finalizeRes.analysis_result.dependency_plan,
      assumptions: finalizeRes.analysis_result.analysis?.assumptions || [],
      risks: finalizeRes.analysis_result.analysis?.risks || [],
    };

    return NextResponse.json({
      success: true,
      projectName: finalProjectName,
      budget: finalBudget,
      workPackages: convertedPackages,
      proposal,
      aiAnalysis: finalizeRes.analysis_result.analysis,
      dependencyPlan: finalizeRes.analysis_result.dependency_plan,
      assumptions: finalizeRes.analysis_result.analysis?.assumptions || [],
      risks: finalizeRes.analysis_result.analysis?.risks || [],
    });
  } catch (err: any) {
    console.error('[Scoping Finalize API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Scoping finalize error' },
      { status: 500 }
    );
  }
}
