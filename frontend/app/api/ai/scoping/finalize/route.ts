import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { WorkPackage, ProjectProposal } from '@/types';
import { aiClient, AiClientError } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

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
    const convertedPackages: WorkPackage[] = [];

    for (let i = 0; i < rawPackages.length; i++) {
      const wp = rawPackages[i];
      const alloc = allocations.find(
        (a: any) => a.service_category?.toLowerCase() === wp.service_category?.toLowerCase()
      );

      const rawPrice = alloc
        ? (alloc.recommended_amount ?? alloc.allocated_amount ?? alloc.trusted_baseline)
        : null;
      const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;
      const allocatedPrice = !isNaN(parsedPrice) && parsedPrice > 0
        ? Math.round(parsedPrice)
        : Math.round(finalBudget / Math.max(1, rawPackages.length));

      // Category detection for UI styling
      const svcLower = (wp.service_category || '').toLowerCase();
      let broadCategory: 'dev' | 'designer' | 'marketer' = 'dev';
      if (
        svcLower.includes('design') ||
        svcLower.includes('logo') ||
        svcLower.includes('brand') ||
        svcLower.includes('photo') ||
        svcLower.includes('menu') ||
        svcLower.includes('ui') ||
        svcLower.includes('ux')
      ) {
        broadCategory = 'designer';
      } else if (
        svcLower.includes('market') ||
        svcLower.includes('social') ||
        svcLower.includes('seo') ||
        svcLower.includes('ad') ||
        svcLower.includes('campaign') ||
        svcLower.includes('growth')
      ) {
        broadCategory = 'marketer';
      }

      // Try Explainable AI Matching
      let matchedFreelancer: any = null;
      let matchScore: number | undefined;
      let matchScoreBreakdown: any | undefined;
      let matchReasons: string[] | undefined;

      try {
        const matchRes = await aiClient.matchFreelancers({
          service_category: wp.service_category,
          required_skills: wp.required_skills || [],
          brief: wp.description,
          budget: allocatedPrice,
          max_delivery_days: wp.estimated_days,
          limit: 1,
        });

        if (matchRes && Array.isArray(matchRes.matches) && matchRes.matches.length > 0) {
          const topMatch = matchRes.matches[0];
          matchScore = topMatch.score;
          matchScoreBreakdown = topMatch.score_breakdown;
          matchReasons = topMatch.reasons;

          // Lookup real MongoDB Atlas freelancer profile
          const flUser = await UserModel.findOne({
            $or: [
              { email: topMatch.freelancer?.email?.toLowerCase() },
              { _id: topMatch.freelancer?.id },
            ],
          }).lean();

          matchedFreelancer = {
            id: (flUser as any)?._id?.toString() || topMatch.freelancer?.id || 'fl-user',
            name: flUser?.name || topMatch.freelancer?.name || 'Specialist',
            email: flUser?.email || topMatch.freelancer?.email,
            bio: flUser?.bio || topMatch.freelancer?.bio,
            skills: flUser?.skills?.length ? flUser.skills : wp.required_skills,
            rating: flUser?.rating != null ? flUser.rating : topMatch.freelancer?.rating,
            completedProjects: flUser?.completedProjects != null ? flUser.completedProjects : topMatch.freelancer?.completedProjects,
            pastProjects: flUser?.pastProjects || topMatch.freelancer?.pastProjects || [],
            yearsOfExperience: flUser?.yearsOfExperience || topMatch.freelancer?.yearsOfExperience || 3,
            hourlyRate: flUser?.hourlyRate || topMatch.freelancer?.hourlyRate,
            location: flUser?.location || topMatch.freelancer?.location || 'Remote',
          };
        }
      } catch (matchErr) {
        console.warn('[Scoping Finalize] Matching error for package:', wp.name, matchErr);
      }

      // Converted package (leave unassigned if no match found - strictly NO fake mock defaults)
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
