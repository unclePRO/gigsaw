'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Briefcase,
  Layers,
  ChevronRight,
  Star,
  Clock,
  DollarSign,
  Palette,
  Code2,
  TrendingUp,
} from 'lucide-react';
import MerchantDashboardPage from '@/app/dashboard/page';
import FreelancerDashboardPage from '@/app/freelancer/dashboard/page';

export default function HomePage() {
  const { data: session } = useSession();
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');

  // If logged in as Merchant, render the Project Dashboard directly
  if (session?.user && (session.user as any).role === 'merchant') {
    return <MerchantDashboardPage />;
  }

  // If logged in as Freelancer, render the Freelancer Workspace directly
  if (session?.user && (session.user as any).role === 'freelancer') {
    return <FreelancerDashboardPage />;
  }

  const popularPills = [
    'Web & App Development',
    'Brand Identity & Logo',
    'Digital Menu Design',
    'Food & Product Photography',
    'Growth & SEO Strategy',
    'Social Media Creatives',
  ];

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center space-y-8">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
          <span>Intelligent Project Decomposition & Escrow</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Hire an entire freelance team with{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
            one prompt & budget
          </span>.
        </h1>

        {/* Concise Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Skip searching, negotiating, and paying multiple freelancers separately. Enter your project goal and total budget. GigSaw decomposes the work, pairs verified talent, and coordinates everything through a single PayPal checkout.
        </p>

        {/* 2 Primary Clear Options: 'Hire Freelancers' and 'Find Work' */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/login?tab=register&role=merchant"
            className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-bold rounded-xl text-sm shadow-glow-cyan transition-all flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Hire Freelancers</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </Link>

          <Link
            href="/login?tab=register&role=freelancer"
            className="w-full sm:w-auto px-8 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Find Work as a Specialist</span>
          </Link>
        </div>

        {/* Quick popular category tags */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mr-1">Popular:</span>
          {popularPills.map((pill) => (
            <span
              key={pill}
              className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 transition-colors cursor-default"
            >
              {pill}
            </span>
          ))}
        </div>

        {/* Interactive Live Teaser Card: The Unified Proposal */}
        <div className="pt-10 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xl shadow-slate-200/40 dark:shadow-none text-left space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                    Live Demo Proposal
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Ready for Checkout
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Artisan Coffeehouse & Bakery Launch
                </h3>
              </div>
              <div className="sm:text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Budget Allocation</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">$1,800 USD</span>
              </div>
            </div>

            {/* 3 Sequenced Puzzle Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Designer Card */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 uppercase">
                    1. Designer
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">$450</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Brand & QR Menu Design</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    Logo marks, vector typography, color palette, and interactive digital menu.
                  </p>
                </div>
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Elena R.</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">96% Match</span>
                </div>
              </div>

              {/* Developer Card */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/60 uppercase">
                    2. Developer
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">$850</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Next.js Web Storefront</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    Responsive storefront, online ordering workflows, and MongoDB models.
                  </p>
                </div>
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Alex M.</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">98% Match</span>
                </div>
              </div>

              {/* Marketer Card */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 uppercase">
                    3. Marketer
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">$500</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Local SEO & Launch Ads</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    Google Business local ranking, Meta launch campaigns, and analytics funnel.
                  </p>
                </div>
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Marcus C.</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">94% Match</span>
                </div>
              </div>
            </div>

            {/* Bottom Proof Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Single consolidated checkout &bull; Split automatically via PayPal</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Zero individual invoices &bull; 100% Escrow Protection
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How GigSaw Works: 3 Simple Steps */}
      <section className="py-16 bg-white dark:bg-[#0B1120] border-y border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Execution Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              From one sentence to complete launch
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              How GigSaw eliminates the friction of traditional freelance platforms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-cyan-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Define Goal & Total Budget</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Describe what you want to achieve via text or voice. Enter your maximum budget ceiling in USD.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Assembles Your Team</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Our model maps tasks to required disciplines, checks dependencies, and pairs verified talent from MongoDB Atlas.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Pay Once & Track Progress</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Authorize once via PayPal. Funds stay protected until milestones are completed, reviewed, and approved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-navy-950 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready to bring your project to life?
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
            Join business owners launching complex ideas with AI teams, or join top specialists getting matched with high-budget milestones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login?tab=register&role=merchant"
              className="w-full sm:w-auto px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-xs shadow-glow-cyan transition-all"
            >
              Hire Freelancers as Merchant
            </Link>
            <Link
              href="/login?tab=register&role=freelancer"
              className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all"
            >
              Apply as a Specialist
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
