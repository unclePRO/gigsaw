'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  ArrowRight,
  Palette,
  Code2,
  TrendingUp,
  Briefcase,
  Users,
} from 'lucide-react';
import MerchantDashboardPage from '@/app/dashboard/page';
import FreelancerDashboardPage from '@/app/freelancer/dashboard/page';

export default function HomePage() {
  const { data: session, status } = useSession();

  // If logged in as Merchant, render the Project Dashboard directly!
  if (session?.user && (session.user as any).role === 'merchant') {
    return <MerchantDashboardPage />;
  }

  // If logged in as Freelancer, render the Freelancer Workspace directly!
  if (session?.user && (session.user as any).role === 'freelancer') {
    return <FreelancerDashboardPage />;
  }

  // If not logged in, render the clean landing page with 'Hire Freelancers' and 'Find Work'
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
          <span>AI Project Decomposition & Freelancer Matching</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Launch your entire project with{' '}
          <span className="text-cyan-600">one prompt & budget</span>.
        </h1>

        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Stop vetting and managing separate freelancers. Enter your goal and budget. GigSaw decomposes it into 3 key categories: <strong>Designer</strong>, <strong>Developer</strong>, and <strong>Marketer</strong>, allocates your budget, and coordinates checkout and milestones.
        </p>

        {/* 2 Primary Options: 'Hire Freelancers' and 'Find Work' */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
          <Link
            href="/login?tab=register&role=merchant"
            className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-base shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Hire Freelancers</span>
          </Link>

          <Link
            href="/login?tab=register&role=freelancer"
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl text-base transition-all flex items-center justify-center gap-2"
          >
            <Briefcase className="w-4 h-4 text-cyan-600" />
            <span>Find Work</span>
          </Link>
        </div>

        {/* 3 Categories Visual Preview */}
        <div className="pt-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <span className="text-xs font-bold text-cyan-600 uppercase tracking-wide">
                  Project Decomposition Model
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  3 Sequenced Milestone Categories
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Single Authorization</span>
                <span className="text-sm font-extrabold text-emerald-600">Unified Escrow</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Palette className="w-4 h-4 text-royal-600" />
                  <span>1. Designer</span>
                </div>
                <p className="text-xs text-slate-500">
                  Visual branding, design tokens, UI layouts, and Figma user mockups.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Code2 className="w-4 h-4 text-cyan-600" />
                  <span>2. Developer</span>
                </div>
                <p className="text-xs text-slate-500">
                  Full-Stack Next.js implementation, database schema, and live API integrations.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>3. Marketer</span>
                </div>
                <p className="text-xs text-slate-500">
                  SEO optimization, go-to-market launch strategy, and conversion funnel analytics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">How GigSaw Works</h2>
            <p className="text-slate-500 text-sm">
              Simple 3-step project execution backed by MongoDB Atlas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 font-extrabold flex items-center justify-center text-base">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900">Define Your Goal</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter your project prompt and total budget limit via text or voice.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-800 font-extrabold flex items-center justify-center text-base">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900">Decompose into 3 Categories</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tasks are mapped to Designer, Developer, and Marketer with automatic budget distribution.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-base">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900">Pay Once & Track in AG Grid</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Approve quotation with PayPal checkout. Track milestones and review deliverables on your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-10 space-y-4">
          <h2 className="text-2xl font-bold">Ready to get started?</h2>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Choose whether you are a business owner looking to hire or a specialist looking for projects.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login?tab=register&role=merchant"
              className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Hire Freelancers
            </Link>
            <Link
              href="/login?tab=register&role=freelancer"
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
            >
              Find Work as Freelancer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
