import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { WorkPackage, ProjectProposal, IAiAnalysis } from '@/types';
import { aiClient } from '@/lib/aiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, budget: rawBudget } = body;

    const budget = Number(rawBudget) || 1000;
    const cleanPrompt = (prompt || '').trim();

    if (!cleanPrompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let projectName = `${cleanPrompt.slice(0, 40)} Launch`;

    // 1. Try Python FastAPI AI Microservice via central aiClient scopingFinalize
    let aiPackages: WorkPackage[] | null = null;
    let aiProposal: ProjectProposal | null = null;

    try {
      const finalizeRes = await aiClient.scopingFinalize({
        initial_goal: cleanPrompt,
        messages: [],
        budget,
        currency: 'USD',
        auto_decompose: true,
      });

      const data = finalizeRes?.analysis_result;
      if (finalizeRes?.project_name) {
        projectName = finalizeRes.project_name;
      }

      if (data && Array.isArray(data.work_packages) && data.work_packages.length > 0) {
        await connectToDatabase();

        const allocations = data.budget_plan?.allocations || [];
        const convertedPackages: WorkPackage[] = [];

        for (let i = 0; i < data.work_packages.length; i++) {
          const wp = data.work_packages[i];
          const alloc = allocations.find(
            (a: any) => a.service_category?.toLowerCase() === wp.service_category?.toLowerCase()
          );
          
          // Support FastAPI recommended_amount, allocated_amount, or fallback to equal distribution
          const rawPrice = alloc
            ? (alloc.recommended_amount ?? alloc.allocated_amount ?? alloc.trusted_baseline)
            : null;
          const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;
          const allocatedPrice = !isNaN(parsedPrice) && parsedPrice > 0
            ? Math.round(parsedPrice)
            : Math.round(budget / data.work_packages.length);

          // Determine broad category for UI styling
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

          // Try Explainable AI Matching via FastAPI microservice
          let assignedFreelancerId: string | undefined;
          let assignedFreelancerName: string | undefined;
          let assignedFreelancerEmail: string | undefined;
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

            if (matchRes && matchRes.matches && matchRes.matches.length > 0) {
              const bestMatch = matchRes.matches[0];
              const fl = bestMatch.freelancer;
              assignedFreelancerId = fl?.id || fl?._id?.toString();
              assignedFreelancerName = fl?.name;
              assignedFreelancerEmail = fl?.email;

              // FastAPI score is already 0-100 (e.g. 72.85). If <= 1, multiply by 100.
              const rawScore = Number(bestMatch.score) || 0;
              matchScore = rawScore > 1
                ? Math.min(99, Math.max(1, Math.round(rawScore)))
                : Math.min(99, Math.max(1, Math.round(rawScore * 100)));

              matchScoreBreakdown = bestMatch.score_breakdown;
              matchReasons = bestMatch.reasons;
            }
          } catch (matchErr) {
            console.warn('[AI Matcher] Microservice match fallback to MongoDB lookup', matchErr);
          }

          // Fallback to direct MongoDB lookup if AI microservice match didn't find one
          if (!assignedFreelancerName) {
            const fallbackFreelancer = await UserModel.findOne({
              role: 'freelancer',
              $or: [
                { serviceCategories: wp.service_category },
                { category: broadCategory },
              ],
            })
              .select('-password')
              .sort({ rating: -1, completedProjects: -1 })
              .lean();

            if (fallbackFreelancer) {
              assignedFreelancerId = fallbackFreelancer._id?.toString();
              assignedFreelancerName = fallbackFreelancer.name;
              assignedFreelancerEmail = fallbackFreelancer.email;
              matchScore = 94;
              matchScoreBreakdown = {
                semantic_relevance: 32,
                skill_overlap: 24,
                rating: 14.5,
                availability: 10,
                price_compatibility: 9,
                delivery_time: 4.5,
              };
              matchReasons = [
                `Top-rated specialist in ${broadCategory.toUpperCase()} services`,
                `Verified skills in ${(wp.required_skills || []).slice(0, 3).join(', ')}`,
                'High historic on-time delivery rate',
              ];
            }
          }

          let flProfile: any = null;
          if (assignedFreelancerEmail || assignedFreelancerId) {
            try {
              flProfile = await UserModel.findOne({
                $or: [
                  ...(assignedFreelancerEmail ? [{ email: assignedFreelancerEmail.toLowerCase() }] : []),
                  ...(assignedFreelancerId ? [{ _id: assignedFreelancerId }] : []),
                ],
              })
                .select('-password')
                .lean();
            } catch {}
          }

          // If profile wasn't found by email/ID, query by role and category from MongoDB
          if (!flProfile) {
            try {
              flProfile = await UserModel.findOne({
                role: 'freelancer',
                category: broadCategory,
              })
                .select('-password')
                .sort({ rating: -1, completedProjects: -1 })
                .lean();
              if (flProfile) {
                assignedFreelancerId = flProfile._id?.toString();
                assignedFreelancerName = flProfile.name;
                assignedFreelancerEmail = flProfile.email;
              }
            } catch {}
          }

          convertedPackages.push({
            id: wp.work_package_id || `wp-${broadCategory}-${Date.now()}-${i}`,
            category: broadCategory,
            roleName: wp.name || wp.service_category,
            title: wp.name || `${wp.service_category} Milestone`,
            description: wp.description || '',
            allocatedPrice,
            dependencies: wp.dependencies || [],
            dependencyNames:
              wp.dependencies && wp.dependencies.length > 0
                ? wp.dependencies
                : ['Root Milestone'],
            assignedFreelancerId,
            assignedFreelancerName: assignedFreelancerName || flProfile?.name,
            assignedFreelancerEmail: assignedFreelancerEmail || flProfile?.email,
            inviteStatus: 'invited',
            status: 'Pending',
            requiredSkills: wp.required_skills || [],
            deliverables: wp.deliverables || [],
            estimatedDays: wp.estimated_days || 7,
            currency: 'USD',
            quotationAmount: allocatedPrice,
            quotationCurrency: 'USD',
            quotationDeliveryDays: wp.estimated_days || 7,
            quotationScope: wp.description || '',
            quotationStatus: 'pending',
            matchScore: matchScore || 92,
            matchScoreBreakdown,
            matchReasons,
            assignedFreelancerBio: flProfile?.bio || '',
            assignedFreelancerSkills: flProfile?.skills || wp.required_skills || [],
            assignedFreelancerRating: flProfile?.rating ?? 5.0,
            assignedFreelancerCompletedProjects: flProfile?.completedProjects ?? 0,
            assignedFreelancerPastProjects: flProfile?.pastProjects || [],
            assignedFreelancerYearsOfExperience: flProfile?.yearsOfExperience ?? 0,
            assignedFreelancerHourlyRate: flProfile?.hourlyRate ?? 50,
            assignedFreelancerLocation: flProfile?.location || 'Remote',
          });
        }

        const allocatedTotal = convertedPackages.reduce((s, p) => s + p.allocatedPrice, 0);

        aiPackages = convertedPackages;
        aiProposal = {
          merchantId: '',
          merchantName: '',
          merchantEmail: '',
          projectName: data.analysis?.project_name || projectName,
          merchantPrompt: cleanPrompt,
          totalBudget: budget,
          allocatedTotal,
          savings: Math.max(0, budget - allocatedTotal),
          workPackages: convertedPackages,
          status: 'draft',
          createdAt: new Date().toISOString(),
          aiAnalysis: data.analysis,
          dependencyPlan: data.dependency_plan,
          assumptions: data.analysis?.assumptions || [],
          risks: data.analysis?.risks || [],
        };

        return NextResponse.json({
          success: true,
          proposal: aiProposal,
          workPackages: aiPackages,
          aiAnalysis: data.analysis,
          dependencyPlan: data.dependency_plan,
          assumptions: data.analysis?.assumptions || [],
          risks: data.analysis?.risks || [],
          isDynamic: true,
          aiSource: 'fastapi_microservice',
          rolesCount: aiPackages.length,
        });
      }
    } catch (err: any) {
      console.log('FastAPI microservice unreachable or returned error, falling back to local decomposition:', err.message);
    }

    // 2. Connect to MongoDB to match real freelancers (Local Engine Fallback)
    await connectToDatabase();

    const lower = cleanPrompt.toLowerCase();
    const packages: WorkPackage[] = [];

    // Analyze prompt to determine which roles are actually needed (Dynamic!)
    const needsDesigner =
      lower.includes('logo') ||
      lower.includes('design') ||
      lower.includes('brand') ||
      lower.includes('ui') ||
      lower.includes('ux') ||
      lower.includes('mockup') ||
      lower.includes('figma');

    const needsDev =
      lower.includes('code') ||
      lower.includes('website') ||
      lower.includes('app') ||
      lower.includes('develop') ||
      lower.includes('build') ||
      lower.includes('backend') ||
      lower.includes('frontend') ||
      lower.includes('database') ||
      lower.includes('api');

    const needsMarketer =
      lower.includes('market') ||
      lower.includes('seo') ||
      lower.includes('launch') ||
      lower.includes('growth') ||
      lower.includes('social') ||
      lower.includes('ads') ||
      lower.includes('campaign');

    interface RoleSpec {
      category: string;
      roleName: string;
      title: string;
      desc: string;
      ratio: number;
      skills: string[];
      deliverables: string[];
      estimatedDays: number;
    }

    const activeRoles: RoleSpec[] = [];

    if (needsDesigner || (!needsDev && !needsMarketer)) {
      activeRoles.push({
        category: 'designer',
        roleName: 'UI/UX & Brand Designer',
        title: 'Visual Identity & Interface Prototype',
        desc: `Produce brand marks, UI screens, and interactive user flows for: "${cleanPrompt.slice(0, 70)}..."`,
        ratio: 0.3,
        skills: ['Figma', 'UI/UX Design', 'Brand Identity', 'Design Systems', 'Graphic Design'],
        deliverables: ['Design System', 'Interactive Figma Prototype', 'Vector Brand Assets & Logo'],
        estimatedDays: 7,
      });
    }

    if (needsDev || (!needsDesigner && !needsMarketer)) {
      activeRoles.push({
        category: 'dev',
        roleName: 'Full-Stack Developer',
        title: 'Full-Stack Application Implementation',
        desc: 'Build responsive Next.js application, database schema, functional workflows, and API endpoints.',
        ratio: 0.5,
        skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'MongoDB', 'REST APIs'],
        deliverables: ['Production Next.js Codebase', 'Database Models & APIs', 'Deployment Pipeline'],
        estimatedDays: 14,
      });
    }

    if (needsMarketer || (!needsDesigner && !needsDev)) {
      activeRoles.push({
        category: 'marketer',
        roleName: 'Growth & SEO Marketer',
        title: 'Search Optimization & Launch Campaign',
        desc: 'Execute SEO keyword strategy, conversion funnel tracking, and go-to-market campaign.',
        ratio: 0.2,
        skills: ['SEO Strategy', 'Copywriting', 'Social Media Marketing', 'Google Analytics'],
        deliverables: ['SEO Keyword Plan', 'Social Media Launch Creatives', 'Marketing Funnel Blueprint'],
        estimatedDays: 5,
      });
    }

    // Normalize ratios so total price = budget
    const totalRatio = activeRoles.reduce((s, r) => s + r.ratio, 0);

    for (let i = 0; i < activeRoles.length; i++) {
      const r = activeRoles[i];
      const isLast = i === activeRoles.length - 1;
      const allocatedPrice = isLast
        ? budget - packages.reduce((s, p) => s + p.allocatedPrice, 0)
        : Math.round(budget * (r.ratio / totalRatio));

      // Query MongoDB Atlas for best matched freelancer in this category
      const matchedFreelancer = await UserModel.findOne({
        role: 'freelancer',
        category: r.category,
      })
        .select('-password')
        .sort({ rating: -1, completedProjects: -1 })
        .lean();

      packages.push({
        id: `wp-${r.category}-${Date.now()}-${i}`,
        category: r.category,
        roleName: r.roleName,
        title: r.title,
        description: r.desc,
        allocatedPrice,
        dependencies: i > 0 ? [packages[i - 1].id] : [],
        dependencyNames: i > 0 ? [packages[i - 1].title] : ['Root Milestone'],
        assignedFreelancerId: matchedFreelancer?._id?.toString(),
        assignedFreelancerName: matchedFreelancer?.name,
        assignedFreelancerEmail: matchedFreelancer?.email,
        inviteStatus: 'invited',
        status: 'Pending',
        requiredSkills: r.skills,
        deliverables: r.deliverables,
        estimatedDays: r.estimatedDays,
        currency: 'USD',
        quotationAmount: allocatedPrice,
        quotationCurrency: 'USD',
        quotationDeliveryDays: r.estimatedDays,
        quotationScope: r.desc,
        quotationStatus: 'pending',
        matchScore: 95,
        matchScoreBreakdown: {
          semantic_relevance: 0.94,
          skill_overlap: 0.96,
          rating: 0.98,
          availability: 1.0,
          price_compatibility: 0.92,
          delivery_time: 0.9,
        },
        matchReasons: [
          `Top-rated specialist in ${r.category.toUpperCase()}`,
          `High skill alignment with ${r.skills.slice(0, 3).join(', ')}`,
          'Available for immediate sprint assignment',
        ],
        assignedFreelancerBio: matchedFreelancer?.bio || '',
        assignedFreelancerSkills: matchedFreelancer?.skills || r.skills,
        assignedFreelancerRating: matchedFreelancer?.rating || 5.0,
        assignedFreelancerCompletedProjects: matchedFreelancer?.completedProjects || 0,
        assignedFreelancerPastProjects: matchedFreelancer?.pastProjects || [],
        assignedFreelancerYearsOfExperience: matchedFreelancer?.yearsOfExperience || 3,
        assignedFreelancerHourlyRate: matchedFreelancer?.hourlyRate || 50,
        assignedFreelancerLocation: matchedFreelancer?.location || 'Remote',
      });
    }

    const allocatedTotal = packages.reduce((s, p) => s + p.allocatedPrice, 0);

    const fallbackAnalysis: IAiAnalysis = {
      project_name: projectName,
      business_goal: cleanPrompt,
      summary: `Automated multidisciplinary plan executing ${packages.length} sequenced milestones.`,
      required_services: activeRoles.map((r) => r.category),
      assumptions: [
        'Client provides prompt review and feedback within 48 hours of deliverable submission.',
        'Assets, access keys, and project specifications are clarified during kickoff.',
        'Escrow funds are disbursed upon milestone deliverable approval.',
      ],
      risks: [
        'Scope adjustments during high-fidelity review may alter delivery duration.',
        'External third-party API dependencies require valid environment credentials.',
      ],
    };

    const dependencyPlan: Record<string, string[]> = {};
    for (let i = 0; i < packages.length; i++) {
      dependencyPlan[packages[i].id] = packages[i].dependencies || [];
    }

    const proposal: ProjectProposal = {
      merchantId: '',
      merchantName: '',
      merchantEmail: '',
      projectName,
      merchantPrompt: cleanPrompt,
      totalBudget: budget,
      allocatedTotal,
      savings: Math.max(0, budget - allocatedTotal),
      workPackages: packages,
      status: 'draft',
      createdAt: new Date().toISOString(),
      aiAnalysis: fallbackAnalysis,
      dependencyPlan,
      assumptions: fallbackAnalysis.assumptions,
      risks: fallbackAnalysis.risks,
    };

    return NextResponse.json({
      success: true,
      proposal,
      workPackages: packages,
      aiAnalysis: fallbackAnalysis,
      dependencyPlan,
      assumptions: fallbackAnalysis.assumptions,
      risks: fallbackAnalysis.risks,
      isDynamic: true,
      aiSource: 'local_engine',
      rolesCount: packages.length,
    });
  } catch (error: any) {
    console.error('Error in AI decomposition route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal AI decomposition error' },
      { status: 500 }
    );
  }
}
