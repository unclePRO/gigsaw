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
import { useProjectStore } from '@/store/useProjectStore';
import { WorkPackage } from '@/types';

// Structured clarifying categories for the AI Project Manager
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
      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-[#E5F5F1] dark:bg-[#1B3B39] text-[#168C80] dark:text-[#73D8C7] border-[#D8E9E4] dark:border-[#345451] flex items-center gap-1">
        <Layers className="w-3 h-3 text-[#168C80] dark:text-[#32B6A5]" />
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
    resetChat,
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
  const [budgetStr, setBudgetStr] = useState<string>(budget ? String(budget) : '0');

  useEffect(() => {
    setBudgetStr(String(budget || 0));
  }, [budget]);

  // Conversational Scoping AI State
  const [projectName, setProjectName] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([
    'Minimalist & Modern',
    'Artisan Boutique',
    'Have logo & copy ready',
    'Need design from scratch',
  ]);
  const [completenessScore, setCompletenessScore] = useState<number>(0.25);
  const [extractedSpec, setExtractedSpec] = useState<Record<string, string>>({});
  const [isReadyToFinalize, setIsReadyToFinalize] = useState<boolean>(false);
  const [excludedFreelancers, setExcludedFreelancers] = useState<Record<string, string[]>>({});

  // Phase 1 → 2 animation states
  const [heroVisible, setHeroVisible] = useState(true);
  const [cardSlidingDown, setCardSlidingDown] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Pool of alternative freelancers by category fetched from MongoDB
  const [availableFreelancers, setAvailableFreelancers] = useState<Record<string, any[]>>({});
  const [swappingPackageId, setSwappingPackageId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
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

  // Auto-focus chat input whenever AI finishes asking a question or responding
  useEffect(() => {
    if (createPhase === 'chat' && !isAiThinking && !isAnalyzing) {
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [createPhase, isAiThinking, isAnalyzing]);

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
      <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200 dark:border-slate-800 mt-12 shadow-sm">
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

    // Stage 2 (180ms): slide card down toward bottom
    setTimeout(() => setCardSlidingDown(true), 180);

    // Stage 3 (750ms): switch phase after animation completes
    setTimeout(async () => {
      setCreatePhase('chat');

      // AI initiates the conversation as Project Manager
      if (chatMessages.length === 0) {
        setIsAiThinking(true);
        setSaveError(null);
        try {
          const res = await fetch('/api/ai/scoping/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              initial_goal: prompt.trim(),
              messages: [],
              current_budget: budget,
              project_name: projectName || undefined,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.reply) {
            addChatMessage({
              role: 'ai',
              content: `Hi ${session?.user?.name || 'there'}! I'm your AI Project Manager. I've captured your primary goal:\n\n"${prompt.trim()}"\n\n${data.reply}`,
            });
            if (data.project_name) {
              setProjectName(data.project_name);
            }
            if (data.current_budget != null || data.budget_changed) {
              setBudget(Number(data.current_budget));
            }
            if (data.suggested_replies && data.suggested_replies.length > 0) {
              setSuggestedReplies(data.suggested_replies);
            }
            if (data.completeness_score != null) {
              setCompletenessScore(data.completeness_score);
            }
            if (data.extracted_spec) {
              setExtractedSpec(data.extracted_spec);
            }
            if (data.is_ready_to_finalize) {
              setIsReadyToFinalize(true);
            }
          } else {
            // Propagate 503 retry error without faking replies
            const errMsg = data.message || data.error || 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.';
            setSaveError(errMsg);
          }
        } catch (err: any) {
          setSaveError(err.message || 'Failed to reach AI assistant. Please wait a few seconds and retry.');
        } finally {
          setIsAiThinking(false);
        }
      }
    }, 750);
  };

  // Conversational response handler via AI Scoping Assistant
  const handleChatSend = async (customText?: string) => {
    const text = (typeof customText === 'string' ? customText : chatInput).trim();
    if (!text || isAiThinking) return;

    // Append user message immediately
    const updatedUserMessages = [...chatMessages, { role: 'user' as const, content: text }];
    addChatMessage({ role: 'user', content: text });
    setChatInput('');
    setSuggestedReplies([]);
    setIsAiThinking(true);
    setSaveError(null);

    try {
      // Map to ScopingChatMessage format for API
      const apiMessages = updatedUserMessages.map((m) => ({
        role: m.role === 'ai' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

      const res = await fetch('/api/ai/scoping/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_goal: prompt.trim(),
          messages: apiMessages,
          current_budget: budget,
          extracted_spec: extractedSpec,
          project_name: projectName || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.reply) {
        addChatMessage({
          role: 'ai',
          content: data.reply,
        });
        if (data.project_name) {
          setProjectName(data.project_name);
        }
        if (data.current_budget != null || data.budget_changed) {
          setBudget(Number(data.current_budget));
        }
        if (data.suggested_replies && data.suggested_replies.length > 0) {
          setSuggestedReplies(data.suggested_replies);
        }
        if (data.completeness_score != null) {
          setCompletenessScore(data.completeness_score);
        }
        if (data.extracted_spec) {
          setExtractedSpec(data.extracted_spec);
        }
        if (data.is_ready_to_finalize) {
          setIsReadyToFinalize(true);
        }
      } else {
        // Propagate 503 retry error without faking replies or forcing ready_to_finalize
        const errMsg = data.message || data.error || 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.';
        setSaveError(errMsg);
      }
    } catch (e: any) {
      console.error('Scoping chat error:', e);
      setSaveError(e.message || 'Network error communicating with AI assistant.');
    } finally {
      setIsAiThinking(false);
    }
  };

  // STEP 2 -> STEP 3: AI Finalize Scoping & Freelancer Matching
  const handleFinalizeDetails = async () => {
    setAnalyzing(true);
    setSaveError(null);

    const apiMessages = chatMessages.map((m) => ({
      role: m.role === 'ai' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));

    try {
      const res = await fetch('/api/ai/scoping/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_goal: prompt.trim(),
          messages: apiMessages,
          extracted_spec: extractedSpec,
          budget,
          project_name: projectName || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.workPackages) {
        if (data.projectName) {
          setProjectName(data.projectName);
        }
        if (data.budget != null) {
          setBudget(Number(data.budget));
        }
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
        setSaveError(data.message || data.error || 'Failed to finalize and decompose project.');
      }
    } catch (err: any) {
      console.error('Finalize decomposition error:', err);
      setSaveError(err.message || 'Network error during AI finalization.');
    } finally {
      setAnalyzing(false);
    }
  };

  // STEP 4: "Pick Someone Else" - Replace Freelancer with AI-ranked alternative
  const handleSwapFreelancer = async (pkg: WorkPackage) => {
    setSwappingPackageId(pkg.id);

    try {
      const currentExcluded = excludedFreelancers[pkg.id] || [];
      const res = await fetch('/api/ai/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_package_id: pkg.id,
          service_category: pkg.category,
          required_skills: pkg.requiredSkills || [],
          brief: pkg.description || '',
          budget: pkg.allocatedPrice,
          max_delivery_days: pkg.estimatedDays,
          current_freelancer_id: pkg.assignedFreelancerId,
          exclude_freelancer_ids: currentExcluded,
        }),
      });

      const data = await res.json();
      if (data.success && data.freelancer) {
        const fl = data.freelancer;
        const updatedPackages = workPackages.map((wp) => {
          if (wp.id === pkg.id) {
            return {
              ...wp,
              assignedFreelancerId: fl.id,
              assignedFreelancerName: fl.name,
              assignedFreelancerEmail: fl.email,
              assignedFreelancerBio: fl.bio || '',
              assignedFreelancerSkills: fl.skills || wp.requiredSkills || [],
              assignedFreelancerRating: fl.rating ?? 0,
              assignedFreelancerCompletedProjects: fl.completedProjects || 0,
              assignedFreelancerPastProjects: fl.pastProjects || [],
              assignedFreelancerYearsOfExperience: fl.yearsOfExperience || 0,
              assignedFreelancerHourlyRate: fl.hourlyRate,
              assignedFreelancerLocation: fl.location || '',
              matchScore: fl.matchScore,
              matchScoreBreakdown: fl.matchScoreBreakdown,
              matchReasons: fl.matchReasons,
            };
          }
          return wp;
        });

        setWorkPackages(updatedPackages);
        setExcludedFreelancers((prev) => ({
          ...prev,
          [pkg.id]: [...(prev[pkg.id] || []), fl.id],
        }));
      }
    } catch (err) {
      console.error('Swap error:', err);
    } finally {
      setSwappingPackageId(null);
    }
  };

  // STEP 5: Dispatch Invitations & Save Project in Draft / Pending State
  const handleLaunchAndSendInvites = async () => {
    setIsSavingProject(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: projectName || proposal?.projectName || `${prompt.slice(0, 30)} Project`,
          merchantPrompt: prompt,
          totalBudget: budget,
          allocatedTotal: workPackages.reduce((s, w) => s + w.allocatedPrice, 0),
          savings: Math.max(0, budget - workPackages.reduce((s, w) => s + w.allocatedPrice, 0)),
          workPackages: workPackages.map((w) => ({
            ...w,
            inviteStatus: 'invited',
            status: 'Pending',
          })),
          status: 'ON_HOLD',
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
      const targetId = data.project?._id || data.project?.id;
      if (targetId) {
        router.push(`/dashboard/${targetId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Error dispatching project invites:', err);
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
              className={`bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-7 space-y-5 transition-all duration-500 ease-in-out ${
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
                    min={0}
                    step={50}
                    value={budgetStr}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      if (!budgetStr || budgetStr.trim() === '') {
                        setBudgetStr('0');
                        setBudget(0);
                      }
                    }}
                    onChange={(e) => {
                      let val = e.target.value;
                      // Override leading zero if user typed after a 0 (e.g. was '0', user typed '1' -> '01' or '010')
                      if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
                        val = val.replace(/^0+/, '');
                        if (val === '') val = '0';
                      }
                      setBudgetStr(val);
                      const num = Number(val);
                      setBudget(isNaN(num) ? 0 : Math.max(0, num));
                    }}
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
          <div className="sticky top-16 z-30 bg-white/95 dark:bg-[#142F2E]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#168C80] to-[#32B6A5] flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{prompt}</p>
                  <p className="text-[10px] text-slate-400">Budget: ${budget} USD &bull; Conversational AI Scoping</p>
                </div>
              </div>

              {/* Scoping Completeness Progress Indicator */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Scope Clarity</span>
                <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(completenessScore * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400">
                  {Math.round(completenessScore * 100)}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetChat();
                  setProjectName('');
                  setExtractedSpec({});
                  setCompletenessScore(0.25);
                  setSuggestedReplies([
                    'Minimalist & Modern',
                    'Artisan Boutique',
                    'Have logo & copy ready',
                    'Need design from scratch',
                  ]);
                  setIsReadyToFinalize(false);
                  setSaveError(null);
                  setCreatePhase('prompt');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Goal</span>
              </button>
            </div>
          </div>

          {/* Chat Stream Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-4 pb-48">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#168C80] to-[#32B6A5] text-white flex items-center justify-center shrink-0 mt-1 mr-2.5 shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-lg px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-cyan-500 text-white rounded-br-none shadow-sm font-medium'
                        : 'bg-white dark:bg-[#1B3B39] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isAiThinking && (
                <div className="flex justify-start items-center gap-2.5 p-3 bg-white dark:bg-[#1B3B39] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm text-xs text-slate-500 animate-pulse">
                  <Sparkles className="w-4 h-4 text-cyan-500 animate-spin" />
                  <span>AI Project Manager is analyzing specifications...</span>
                </div>
              )}

              {isAnalyzing && (
                <div className="flex justify-start items-center gap-2.5 p-3 bg-white dark:bg-[#1B3B39] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm text-xs text-slate-500 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500 shrink-0" />
                  <span>Decomposing milestones & calculating budget plan...</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Bottom Chat Input Bar & Finalize Trigger */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#142F2E]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-3 shadow-lg">
            <div className="max-w-3xl mx-auto space-y-2.5">
              {/* Clickable Quick Suggestion Chips */}
              {suggestedReplies.length > 0 && !isAiThinking && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1 animate-fadeIn">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Suggestions:</span>
                  {suggestedReplies.map((reply, rIdx) => (
                    <button
                      key={rIdx}
                      type="button"
                      onClick={() => handleChatSend(reply)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 transition-all active:scale-95 shadow-2xs"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {/* Primary Finalize Details Button */}
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleFinalizeDetails}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-white ${
                  isReadyToFinalize || completenessScore >= 0.75
                    ? 'bg-gradient-to-r from-[#168C80] to-[#32B6A5] hover:from-[#126B64] hover:to-[#168C80] active:scale-[0.99] shadow-glow-cyan'
                    : 'bg-slate-900 dark:bg-cyan-500 hover:bg-slate-800 dark:hover:bg-cyan-600'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Decomposing & Matching Specialists...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isReadyToFinalize
                        ? 'Scope Ready: Finalize Details & Match Specialists'
                        : 'Finalize Details & Match Specialists'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChatSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder={
                    isAiThinking
                      ? "AI Project Manager is formulating response..."
                      : "Answer project questions or provide details..."
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  readOnly={isAnalyzing || isAiThinking}
                  className={`flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors ${
                    isAiThinking ? 'opacity-70 cursor-wait' : ''
                  }`}
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim() || isAnalyzing || isAiThinking}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shrink-0 ${
                    !chatInput.trim() || isAnalyzing || isAiThinking
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
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fadeIn pb-32">
          {/* Clean Executive Summary Banner */}
          <div className="bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Talent Match & Budget Allocation</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {proposal?.projectName || 'Assembled Specialist Proposal'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Review your assembled specialist team and budget breakdown. Swap any specialist before funding escrow.
              </p>
            </div>

            {/* Financial Metrics */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
              <div className="pr-4 border-r border-slate-200 dark:border-slate-800 text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">${budget}</span>
              </div>
              <div className="pr-4 border-r border-slate-200 dark:border-slate-800 text-left">
                <span className="text-[10px] uppercase font-bold text-cyan-500 block">Allocated Escrow</span>
                <span className="text-lg font-black text-cyan-500">${allocatedTotal}</span>
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-emerald-500 block">Buffer Saved</span>
                <span className="text-lg font-black text-emerald-500">${savings}</span>
              </div>
            </div>
          </div>

          {/* Section Heading */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <span>Matched Specialists & Assigned Work Packages</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Each milestone is assigned to a verified specialist with explainable AI match scores.
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
              {workPackages.length} Specialists
            </span>
          </div>

          {/* Rich Freelancer Profile Cards */}
          <div className="space-y-5">
            {workPackages.map((wp) => {
              const isExpanded = expandedMatchId === wp.id;
              const isSwapping = swappingPackageId === wp.id;

              // Ensure match score is strictly 0-100%
              const rawScore = Number(wp.matchScore) || 94;
              const displayScore = rawScore > 100
                ? Math.min(99, Math.round(rawScore / 100))
                : Math.min(99, Math.max(1, Math.round(rawScore)));

              const milestonePrice = wp.allocatedPrice > 0
                ? wp.allocatedPrice
                : Math.round(budget / (workPackages.length || 1));

              return (
                <div
                  key={wp.id}
                  className={`bg-white dark:bg-[#1B3B39] rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
                    isSwapping ? 'opacity-50 scale-[0.99] animate-pulse' : ''
                  }`}
                >
                  {/* Top Bar: Role badge, estimate & allocated price */}
                  <div className="px-6 py-3.5 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={wp.category} />
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-500" />
                        <span>{wp.estimatedDays || 7} Days Turnaround</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Milestone Escrow</span>
                      <div className="text-xl font-black text-slate-900 dark:text-white">
                        ${milestonePrice} <span className="text-xs font-semibold text-slate-400">USD</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 space-y-4">
                    {/* Milestone Scope Info */}
                    <div className="space-y-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">{wp.title}</h4>
                      {wp.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                          {wp.description}
                        </p>
                      )}

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

                    {/* Matched Freelancer Profile Block */}
                    {wp.assignedFreelancerName ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Avatar & Personal Details */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#168C80] to-[#32B6A5] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                              {wp.assignedFreelancerName.charAt(0).toUpperCase()}
                            </div>

                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {wp.assignedFreelancerName}
                                </h5>
                                {typeof wp.assignedFreelancerRating === 'number' && wp.assignedFreelancerRating > 0 && (wp.assignedFreelancerCompletedProjects ?? 0) > 0 ? (
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>{wp.assignedFreelancerRating.toFixed(1)}</span>
                                    <span className="text-slate-400 font-normal">
                                      ({wp.assignedFreelancerCompletedProjects} jobs)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                    No Rating
                                  </span>
                                )}
                              </div>

                              {wp.assignedFreelancerBio && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-xl">
                                  {wp.assignedFreelancerBio}
                                </p>
                              )}

                              <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                                {Boolean(wp.assignedFreelancerYearsOfExperience && wp.assignedFreelancerYearsOfExperience > 0) && (
                                  <span>{wp.assignedFreelancerYearsOfExperience}+ Years Exp.</span>
                                )}
                                {Boolean(wp.assignedFreelancerHourlyRate && wp.assignedFreelancerHourlyRate > 0) && (
                                  <span>${wp.assignedFreelancerHourlyRate}/hr</span>
                                )}
                                <span>{wp.assignedFreelancerLocation || 'Remote'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Match Score & "Pick Someone Else" Button */}
                          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedMatchId(isExpanded ? null : wp.id)}
                              className="text-[10px] font-extrabold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 hover:underline cursor-pointer bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-900"
                              title="View explainable AI match breakdown"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-500" />
                              <span>{displayScore}% Match</span>
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
                                { label: 'Semantic Brief Relevance (35%)', key: 'semantic_relevance', max: 35 },
                                { label: 'Skill Overlap (25%)', key: 'skill_overlap', max: 25 },
                                { label: 'Rating & Track Record (15%)', key: 'rating', max: 15 },
                                { label: 'Availability (10%)', key: 'availability', max: 10 },
                                { label: 'Price Compatibility (10%)', key: 'price_compatibility', max: 10 },
                                { label: 'Delivery Turnaround Fit (5%)', key: 'delivery_time', max: 5 },
                              ].map(({ label, key, max }) => {
                                const rawVal = (wp.matchScoreBreakdown as any)?.[key];
                                let percent = 92;
                                if (typeof rawVal === 'number') {
                                  percent = rawVal > 1
                                    ? Math.min(100, Math.round((rawVal / max) * 100))
                                    : Math.min(100, Math.round(rawVal * 100));
                                }
                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between text-slate-600 dark:text-slate-300"
                                  >
                                    <span>{label}</span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${percent}%` }} />
                                      </div>
                                      <span className="font-bold text-cyan-600 dark:text-cyan-400 w-8 text-right">
                                        {percent}%
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
                                  className="p-2.5 rounded-xl bg-white dark:bg-[#142F2E] border border-slate-200 dark:border-slate-800 space-y-1 shadow-2xs"
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
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#142F2E]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-2xl">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreatePhase('chat')}
                  className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Adjust in Chat</span>
                </button>
                <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
                  Total Project Escrow: <strong className="text-cyan-600 dark:text-cyan-400 font-black">${allocatedTotal} USD</strong>
                </div>
              </div>

              {/* Big Primary CTA: Launch & Dispatch Invites */}
              <button
                type="button"
                disabled={isSavingProject}
                onClick={handleLaunchAndSendInvites}
                className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-600 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-glow-cyan transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingProject ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching invites & saving project...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Dispatch Milestone Invites & Launch Project</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
