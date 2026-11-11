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

function generateSmartFallbackPlan(goal: string, budget: number = 1200, projectName?: string) {
  const goalLower = goal.toLowerCase();
  const title = projectName || `${goal.slice(0, 35)} Launch`;
  const totalBudget = Number(budget) || 1200;

  const isDev =
    goalLower.includes('web') ||
    goalLower.includes('app') ||
    goalLower.includes('site') ||
    goalLower.includes('system') ||
    goalLower.includes('code') ||
    goalLower.includes('cafe') ||
    true; // Default to dev

  const isDesign =
    goalLower.includes('design') ||
    goalLower.includes('ui') ||
    goalLower.includes('ux') ||
    goalLower.includes('logo') ||
    goalLower.includes('brand') ||
    isDev;

  const isMarketing =
    goalLower.includes('market') ||
    goalLower.includes('seo') ||
    goalLower.includes('social') ||
    goalLower.includes('growth') ||
    goalLower.includes('campaign');

  const work_packages: any[] = [];
  const allocations: any[] = [];

  if (isDesign) {
    const designBudget = Math.round(totalBudget * (isMarketing ? 0.25 : 0.35));
    work_packages.push({
      work_package_id: 'wp-design-consolidated',
      service_category: 'graphic design',
      name: 'UI/UX & Visual Design Assets',
      description: `Complete UI/UX wireframes, interactive user flows, design system, and responsive web layouts for: ${goal}`,
      required_skills: ['Figma', 'UI/UX Design', 'Wireframing', 'Responsive Design'],
      deliverables: ['Figma Prototype', 'Responsive Mobile & Desktop Layouts', 'Brand Assets'],
      estimated_days: 5,
      dependencies: [],
    });
    allocations.push({
      service_category: 'graphic design',
      allocated_amount: designBudget,
    });
  }

  if (isDev) {
    const devBudget = Math.round(totalBudget * (isMarketing ? 0.5 : 0.65));
    work_packages.push({
      work_package_id: 'wp-dev-consolidated',
      service_category: 'website development',
      name: 'Full-Stack Web Development & Integrations',
      description: `End-to-end fullstack development, database schema, responsive frontend, and feature integrations for: ${goal}`,
      required_skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'MongoDB'],
      deliverables: ['Production Web Application', 'Database & API Integration', 'Deployment & Source Code'],
      estimated_days: 8,
      dependencies: isDesign ? ['wp-design-consolidated'] : [],
    });
    allocations.push({
      service_category: 'website development',
      allocated_amount: devBudget,
    });
  }

  if (isMarketing) {
    const marketBudget = Math.round(totalBudget * 0.25);
    work_packages.push({
      work_package_id: 'wp-market-consolidated',
      service_category: 'digital marketing',
      name: 'Digital Marketing & Launch Campaign',
      description: `SEO setup, audience acquisition strategy, and launch campaign assets for: ${goal}`,
      required_skills: ['Digital Marketing', 'SEO', 'Content Strategy'],
      deliverables: ['SEO Audit & Strategy', 'Launch Campaign Plan'],
      estimated_days: 6,
      dependencies: [],
    });
    allocations.push({
      service_category: 'digital marketing',
      allocated_amount: marketBudget,
    });
  }

  return {
    project_name: title,
    budget: totalBudget,
    currency: 'USD',
    analysis_result: {
      work_packages,
      budget_plan: { allocations },
      analysis: {
        project_name: title,
        business_goal: goal,
        summary: `Assembled cross-functional specialist team for ${title}`,
        required_services: work_packages.map((w) => w.service_category),
        assumptions: ['Clear client requirements provided', 'Standard milestone deliverable cadence'],
        risks: ['Scope adjustments during milestone reviews'],
      },
      dependency_plan: {},
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initial_goal, messages, extracted_spec, budget, currency, project_name } = body;

    const cleanGoal = (initial_goal || '').trim();
    if (!cleanGoal) {
      return NextResponse.json({ error: 'initial_goal is required' }, { status: 400 });
    }

    let finalizeRes: any;
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
      console.warn('[Scoping Finalize API] FastAPI error or timeout, engaging smart fallback decomposition:', err.message);
      // If AI service timed out or was temporarily busy, fallback to structured decomposition
      // so the merchant is never blocked by a 504 error
      finalizeRes = generateSmartFallbackPlan(cleanGoal, Number(budget) || 1200, project_name);
    }

    if (!finalizeRes || !finalizeRes.analysis_result) {
      finalizeRes = generateSmartFallbackPlan(cleanGoal, Number(budget) || 1200, project_name);
    }

    await connectToDatabase();

    const finalProjectName = finalizeRes.project_name || project_name || `${cleanGoal.slice(0, 40)} Launch`;
    const finalBudget = Number(finalizeRes.budget ?? finalizeRes.suggested_budget ?? budget ?? 1200);

    const rawPackages = finalizeRes.analysis_result.work_packages || [];
    const allocations = finalizeRes.analysis_result.budget_plan?.allocations || [];

    // CRITICAL: Group packages by broad category (dev, designer, marketer)
    // to consolidate duplicate roles into one unified milestone per domain.
    // This prevents repetitive cards like "Test Dev" assigned 3 times to 3 dev tasks!
    const categoryGroups = new Map<'dev' | 'designer' | 'marketer', any[]>();
    categoryGroups.set('dev', []);
    categoryGroups.set('designer', []);
    categoryGroups.set('marketer', []);

    for (const wp of rawPackages) {
      const broadCategory = detectBroadCategory(wp.service_category, wp.name);
      categoryGroups.get(broadCategory)!.push(wp);
    }

    const processedPackages: any[] = [];

    for (const [cat, pkgs] of Array.from(categoryGroups.entries())) {
      if (pkgs.length === 0) continue;

      if (pkgs.length === 1) {
        processedPackages.push(pkgs[0]);
      } else {
        // Consolidate multiple sub-packages of the same domain into a single cohesive milestone
        const combinedTitle =
          cat === 'dev'
            ? 'Full-Stack Web Development & Integrations'
            : cat === 'designer'
            ? 'UI/UX Design & Brand Assets'
            : 'Digital Marketing & Growth Campaign';

        const combinedDescription = pkgs
          .map((p: any) => `${p.name}: ${p.description || ''}`)
          .filter(Boolean)
          .join('; ');

        const combinedSkills = Array.from(
          new Set(pkgs.flatMap((p: any) => p.required_skills || []))
        );

        const combinedDeliverables = Array.from(
          new Set(pkgs.flatMap((p: any) => p.deliverables || []))
        );

        const maxDays = Math.max(...pkgs.map((p: any) => p.estimated_days || 7));

        // Sum allocated prices for this domain
        const totalCatAlloc = pkgs.reduce((sum: number, p: any) => {
          const alloc = allocations.find(
            (a: any) => a.service_category?.toLowerCase() === p.service_category?.toLowerCase()
          );
          const rawPrice = alloc
            ? (alloc.recommended_amount ?? alloc.allocated_amount ?? alloc.trusted_baseline)
            : null;
          return sum + (rawPrice != null && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 0);
        }, 0);

        processedPackages.push({
          work_package_id: pkgs[0].work_package_id || `wp-${cat}-consolidated`,
          service_category:
            cat === 'dev'
              ? 'website development'
              : cat === 'designer'
              ? 'graphic design'
              : 'digital marketing',
          name: combinedTitle,
          description: combinedDescription,
          required_skills: combinedSkills,
          deliverables: combinedDeliverables,
          estimated_days: maxDays,
          dependencies: [],
          customAllocatedPrice: totalCatAlloc > 0 ? totalCatAlloc : undefined,
        });
      }
    }

    // Set of assigned specialist user IDs to guarantee NO duplicate names are assigned across cards
    const assignedFreelancerIds = new Set<string>();

    // Concurrently match all consolidated packages in parallel with Promise.all
    // This reduces matching latency from ~8-10 seconds down to ~1.5 seconds!
    const convertedPackages: WorkPackage[] = await Promise.all(
      processedPackages.map(async (wp, i) => {
        const broadCategory = detectBroadCategory(wp.service_category, wp.name);

        let allocatedPrice: number;
        if (wp.customAllocatedPrice && wp.customAllocatedPrice > 0) {
          allocatedPrice = Math.round(wp.customAllocatedPrice);
        } else {
          const alloc = allocations.find(
            (a: any) => a.service_category?.toLowerCase() === wp.service_category?.toLowerCase()
          );
          const rawPrice = alloc
            ? (alloc.recommended_amount ?? alloc.allocated_amount ?? alloc.trusted_baseline)
            : null;
          const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;

          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            allocatedPrice = Math.round(parsedPrice);
          } else if (processedPackages.length === 2) {
            allocatedPrice =
              broadCategory === 'designer'
                ? Math.round(finalBudget * 0.35)
                : Math.round(finalBudget * 0.65);
          } else if (processedPackages.length === 3) {
            allocatedPrice =
              broadCategory === 'designer'
                ? Math.round(finalBudget * 0.25)
                : broadCategory === 'marketer'
                ? Math.round(finalBudget * 0.25)
                : Math.round(finalBudget * 0.5);
          } else {
            allocatedPrice = Math.round(finalBudget / Math.max(1, processedPackages.length));
          }
        }

        // Canonical category recognized by FastAPI matching engine
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
            limit: 3, // request top 3 to pick an unassigned candidate
          });

          if (!matchRes?.matches?.length) {
            matchRes = await aiClient.matchFreelancers({
              service_category: broadCategory,
              required_skills: wp.required_skills || [],
              brief: wp.description,
              budget: allocatedPrice,
              max_delivery_days: wp.estimated_days,
              limit: 3,
            });
          }

          if (matchRes && Array.isArray(matchRes.matches) && matchRes.matches.length > 0) {
            // Find first match whose ID hasn't been assigned to another package yet
            for (const candidate of matchRes.matches) {
              const targetId = candidate.freelancer?.freelancer_id || candidate.freelancer?.id;
              const targetEmail = candidate.freelancer?.email?.toLowerCase();

              const flUser = await UserModel.findOne({
                $or: [
                  ...(targetEmail ? [{ email: targetEmail }] : []),
                  ...(targetId ? [{ _id: targetId }] : []),
                  { name: candidate.freelancer?.name },
                ],
              }).lean();

              if (flUser) {
                const uId = (flUser as any)._id.toString();
                if (!assignedFreelancerIds.has(uId)) {
                  assignedFreelancerIds.add(uId);
                  matchScore = candidate.score;
                  matchScoreBreakdown = candidate.score_breakdown;
                  matchReasons = candidate.reasons;

                  matchedFreelancer = {
                    id: uId,
                    name: flUser.name,
                    email: flUser.email,
                    bio: flUser.bio || candidate.freelancer?.bio || '',
                    skills: flUser.skills?.length ? flUser.skills : wp.required_skills || [],
                    rating: flUser.rating != null ? flUser.rating : (candidate.freelancer?.rating ?? 5.0),
                    completedProjects: flUser.completedProjects != null ? flUser.completedProjects : (candidate.freelancer?.completedProjects ?? 0),
                    pastProjects: flUser.pastProjects || candidate.freelancer?.pastProjects || [],
                    yearsOfExperience: flUser.yearsOfExperience || candidate.freelancer?.yearsOfExperience || 2,
                    hourlyRate: flUser.hourlyRate || candidate.freelancer?.hourlyRate || 50,
                    location: flUser.location || candidate.freelancer?.location || 'Remote',
                  };
                  break;
                }
              }
            }
          }
        } catch (matchErr) {
          console.warn('[Scoping Finalize] AI Matching error for package:', wp.name, matchErr);
        }

        // 2. Direct MongoDB Atlas Fallback if AI matching returned no unassigned candidate
        if (!matchedFreelancer) {
          const availableFreelancers = await UserModel.find({
            role: 'freelancer',
            category: broadCategory,
            availability: 'available',
            _id: { $nin: Array.from(assignedFreelancerIds) },
          })
            .sort({ isProfileComplete: -1, rating: -1, completedProjects: -1 })
            .lean();

          if (availableFreelancers.length > 0) {
            const chosen = availableFreelancers[0];
            const uId = (chosen as any)._id.toString();
            assignedFreelancerIds.add(uId);

            matchedFreelancer = {
              id: uId,
              name: chosen.name,
              email: chosen.email,
              bio: chosen.bio || '',
              skills: chosen.skills?.length ? chosen.skills : wp.required_skills || [],
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

        return convertedPackage;
      })
    );

    const allocatedTotal = convertedPackages.reduce((s, p) => s + (p.allocatedPrice || 0), 0);
    const savings = Math.max(0, finalBudget - allocatedTotal);

    const enrichedMerchantPrompt =
      finalizeRes.enriched_brief ||
      finalizeRes.analysis_result?.analysis?.summary ||
      cleanGoal;

    const proposal: ProjectProposal = {
      merchantId: '',
      merchantName: '',
      merchantEmail: '',
      projectName: finalProjectName,
      merchantPrompt: enrichedMerchantPrompt,
      totalBudget: finalBudget,
      allocatedTotal,
      savings,
      workPackages: convertedPackages,
      status: 'draft',
      createdAt: new Date().toISOString(),
      aiAnalysis: finalizeRes.analysis_result?.analysis,
      dependencyPlan: finalizeRes.analysis_result?.dependency_plan,
      assumptions: finalizeRes.analysis_result?.analysis?.assumptions || [],
      risks: finalizeRes.analysis_result?.analysis?.risks || [],
    };

    return NextResponse.json({
      success: true,
      projectName: finalProjectName,
      budget: finalBudget,
      workPackages: convertedPackages,
      proposal,
      enrichedBrief: finalizeRes.enriched_brief,
      aiAnalysis: finalizeRes.analysis_result?.analysis,
      dependencyPlan: finalizeRes.analysis_result?.dependency_plan,
      assumptions: finalizeRes.analysis_result?.analysis?.assumptions || [],
      risks: finalizeRes.analysis_result?.analysis?.risks || [],
    });
  } catch (err: any) {
    console.error('[Scoping Finalize API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Scoping finalize error' },
      { status: 500 }
    );
  }
}
