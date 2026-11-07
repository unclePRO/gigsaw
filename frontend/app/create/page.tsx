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
      <div className="p-12 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-600" />
        <span>Checking authentication...</span>
      </div>
    );
  }

  // Block freelancers from creating projects
  if (session?.user && (session.user as any).role === 'freelancer') {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white rounded-2xl border border-slate-200 mt-12 shadow-sm">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Merchant Only Feature</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Freelancers cannot create projects. Projects are launched by merchants, and our AI matches specialists automatically based on category and skills.
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header & Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Project</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enter your project requirements. AI decomposes it into Designer, Developer, and Marketer milestones.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { num: 1, label: 'Goal & Budget' },
            { num: 2, label: 'Categories' },
            { num: 3, label: 'Review & Pay' },
          ].map((step, idx) => (
            <React.Fragment key={step.num}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  currentStep === step.num
                    ? 'bg-slate-900 text-white'
                    : currentStep > step.num
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <span>{currentStep > step.num ? '✓' : step.num}.</span>
                <span>{step.label}</span>
              </div>
              {idx < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{saveError}</span>
        </div>
      )}

      {/* STEP 1: REQUIREMENT INPUT */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="prompt-input" className="text-sm font-bold text-slate-900 block">
              Describe your project goal
            </label>
            <p className="text-xs text-slate-500">
              Provide context about what you want to build or launch.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              id="prompt-input"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build an online marketplace for local organic farmers with UI/UX mockups, payment integration, and a launch SEO marketing campaign."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 leading-relaxed"
            />

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{prompt.length} characters</span>
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-cyan-600" />}
                  <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-w-xs space-y-1.5">
            <label htmlFor="budget-input" className="text-xs font-bold text-slate-700">
              Total Budget Ceiling (USD)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">$</span>
              <input
                id="budget-input"
                type="number"
                min={100}
                step={50}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={!prompt.trim() || isAnalyzing}
              onClick={handleDecompose}
              className={`px-6 py-3 rounded-xl font-bold text-sm text-white transition-all flex items-center gap-2 ${
                !prompt.trim() || isAnalyzing
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-600 shadow-sm'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Decomposing & Matching Categories...</span>
                </>
              ) : (
                <>
                  <span>Decompose Project</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CATEGORY BREAKDOWN & MATCHING VIEW */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Total Budget</span>
              <div className="text-xl font-bold text-slate-900">${budget}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Allocated Total</span>
              <div className="text-xl font-bold text-cyan-600">${allocatedTotal}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Buffer Saved</span>
              <div className="text-xl font-bold text-emerald-600">${savings}</div>
            </div>
          </div>

          {/* 3 Categories: Designer, Dev, Marketer */}
          <div className="space-y-4">
            {workPackages.map((wp, idx) => (
              <div key={wp.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 uppercase">
                        {wp.roleName || `Category: ${wp.category}`}
                      </span>
                      {wp.dependencies && wp.dependencies.length > 0 && (
                        <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Prerequisite: {wp.dependencyNames?.[0] || 'Previous step'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{wp.title}</h3>
                    <p className="text-xs text-slate-500">{wp.description}</p>
                  </div>

                  {/* Matched Freelancer Info from MongoDB */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0 md:w-64">
                    {wp.assignedFreelancerName ? (
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {wp.assignedFreelancerName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {wp.assignedFreelancerEmail}
                          </div>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            Matched from MongoDB
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500">
                        <UserX className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="text-[11px]">
                          <span className="font-semibold block text-slate-700">Open Milestone</span>
                          <span>Assigned upon freelancer seed</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block font-medium">Estimated</span>
                    <div className="text-lg font-bold text-slate-900">${wp.allocatedPrice}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
            >
              <span>Review Quotation & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONSOLIDATED REVIEW & CHECKOUT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Quotation Breakdown</h2>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                3 Categories
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">Assigned Specialist</th>
                  <th className="py-3 px-4 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {workPackages.map((wp) => (
                  <tr key={wp.id}>
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">{wp.category}</td>
                    <td className="py-3 px-4 font-medium">{wp.title}</td>
                    <td className="py-3 px-4">
                      {wp.assignedFreelancerName || <span className="text-slate-400">Open Milestone</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">${wp.allocatedPrice}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-slate-500 text-right">Total Project Cost:</td>
                  <td className="py-3 px-4 text-right text-base text-cyan-700">${allocatedTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto text-center">
            <h3 className="text-base font-bold text-slate-900">Authorize & Fund Project</h3>
            <p className="text-xs text-slate-500">
              One consolidated payment. Creates and saves the project directly to your MongoDB Atlas collection.
            </p>

            <div className="pt-2 min-h-[140px] flex items-center justify-center">
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 42 }}
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

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSavingProject}
                onClick={() => handleSaveAndCheckout(`PP-DIRECT-${Date.now()}`)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
