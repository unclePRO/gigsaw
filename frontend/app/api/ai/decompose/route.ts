import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { WorkPackage, ProjectProposal } from '@/types';

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

    const words = cleanPrompt.split(' ').slice(0, 5).join(' ');
    const projectName =
      words.length > 0
        ? `${words.charAt(0).toUpperCase() + words.slice(1)} Project`
        : 'New Launch Project';

    // 1. Try Teammate's Python FastAPI AI Microservice if reachable
    const microserviceUrl = process.env.NEXT_PUBLIC_AI_MICROSERVICE_URL || 'http://localhost:8001';
    let aiPackages: WorkPackage[] | null = null;
    let aiProposal: ProjectProposal | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${microserviceUrl}/api/v1/projects/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_request: cleanPrompt,
          budget: budget.toString(),
          currency: 'USD',
          project_name: projectName,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.work_packages) && data.work_packages.length > 0) {
          await connectToDatabase();

          const allocations = data.budget_plan?.allocations || [];
          const convertedPackages: WorkPackage[] = [];

          for (let i = 0; i < data.work_packages.length; i++) {
            const wp = data.work_packages[i];
            const alloc = allocations.find(
              (a: any) => a.service_category?.toLowerCase() === wp.service_category?.toLowerCase()
            );
            const allocatedPrice = alloc ? Math.round(Number(alloc.allocated_amount)) : Math.round(budget / data.work_packages.length);

            // Determine broad category for UI styling
            const svcLower = (wp.service_category || '').toLowerCase();
            let broadCategory: 'dev' | 'designer' | 'marketer' = 'dev';
            if (svcLower.includes('design') || svcLower.includes('logo') || svcLower.includes('brand') || svcLower.includes('photo') || svcLower.includes('menu')) {
              broadCategory = 'designer';
            } else if (svcLower.includes('market') || svcLower.includes('social') || svcLower.includes('seo')) {
              broadCategory = 'marketer';
            }

            // Match suitable freelancer from MongoDB
            const matchedFreelancer = await UserModel.findOne({
              role: 'freelancer',
              $or: [
                { serviceCategories: wp.service_category },
                { category: broadCategory },
              ],
            })
              .select('-password')
              .sort({ rating: -1, completedProjects: -1 })
              .lean();

            convertedPackages.push({
              id: wp.work_package_id || `wp-${broadCategory}-${Date.now()}-${i}`,
              category: broadCategory,
              roleName: wp.name || wp.service_category,
              title: wp.name || `${wp.service_category} Milestone`,
              description: wp.description || '',
              allocatedPrice,
              dependencies: wp.dependencies || [],
              dependencyNames: wp.dependencies && wp.dependencies.length > 0 ? wp.dependencies : ['Root Milestone'],
              assignedFreelancerId: matchedFreelancer?._id?.toString(),
              assignedFreelancerName: matchedFreelancer?.name,
              assignedFreelancerEmail: matchedFreelancer?.email,
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
          };

          return NextResponse.json({
            success: true,
            proposal: aiProposal,
            workPackages: aiPackages,
            isDynamic: true,
            aiSource: 'fastapi_microservice',
            rolesCount: aiPackages.length,
          });
        }
      }
    } catch (err: any) {
      console.log('Teammate FastAPI microservice not running on port 8001, falling back to local decomposition.');
    }

    // 2. Connect to MongoDB to match real freelancers (Local Fallback)
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
      });
    }

    const allocatedTotal = packages.reduce((s, p) => s + p.allocatedPrice, 0);

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
    };

    return NextResponse.json({
      success: true,
      proposal,
      workPackages: packages,
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
