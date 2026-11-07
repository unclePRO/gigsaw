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

    // 1. Try Teammate's Python FastAPI AI Microservice if configured
    const microserviceUrl = process.env.NEXT_PUBLIC_AI_MICROSERVICE_URL;
    if (microserviceUrl && microserviceUrl !== 'http://localhost:8000') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${microserviceUrl}/api/decompose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: cleanPrompt, budget }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.workPackages)) {
            return NextResponse.json(data);
          }
        }
      } catch (err: any) {
        console.log('Teammate Python AI microservice not reachable, using dynamic local decomposition.');
      }
    }

    // 2. Connect to MongoDB to match real freelancers
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

    // Default to at least what's mentioned, or all 3 if broad general prompt
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
        // AI Integration Fields
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

    const words = cleanPrompt.split(' ').slice(0, 5).join(' ');
    const projectName =
      words.length > 0
        ? `${words.charAt(0).toUpperCase() + words.slice(1)} Project`
        : 'New Launch Project';

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
