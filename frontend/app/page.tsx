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
  ChevronDown,
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
    <div className="flex flex-col w-full">
      {/* Fullscreen Hero Section with Graduated Transparent Background Image */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center overflow-hidden px-4 sm:px-6 lg:px-8 w-full">
        {/* Background Layer with Right-Side Visibility (~20%) & Multi-Stop Fade to Transparency */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
          {/* Base Background Image with CSS Mask for Right 20-25% Visibility and Smooth Fade */}
          <div
            className="absolute inset-0 bg-no-repeat bg-cover bg-right"
            style={{
              backgroundImage: "url('/hero-bg.png')",
              maskImage:
                'linear-gradient(to left, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.2) 28%, transparent 45%), linear-gradient(to bottom, rgba(0,0,0,1) 70%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to left, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.2) 28%, transparent 45%), linear-gradient(to bottom, rgba(0,0,0,1) 70%, transparent 100%)',
              WebkitMaskComposite: 'destination-in',
              maskComposite: 'intersect',
            }}
          />

          {/* Left-to-Right Color Overlay to Guarantee 100% Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F0F8F6] via-[#F0F8F6]/90 via-40% to-transparent dark:from-[#102B2B] dark:via-[#102B2B]/90 dark:via-40% dark:to-transparent" />

          {/* Bottom Fade: image smoothly goes away as the user scrolls into the next section */}
          <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-[#F0F8F6] via-[#F0F8F6]/70 to-transparent dark:from-[#102B2B] dark:via-[#102B2B]/70 dark:to-transparent" />

          {/* Subtle Ambient Radial Highlight on the Right */}
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-gradient-to-l from-[#168C80]/15 via-[#32B6A5]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Hero Content (Positioned in relative z-10) */}
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 py-16 sm:py-24">

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-[1.08]">
            Hire an entire freelance team with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#168C80] via-[#32B6A5] to-[#73D8C7]">
              one prompt
            </span>.
          </h1>

          {/* Concise Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Skip searching, negotiating, and paying multiple freelancers separately. Enter your project goal and total budget. Gigsaw disassembles the work, pairs verified talent, and coordinates everything through a single PayPal checkout.
          </p>

          {/* 2 Primary Clear Options: 'Hire Freelancers' and 'Find Work' */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/login?tab=register&role=merchant"
              className="w-full sm:w-auto px-8 py-4 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white font-bold rounded-2xl text-sm shadow-glow-cyan transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Users className="w-4 h-4" />
              <span>Hire Freelancers</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>

            <Link
              href="/login?tab=register&role=freelancer"
              className="w-full sm:w-auto px-8 py-4 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-sm border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Find Work as a Specialist</span>
            </Link>
          </div>
        </div>

        {/* Scroll Down Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 text-[11px] font-semibold tracking-wider uppercase animate-bounce pointer-events-none select-none">
          <span>Scroll to explore</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* Subsequent Sections with Spacing */}
      <div className="space-y-24 pb-20 pt-8">

      {/* How Gigsaw Works: 3 Simple Steps */}
      <section className="py-16 bg-white dark:bg-[#142F2E] border-y border-[#D8E9E4] dark:border-[#345451] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Execution Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              From one sentence to complete launch
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              How Gigsaw eliminates the friction of traditional freelance platforms.
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
              <div className="w-9 h-9 rounded-xl bg-[#168C80] text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
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
    </div>
  );
}
