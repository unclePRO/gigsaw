'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  Mic,
  MicOff,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  UserCheck,
  UserX,
  Layers,
  Star,
  ShieldCheck,
  Zap,
  Code2,
  Palette,
  TrendingUp,
  Clock,
  Tag,
} from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useProjectStore } from '@/store/useProjectStore';
import { WorkPackage } from '@/types';

export default function CreateProjectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const {
    prompt,
    setPrompt,
    budget,
    setBudget,
    currentStep,
    setCurrentStep,
    isAnalyzing,
    setAnalyzing,
    workPackages,
    setWorkPackages,
    proposal,
    resetDraft,
  } = useProjectStore();

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Quick Starter Prompts
  const starterPrompts = [
    {
      title: 'Artisan Cafe & Bakery Launch',
      prompt: 'Open a modern specialty coffeehouse with brand logo, interactive QR digital menu, food photography, Next.js web application, and a local social media launch campaign.',
      budget: 1800,
    },
    {
      title: 'SaaS Startup Web App & Branding',
      prompt: 'Build a production-ready B2B SaaS web app with high-converting landing page, responsive dashboard, Stripe/PayPal billing integration, design tokens, and organic SEO architecture.',
      budget: 2500,
    },
    {
      title: 'E-commerce Brand & Growth Funnel',
      prompt: 'Launch an eco-friendly apparel ecommerce store with custom vector branding, modern storefront, product mockups, and high-ROI Meta & Google ad campaign blueprints.',
      budget: 2000,
    },
  ];

  const budgetPresets = [500, 1000, 1800, 2500, 5000];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/create');
    }
  }, [status, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-500" />
        <span>Loading workspace...</span>
      </div>
    );
  }

  // Block freelancers from creating projects
  if (session?.user && (session.user as any).role === 'freelancer') {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 mt-12 shadow-sm">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Merchant Only Feature</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Freelancers cannot launch projects. Projects are created by merchants, and our matching engine pairs specialists automatically based on specialty and verified ratings.
        </p>
        <button
          onClick={() => router.push('/freelancer/dashboard')}
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          Go to Freelancer Workspace
        </button>
      </div>
    );
  }

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(prompt ? `${prompt} ${transcript}` : transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleDecompose = async () => {
    if (!prompt.trim()) return;

    setAnalyzing(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/ai/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, budget }),
      });

      const data = await res.json();
      if (data.success && data.workPackages) {
        setWorkPackages(data.workPackages);
        setCurrentStep(2);
      } else {
        setSaveError(data.error || 'Failed to decompose project.');
      }
    } catch (err: any) {
      console.error('Decompose error:', err);
      setSaveError(err.message || 'Network error during decomposition.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAndCheckout = async (orderId: string) => {
    setIsSavingProject(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: proposal?.projectName || 'New Launch Project',
          merchantPrompt: prompt,
          totalBudget: budget,
          allocatedTotal: workPackages.reduce((s, w) => s + w.allocatedPrice, 0),
          savings: Math.max(0, budget - workPackages.reduce((s, w) => s + w.allocatedPrice, 0)),
          workPackages,
          paypalOrderId: orderId,
          merchantId: (session?.user as any)?.id,
          merchantName: session?.user?.name || 'Merchant',
          merchantEmail: session?.user?.email || 'merchant@example.com',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save project to MongoDB');
      }

      resetDraft();
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Save project error:', err);
      setSaveError(err.message || 'Error saving project to database.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const allocatedTotal = workPackages.reduce((sum, wp) => sum + (wp.allocatedPrice || 0), 0);
  const savings = Math.max(0, budget - allocatedTotal);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Sleek Header & Stepper */}
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
              Project Studio
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Escrow Powered
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
            Launch Your Project
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define one goal. Assemble a multidisciplinary team with unified PayPal checkout.
          </p>
        </div>

        {/* Stepper pills */}
        <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
          {[
            { num: 1, label: 'Goal & Budget' },
            { num: 2, label: 'Team Breakdown' },
            { num: 3, label: 'Unified Checkout' },
          ].map((step, idx) => (
            <React.Fragment key={step.num}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  currentStep === step.num
                    ? 'bg-slate-900 dark:bg-cyan-500 text-white font-bold shadow-sm'
                    : currentStep > step.num
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500'
                }`}
              >
                <span>{currentStep > step.num ? '✓' : `0${step.num}`}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {idx < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{saveError}</span>
        </div>
      )}

      {/* STEP 1: REQUIREMENT INPUT */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Main Prompt Card */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="prompt-input" className="text-sm font-bold text-slate-900 dark:text-white block">
                  What would you like to build or launch?
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Type your project requirements in plain natural language or speak them.
                </p>
              </div>

              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-cyan-500" />}
                  <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <textarea
                id="prompt-input"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Launch an artisanal coffee shop: design a modern vector logo mark and brand guidelines, build a responsive Next.js web application with a digital QR menu, shoot food photography, and run a local launch marketing campaign..."
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed transition-colors"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Natural language requirement decomposition</span>
                <span>{prompt.length} characters</span>
              </div>
            </div>

            {/* Quick Starter Inspiration Chips */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Quick Project Templates:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {starterPrompts.map((st, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(st.prompt);
                      setBudget(st.budget);
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 hover:border-cyan-300 dark:hover:border-cyan-800 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        {st.title}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                        ${st.budget}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {st.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Section */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label htmlFor="budget-input" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Total Project Budget Ceiling (USD)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Allocated transparently across verified specialists from the service catalog.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {budgetPresets.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBudget(b)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        budget === b
                          ? 'bg-slate-900 dark:bg-cyan-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      ${b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-w-xs relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-black text-sm">
                  $
                </span>
                <input
                  id="budget-input"
                  type="number"
                  min={100}
                  step={50}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                disabled={!prompt.trim() || isAnalyzing}
                onClick={handleDecompose}
                className={`px-7 py-3 rounded-xl font-bold text-sm text-white transition-all flex items-center gap-2 ${
                  !prompt.trim() || isAnalyzing
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                    : 'bg-cyan-500 hover:bg-cyan-600 active:scale-95 shadow-glow-cyan'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing & Assembling Specialist Team...</span>
                  </>
                ) : (
                  <>
                    <span>Assemble Team & Decompose</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ASSEMBLED TEAM & EXECUTION SEQUENCE */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* AI Project Intelligence & Execution Sequence Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-navy-950 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    AI Execution Plan
                  </span>
                  <span className="text-xs text-slate-400">
                    Topological Dependency Order
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {proposal?.projectName || 'Assembled Specialist Proposal'}
                </h2>
              </div>

              {/* Financial metrics */}
              <div className="flex items-center gap-4 text-left sm:text-right">
                <div className="pr-4 border-r border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget</span>
                  <span className="text-lg font-black text-white">${budget}</span>
                </div>
                <div className="pr-4 border-r border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Allocated</span>
                  <span className="text-lg font-black text-cyan-400">${allocatedTotal}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Buffer Saved</span>
                  <span className="text-lg font-black text-emerald-400">${savings}</span>
                </div>
              </div>
            </div>

            {/* Execution Sequence DAG Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Execution Milestone Flow:
              </span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {workPackages.map((wp, idx) => (
                  <React.Fragment key={wp.id}>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-200">
                      <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-900 text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span>{wp.roleName || wp.title}</span>
                      <span className="text-cyan-400 font-bold">${wp.allocatedPrice}</span>
                    </div>
                    {idx < workPackages.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Work Package Cards (Designed for Explainable AI Matching) */}
          <div className="space-y-4">
            {workPackages.map((wp, idx) => {
              const isDev = wp.category === 'dev';
              const isDesigner = wp.category === 'designer';

              return (
                <div
                  key={wp.id}
                  className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Task Info & Deliverables */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                            isDesigner
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                              : isDev
                              ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                          }`}
                        >
                          {wp.roleName || `Milestone ${idx + 1}: ${wp.category}`}
                        </span>

                        {wp.dependencies && wp.dependencies.length > 0 && (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            Prerequisite: {wp.dependencyNames?.[0] || 'Previous Milestone'}
                          </span>
                        )}

                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{wp.estimatedDays || 7} Days Estimate</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {wp.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                        {wp.description}
                      </p>

                      {/* Deliverables Tag Cloud */}
                      {wp.deliverables && wp.deliverables.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Deliverables:</span>
                          {wp.deliverables.map((d, di) => (
                            <span
                              key={di}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Matched Freelancer Profile & Price */}
                    <div className="flex md:flex-col items-end justify-between gap-3 shrink-0 md:w-64">
                      {/* Price badge */}
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Milestone Budget</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white">
                          ${wp.allocatedPrice} <span className="text-xs font-semibold text-slate-400">USD</span>
                        </div>
                      </div>

                      {/* Matched Freelancer Card */}
                      <div className="w-full bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                        {wp.assignedFreelancerName ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>95% Match Score</span>
                              </span>
                              <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>5.0</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-cyan-500 text-white font-bold flex items-center justify-center text-xs shrink-0">
                                {wp.assignedFreelancerName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {wp.assignedFreelancerName}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {wp.assignedFreelancerEmail}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400">
                            <UserX className="w-4 h-4 shrink-0" />
                            <div className="text-[11px]">
                              <span className="font-bold text-slate-700 dark:text-slate-300 block">Open Milestone</span>
                              <span>Auto-matched upon launch</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Edit Goal</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-7 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-glow-cyan transition-all flex items-center gap-1.5"
            >
              <span>Proceed to Unified Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONSOLIDATED REVIEW & PAYPAL CHECKOUT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Consolidated Quotation Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  One single escrow payment. Held securely until each milestone is reviewed.
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
                {workPackages.length} Assembled Milestones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-5">Specialty</th>
                    <th className="py-3 px-5">Milestone Scope</th>
                    <th className="py-3 px-5">Assigned Specialist</th>
                    <th className="py-3 px-5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {workPackages.map((wp) => (
                    <tr key={wp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white uppercase">
                        {wp.category}
                      </td>
                      <td className="py-3.5 px-5 font-medium">{wp.title}</td>
                      <td className="py-3.5 px-5">
                        {wp.assignedFreelancerName || <span className="text-slate-400 italic">Open Milestone</span>}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-slate-900 dark:text-white">
                        ${wp.allocatedPrice}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={3} className="py-3.5 px-5 text-slate-500 dark:text-slate-400 text-right">
                      Consolidated Project Escrow Total:
                    </td>
                    <td className="py-3.5 px-5 text-right text-base text-cyan-600 dark:text-cyan-400 font-black">
                      ${allocatedTotal} USD
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Checkout Card */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-7 space-y-5 max-w-md mx-auto text-center shadow-xl shadow-slate-200/40 dark:shadow-none transition-colors">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PayPal Escrow Protection</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white pt-1">
                Authorize & Fund Project
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Single checkout order. Split transparently per specialist and saved directly to your MongoDB Atlas cluster.
              </p>
            </div>

            <div className="pt-2 min-h-[140px] flex items-center justify-center">
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 44 }}
                createOrder={async () => {
                  const res = await fetch('/api/paypal/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: workPackages, totalBudget: budget }),
                  });
                  const order = await res.json();
                  return order.id;
                }}
                onApprove={async (data) => {
                  handleSaveAndCheckout(data.orderID);
                }}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                disabled={isSavingProject}
                onClick={() => handleSaveAndCheckout(`PP-DIRECT-${Date.now()}`)}
                className="w-full py-3 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isSavingProject ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to MongoDB Atlas...</span>
                  </>
                ) : (
                  <span>Direct 1-Click Pay & Save to MongoDB</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline pt-1 block mx-auto"
              >
                Back to Team Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
