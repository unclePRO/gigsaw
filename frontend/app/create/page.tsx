'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Star,
  ShieldCheck,
  Clock,
  Info,
  ShieldAlert,
  Send,
  Users,
  UserCheck,
  Briefcase,
  Layers,
  TrendingUp,
  FolderGit2,
  ExternalLink,
  RotateCcw,
  Check,
} from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useProjectStore } from '@/store/useProjectStore';
import { WorkPackage } from '@/types';

// Structured clarifying questions for the AI Project Manager
const PROJECT_MANAGER_QUESTIONS = [
  'What is the theme or brand aesthetic you have in mind? (e.g., minimalist modern, artisan boutique, corporate tech)',
  'Do you already have digital assets (like logos, photography, copy, menus) or should our design specialists build them from scratch?',
  'What is your target launch turnaround time (in weeks or days)?',
  'Are there any specific tech stack or platform integrations needed (e.g., Next.js, Stripe, Shopify, Meta/Google Ads)?',
  'Is there any specific reference website or competitor whose vibe you want to match?',
];

function CategoryBadge({ category }: { category: string }) {
  const cat = category.toLowerCase();
  if (cat === 'dev') {
    return (
      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900 flex items-center gap-1">
        <Briefcase className="w-3 h-3 text-cyan-500" />
        <span>Full-Stack Dev</span>
      </span>
    );
  }
  if (cat === 'designer') {
    return (
      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900 flex items-center gap-1">
        <Layers className="w-3 h-3 text-blue-400" />
        <span>UI/UX Designer</span>
      </span>
    );
  }
  return (
    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
      <TrendingUp className="w-3 h-3 text-emerald-500" />
      <span>Growth Marketer</span>
    </span>
  );
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const {
    prompt,
    setPrompt,
    budget,
    setBudget,
    isAnalyzing,
    setAnalyzing,
    workPackages,
    setWorkPackages,
    proposal,
    resetDraft,
    aiAnalysis,
    dependencyPlan,
    assumptions,
    risks,
    setAiMetadata,
    createPhase,
    setCreatePhase,
    chatMessages,
    addChatMessage,
    setSelectedFreelancer,
  } = useProjectStore();

  // Voice & Local UI State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [showIntelligenceDetails, setShowIntelligenceDetails] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);

  // Phase 1 → 2 animation states
  const [heroVisible, setHeroVisible] = useState(true);
  const [cardSlidingDown, setCardSlidingDown] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Pool of alternative freelancers by category fetched from MongoDB
  const [availableFreelancers, setAvailableFreelancers] = useState<Record<string, any[]>>({});
  const [swappingPackageId, setSwappingPackageId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Authentication guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/create');
    }
  }, [status, router]);

  // Speech Recognition check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) setSpeechSupported(false);
    }
  }, []);

  // Fetch real freelancers from MongoDB for replacement pool
  useEffect(() => {
    async function loadFreelancers() {
      try {
        const res = await fetch('/api/freelancers');
        const data = await res.json();
        if (data.success && Array.isArray(data.freelancers)) {
          const grouped: Record<string, any[]> = { dev: [], designer: [], marketer: [] };
          data.freelancers.forEach((fl: any) => {
            const cat = fl.category || 'dev';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(fl);
          });
          setAvailableFreelancers(grouped);
        }
      } catch (e) {
        console.error('Failed to load alternative freelancers:', e);
      }
    }
    loadFreelancers();
  }, []);

  // Auto-scroll chat — only fires when new messages arrive, NOT on phase switch
  useEffect(() => {
    if (createPhase === 'chat' && chatMessages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top on every phase change (instant so it always wins)
  useEffect(() => {
    window.scrollTo(0, 0);
    // Always clear transitioning flag when phase settles
    setIsTransitioning(false);
    // Reset hero/card animation states when returning to prompt
    if (createPhase === 'prompt') {
      setHeroVisible(true);
      setCardSlidingDown(false);
    }
  }, [createPhase]);

  // Computed values
  const allocatedTotal = workPackages.reduce((sum, wp) => sum + (wp.allocatedPrice || 0), 0);
  const savings = Math.max(0, budget - allocatedTotal);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
          <span className="text-xs text-slate-400">Loading project studio...</span>
        </div>
      </div>
    );
  }

  // Guard: freelancers cannot launch projects
  if (session?.user && (session.user as any).role === 'freelancer') {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 mt-12 shadow-sm">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Merchant Only Studio</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Freelancers cannot launch projects. Projects are created by merchants, and our AI talent matcher pairs specialists automatically.
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

  // Voice Input Toggle
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recognition = new SR();
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

  // STEP 1 -> STEP 2: Animated Transition to Conversational AI Gathering
  const handleInitialSubmit = () => {
    if (!prompt.trim() || isTransitioning) return;

    setIsTransitioning(true);

    // Stage 1 (0ms): fade hero text up
    setHeroVisible(false);

    // Stage 2 (200ms): slide card down toward bottom
    setTimeout(() => setCardSlidingDown(true), 180);

    // Stage 3 (750ms): switch phase after animation completes
    setTimeout(() => {
      setCreatePhase('chat');
      // Animation state reset handled by useEffect on createPhase change

      // AI initiates the conversation as Project Manager
      if (chatMessages.length === 0) {
        addChatMessage({
          role: 'ai',
          content: `Hi ${session?.user?.name || 'there'}! I'm your AI Project Manager. I've captured your primary goal:\n\n"${prompt.trim()}"\n\nTo ensure our algorithm decomposes this with precise milestone budgets and matches the top specialists, let me gather a few quick details:\n\n${PROJECT_MANAGER_QUESTIONS[0]}`,
        });
        setQuestionIndex(1);
      }
    }, 750);
  };

  // Conversational response handler
  const handleChatSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    addChatMessage({ role: 'user', content: userText });
    setChatInput('');

    // AI Project Manager asks subsequent questions
    setTimeout(() => {
      if (questionIndex < PROJECT_MANAGER_QUESTIONS.length) {
        addChatMessage({
          role: 'ai',
          content: PROJECT_MANAGER_QUESTIONS[questionIndex],
        });
        setQuestionIndex((prev) => prev + 1);
      } else {
        addChatMessage({
          role: 'ai',
          content:
            "Thank you! I have all key parameters gathered for scope, aesthetics, and technical requirements. Whenever you're ready, click **Finalize Details & Assemble Team** to run our decomposition and match top specialists.",
        });
      }
    }, 600);
  };

  // STEP 2 -> STEP 3: AI Decomposition & Freelancer Matching
  const handleFinalizeDetails = async () => {
    setAnalyzing(true);
    setSaveError(null);

    // Concatenate prompt with conversational answers
    const conversationContext = chatMessages
      .map((m) => `${m.role === 'ai' ? 'Project Manager' : 'Merchant'}: ${m.content}`)
      .join('\n');
    const enrichedPrompt = `${prompt}\n\nMerchant Clarifications:\n${conversationContext}`;

    try {
      const res = await fetch('/api/ai/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enrichedPrompt, budget }),
      });

      const data = await res.json();
      if (data.success && data.workPackages) {
        setWorkPackages(data.workPackages, data.proposal);
        setAiMetadata({
          aiAnalysis: data.aiAnalysis,
          dependencyPlan: data.dependencyPlan,
          assumptions: data.assumptions || [],
          risks: data.risks || [],
        });

        // Store selected freelancers in state
        data.workPackages.forEach((wp: WorkPackage) => {
          if (wp.assignedFreelancerName) {
            setSelectedFreelancer(wp.id, {
              id: wp.assignedFreelancerId,
              name: wp.assignedFreelancerName,
              email: wp.assignedFreelancerEmail,
              bio: wp.assignedFreelancerBio,
              skills: wp.assignedFreelancerSkills,
              rating: wp.assignedFreelancerRating,
              completedProjects: wp.assignedFreelancerCompletedProjects,
              pastProjects: wp.assignedFreelancerPastProjects,
              yearsOfExperience: wp.assignedFreelancerYearsOfExperience,
              hourlyRate: wp.assignedFreelancerHourlyRate,
              location: wp.assignedFreelancerLocation,
              matchScore: wp.matchScore,
              matchScoreBreakdown: wp.matchScoreBreakdown,
              matchReasons: wp.matchReasons,
            });
          }
        });

        setCreatePhase('results');
      } else {
        setSaveError(data.error || 'Failed to decompose project.');
      }
    } catch (err: any) {
      console.error('Decomposition error:', err);
      setSaveError(err.message || 'Network error during AI decomposition.');
    } finally {
      setAnalyzing(false);
    }
  };

  // STEP 4: "Pick Someone Else" - Replace Freelancer with next in pool
  const handleSwapFreelancer = (pkg: WorkPackage) => {
    const category = pkg.category.toLowerCase();
    const pool = availableFreelancers[category] || [];
    if (pool.length === 0) return;

    setSwappingPackageId(pkg.id);

    setTimeout(() => {
      // Find current freelancer index
      const currentIndex = pool.findIndex(
        (f) =>
          f.email?.toLowerCase() === pkg.assignedFreelancerEmail?.toLowerCase() ||
          f._id?.toString() === pkg.assignedFreelancerId
      );

      // Pick next freelancer in circular array
      const nextIndex = (currentIndex + 1) % pool.length;
      const nextFreelancer = pool[nextIndex];

      if (nextFreelancer) {
        const updatedPackages = workPackages.map((wp) => {
          if (wp.id === pkg.id) {
            return {
              ...wp,
              assignedFreelancerId: nextFreelancer._id?.toString(),
              assignedFreelancerName: nextFreelancer.name,
              assignedFreelancerEmail: nextFreelancer.email,
              assignedFreelancerBio: nextFreelancer.bio || '',
              assignedFreelancerSkills: nextFreelancer.skills || wp.requiredSkills || [],
              assignedFreelancerRating: nextFreelancer.rating || 5.0,
              assignedFreelancerCompletedProjects: nextFreelancer.completedProjects || 0,
              assignedFreelancerPastProjects: nextFreelancer.pastProjects || [],
              assignedFreelancerYearsOfExperience: nextFreelancer.yearsOfExperience || 3,
              assignedFreelancerHourlyRate: nextFreelancer.hourlyRate || 50,
              assignedFreelancerLocation: nextFreelancer.location || 'Remote',
              matchScore: Math.min(99, Math.max(90, Math.round((nextFreelancer.rating || 4.9) * 19.5))),
              matchReasons: [
                `Verified specialist in ${category.toUpperCase()}`,
                `Proven track record with ${nextFreelancer.completedProjects || 0} completed projects`,
                'High historic satisfaction rating',
              ],
            };
          }
          return wp;
        });

        setWorkPackages(updatedPackages);
      }
      setSwappingPackageId(null);
    }, 400);
  };

  // STEP 5: Finalize Team & Send Invites -> Escrow & Project Creation
  const handleFinalizeAndCheckout = async (orderId: string) => {
    setIsSavingProject(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: proposal?.projectName || `${prompt.slice(0, 30)} Project`,
          merchantPrompt: prompt,
          totalBudget: budget,
          allocatedTotal: workPackages.reduce((s, w) => s + w.allocatedPrice, 0),
          savings: Math.max(0, budget - workPackages.reduce((s, w) => s + w.allocatedPrice, 0)),
          workPackages,
          paypalOrderId: orderId,
          merchantId: (session?.user as any)?.id,
          merchantName: session?.user?.name || 'Merchant',
          merchantEmail: session?.user?.email || 'merchant@example.com',
          aiAnalysis: aiAnalysis || proposal?.aiAnalysis,
          dependencyPlan: dependencyPlan || proposal?.dependencyPlan,
          assumptions: assumptions || proposal?.assumptions,
          risks: risks || proposal?.risks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save project to MongoDB');
      }

      resetDraft();
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error funding project:', err);
      setSaveError(err.message || 'Error saving project to database.');
    } finally {
      setIsSavingProject(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080E1A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Global Error Banner */}
      {saveError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-fadeIn">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2 shadow-xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="flex-1">{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              className="text-rose-400 hover:text-rose-600 font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          STEP 1: THE INITIAL PROMPT (Centered Minimalist UI)
      ─────────────────────────────────────────────────────────────────── */}
      {(createPhase === 'prompt' || isTransitioning) && (
        <div
          className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
          style={{ pointerEvents: isTransitioning ? 'none' : 'auto' }}
        >
          <div className="w-full max-w-2xl space-y-7">
            {/* Header / Intro — fades up when transitioning */}
            <div
              className={`text-center space-y-3 transition-all duration-300 ease-out ${
                heroVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-6 pointer-events-none'
              }`}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Project Architect</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                What would you like to build?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Describe your project in plain language. Our conversational AI will structure requirements and match top verified specialists.
              </p>
            </div>

            {/* Main Centered Chatbox — fades + shrinks when transitioning */}
            <div
              className={`bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-7 space-y-5 transition-all duration-500 ease-in-out ${
                cardSlidingDown
                  ? 'scale-95 opacity-0'
                  : 'scale-100 opacity-100'
              }`}
            >
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="prompt-input"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim()) {
                      handleInitialSubmit();
                    }
                  }}
                  placeholder="e.g. I need a website for my coffee shop with brand identity, digital menu, and a local social media launch campaign..."
                  className="w-full p-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed resize-none transition-colors"
                />

                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute right-3.5 top-3.5 p-2 rounded-xl transition-all ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={isListening ? 'Stop listening' : 'Voice Input'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Budget Ceiling Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label htmlFor="budget-input" className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Estimated Project Budget Ceiling (USD)
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Calculated transparently across verified specialists in our service catalog.
                  </p>
                </div>

                <div className="relative max-w-[170px] shrink-0">
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
                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!prompt.trim() || isTransitioning}
                  onClick={handleInitialSubmit}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 ${
                    !prompt.trim() || isTransitioning
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-600 active:scale-[0.99] shadow-glow-cyan'
                  }`}
                >
                  <span>Build My Project Team</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          STEP 2: CONVERSATIONAL AI GATHERING (Chatbot Sliding UI)
      ─────────────────────────────────────────────────────────────────── */}
      {createPhase === 'chat' && (
        <div className="min-h-screen flex flex-col transition-all duration-700 ease-in-out animate-fadeIn">
          {/* Top Sticky Bar */}
          <div className="sticky top-16 z-30 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{prompt}</p>
                  <p className="text-[10px] text-slate-400">Budget: ${budget} USD &bull; AI Project Gathering</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreatePhase('prompt')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 shrink-0 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Goal</span>
              </button>
            </div>
          </div>

          {/* Chat Stream Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-4 pb-44">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shrink-0 mt-1 mr-2.5 shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-lg px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-cyan-500 text-white rounded-br-none shadow-sm font-medium'
                        : 'bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isAnalyzing && (
                <div className="flex justify-start items-center gap-2.5 p-3 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm text-xs text-slate-500 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500 shrink-0" />
                  <span>Decomposing milestones & calculating budget plan...</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Bottom Chat Input Bar & Finalize Trigger */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-3 shadow-lg">
            <div className="max-w-3xl mx-auto space-y-2.5">
              {/* Primary Finalize Details Button */}
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleFinalizeDetails}
                className="w-full py-2.5 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Decomposing & Matching Specialists...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Finalize Details & Match Specialists</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Chat Input Bar */}
              <form onSubmit={handleChatSend} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Answer project questions or provide details..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isAnalyzing}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim() || isAnalyzing}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shrink-0 ${
                    !chatInput.trim() || isAnalyzing
                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-600 shadow-sm'
                  }`}
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          STEP 3 & 4: AI DECOMPOSITION & FREELANCER MATCHING / REPLACEMENT
      ─────────────────────────────────────────────────────────────────── */}
      {createPhase === 'results' && (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn pb-32">
          {/* Executive AI Decomposition Architecture Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-navy-950 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI Execution Architecture</span>
                  </span>
                  <span className="text-xs text-slate-400">Topological Milestone Dependency Order</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {proposal?.projectName || 'Assembled Specialist Proposal'}
                </h2>
                {aiAnalysis?.business_goal && (
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl line-clamp-2">
                    <span className="font-semibold text-cyan-400">Business Goal:</span> {aiAnalysis.business_goal}
                  </p>
                )}
              </div>

              {/* Financial Metrics */}
              <div className="flex items-center gap-4 text-left sm:text-right shrink-0">
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

            {/* Execution Sequence Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Milestone Execution Sequence:
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

            {/* AI Assumptions & Risk Drawer Toggle */}
            {((assumptions && assumptions.length > 0) || (risks && risks.length > 0)) && (
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowIntelligenceDetails(!showIntelligenceDetails)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>
                    AI Intelligence Report ({assumptions?.length || 0} Assumptions, {risks?.length || 0} Risks)
                  </span>
                  {showIntelligenceDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showIntelligenceDetails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 mt-2 text-xs">
                    {assumptions && assumptions.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1.5">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Identified Assumptions</span>
                        </div>
                        <ul className="space-y-1 text-slate-400 text-[11px]">
                          {assumptions.map((asm, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-cyan-400 font-bold">&bull;</span>
                              <span>{asm}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {risks && risks.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1.5">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          <span>Identified Project Risks</span>
                        </div>
                        <ul className="space-y-1 text-slate-400 text-[11px]">
                          {risks.map((rsk, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">&bull;</span>
                              <span>{rsk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section Heading */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <span>Matched Specialists & Assigned Work Packages</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review verified portfolios, past project deliveries, and milestones. Swap specialists anytime using Pick Someone Else.
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
              {workPackages.length} Assembled Specialists
            </span>
          </div>

          {/* Rich Freelancer Profile Cards */}
          <div className="space-y-6">
            {workPackages.map((wp, idx) => {
              const isExpanded = expandedMatchId === wp.id;
              const isSwapping = swappingPackageId === wp.id;

              return (
                <div
                  key={wp.id}
                  className={`bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
                    isSwapping ? 'opacity-50 scale-[0.99] animate-pulse' : ''
                  }`}
                >
                  {/* Top Bar: Role badge, estimate & allocated price */}
                  <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={wp.category} />
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-500" />
                        <span>{wp.estimatedDays || 7} Days Turnaround</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Milestone Escrow</span>
                      <div className="text-xl font-black text-slate-900 dark:text-white">
                        ${wp.allocatedPrice} <span className="text-xs font-semibold text-slate-400">USD</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 space-y-5">
                    {/* Milestone Scope Info */}
                    <div className="space-y-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">{wp.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                        {wp.description}
                      </p>

                      {/* Required Skills Badges */}
                      {wp.requiredSkills && wp.requiredSkills.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Required Skills:</span>
                          {wp.requiredSkills.map((sk, ski) => (
                            <span
                              key={ski}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-900/40"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Deliverables Tag Cloud */}
                      {wp.deliverables && wp.deliverables.length > 0 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Deliverables:</span>
                          {wp.deliverables.map((d, di) => (
                            <span
                              key={di}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rich Freelancer Profile Block */}
                    {wp.assignedFreelancerName ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Avatar & Personal Details */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                              {wp.assignedFreelancerName.charAt(0).toUpperCase()}
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {wp.assignedFreelancerName}
                                </h5>
                                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{wp.assignedFreelancerRating || 5.0}</span>
                                  <span className="text-slate-400 font-normal">
                                    ({wp.assignedFreelancerCompletedProjects || 12} jobs)
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-xl">
                                {wp.assignedFreelancerBio ||
                                  'Top-rated verified specialist with proven delivery on complex client milestones.'}
                              </p>

                              <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                                <span>{wp.assignedFreelancerYearsOfExperience || 4}+ Years Exp.</span>
                                <span>&bull;</span>
                                <span>{wp.assignedFreelancerLocation || 'Remote Specialist'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Match Score & "Pick Someone Else" Button */}
                          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedMatchId(isExpanded ? null : wp.id)}
                              className="text-[10px] font-extrabold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 hover:underline cursor-pointer bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-900"
                              title="View explainable 6-factor AI match breakdown"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-500" />
                              <span>{wp.matchScore ? `${wp.matchScore}% Match` : '96% Match'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {/* "Pick Someone Else" Button */}
                            <button
                              type="button"
                              onClick={() => handleSwapFreelancer(wp)}
                              disabled={isSwapping}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:border-cyan-300 dark:hover:border-cyan-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isSwapping ? 'animate-spin' : ''}`} />
                              <span>Pick Someone Else</span>
                            </button>
                          </div>
                        </div>

                        {/* Explainable AI Match Breakdown Drawer */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-left">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Explainable AI Match Breakdown:
                            </div>
                            <div className="space-y-1.5 text-[11px]">
                              {[
                                { label: 'Semantic Brief Relevance (35%)', key: 'semantic_relevance', fallback: 0.95 },
                                { label: 'Skill Overlap (25%)', key: 'skill_overlap', fallback: 0.94 },
                                { label: 'Rating & Track Record (15%)', key: 'rating', fallback: 0.98 },
                                { label: 'Availability (10%)', key: 'availability', fallback: 1.0 },
                                { label: 'Price Compatibility (10%)', key: 'price_compatibility', fallback: 0.92 },
                                { label: 'Delivery Turnaround Fit (5%)', key: 'delivery_time', fallback: 0.9 },
                              ].map(({ label, key, fallback }) => {
                                const val = Math.round(
                                  ((wp.matchScoreBreakdown as any)?.[key] ?? fallback) * 100
                                );
                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                                  >
                                    <span>{label}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${val}%` }} />
                                      </div>
                                      <span className="font-bold text-cyan-600 dark:text-cyan-400 w-8 text-right">
                                        {val}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {wp.matchReasons && wp.matchReasons.length > 0 && (
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                                  Why matched:
                                </span>
                                <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                                  {wp.matchReasons.map((reason, ri) => (
                                    <li key={ri} className="flex items-start gap-1">
                                      <span className="text-cyan-500 font-bold">&bull;</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Past Experience / Portfolios List from MongoDB */}
                        {wp.assignedFreelancerPastProjects && wp.assignedFreelancerPastProjects.length > 0 && (
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                              Verified Past Projects & Portfolio:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {wp.assignedFreelancerPastProjects.slice(0, 2).map((item: any, pIdx: number) => (
                                <div
                                  key={pIdx}
                                  className="p-2.5 rounded-xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                      {item.title}
                                    </span>
                                    <FolderGit2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {item.description}
                                  </p>
                                  {item.technologies && item.technologies.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {item.technologies.slice(0, 3).map((t: string, ti: number) => (
                                        <span
                                          key={ti}
                                          className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-slate-400">
                        <UserCheck className="w-5 h-5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block">
                            Milestone Ready for Assignment
                          </span>
                          <span>Will be auto-assigned to matched specialist upon launch authorization.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Control Bar: "Finalize Team & Send Invites" */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-2xl">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreatePhase('chat')}
                  className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Adjust Scope in Chat</span>
                </button>
                <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
                  Total Project Escrow: <strong className="text-cyan-600 dark:text-cyan-400 font-black">${allocatedTotal} USD</strong>
                </div>
              </div>

              {/* Big Primary CTA */}
              <button
                type="button"
                onClick={() => setCreatePhase('checkout')}
                className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-600 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-glow-cyan transition-all flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>Finalize Team & Send Invites</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          STEP 5: UNIFIED CHECKOUT & PROJECT ESCROW FUNDING
      ─────────────────────────────────────────────────────────────────── */}
      {createPhase === 'checkout' && (
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-7 animate-fadeIn">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PayPal Escrow Protection</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Authorize Project & Dispatch Invitations
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Single escrow payment funds your entire assembled specialist team. Held securely until each milestone is approved by you.
            </p>
          </div>

          {/* Consolidated Quotation Table */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Consolidated Quotation Breakdown
              </h3>
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
                {workPackages.length} Milestones
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-5">Specialty</th>
                    <th className="py-3 px-5">Milestone</th>
                    <th className="py-3 px-5">Assigned Specialist</th>
                    <th className="py-3 px-5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {workPackages.map((wp) => (
                    <tr key={wp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white uppercase text-[11px]">
                        {wp.category}
                      </td>
                      <td className="py-3.5 px-5">{wp.title}</td>
                      <td className="py-3.5 px-5">
                        {wp.assignedFreelancerName || <span className="text-slate-400 italic">Open Specialist</span>}
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
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 p-7 space-y-5 max-w-md mx-auto text-center shadow-xl">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize Escrow Payment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose standard PayPal authorization or instant 1-click test checkout.
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
                  handleFinalizeAndCheckout(data.orderID);
                }}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                disabled={isSavingProject}
                onClick={() => handleFinalizeAndCheckout(`PP-DIRECT-${Date.now()}`)}
                className="w-full py-3 bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isSavingProject ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching invites & saving to MongoDB...</span>
                  </>
                ) : (
                  <span>Direct Authorize & Launch to Dashboard</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCreatePhase('results')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline pt-1 block mx-auto"
              >
                Back to Specialist Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
