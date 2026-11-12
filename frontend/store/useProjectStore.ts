import { create } from 'zustand';
import { WorkPackage, ProjectProposal, IAiAnalysis } from '@/types';

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export type CreatePhase = 'prompt' | 'chat' | 'results' | 'checkout';

interface ProjectState {
  // Existing fields - DO NOT REMOVE
  prompt: string;
  budget: number;
  isAnalyzing: boolean;
  currentStep: 1 | 2 | 3; // kept for backward compatibility
  workPackages: WorkPackage[];
  proposal: ProjectProposal | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed';
  paypalOrderId: string | null;
  aiAnalysis: IAiAnalysis | null;
  dependencyPlan: Record<string, string[]> | null;
  assumptions: string[];
  risks: string[];

  // NEW fields for conversational flow
  createPhase: CreatePhase;
  chatMessages: ChatMessage[];
  selectedFreelancers: Record<string, any>; // keyed by work package id

  // Existing actions
  setPrompt: (prompt: string) => void;
  setBudget: (budget: number) => void;
  setCurrentStep: (step: 1 | 2 | 3) => void;
  setAnalyzing: (loading: boolean) => void;
  setWorkPackages: (packages: WorkPackage[], extraMeta?: Partial<ProjectProposal>) => void;
  setAiMetadata: (metadata: {
    aiAnalysis?: IAiAnalysis;
    dependencyPlan?: Record<string, string[]>;
    assumptions?: string[];
    risks?: string[];
  }) => void;
  updatePackagePrice: (packageId: string, newPrice: number) => void;
  setPaymentStatus: (status: 'idle' | 'processing' | 'success' | 'failed', orderId?: string) => void;
  resetDraft: () => void;

  // NEW actions
  setCreatePhase: (phase: CreatePhase) => void;
  addChatMessage: (message: ChatMessage) => void;
  setSelectedFreelancer: (packageId: string, freelancer: any) => void;
  resetChat: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  prompt: '',
  budget: 0,
  isAnalyzing: false,
  currentStep: 1,
  workPackages: [],
  proposal: null,
  paymentStatus: 'idle',
  paypalOrderId: null,
  aiAnalysis: null,
  dependencyPlan: null,
  assumptions: [],
  risks: [],
  createPhase: 'prompt',
  chatMessages: [],
  selectedFreelancers: {},

  setPrompt: (prompt) => set({ prompt }),
  setBudget: (budget) => set({ budget }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setAiMetadata: ({ aiAnalysis, dependencyPlan, assumptions, risks }) => {
    set((state) => ({
      aiAnalysis: aiAnalysis !== undefined ? aiAnalysis : state.aiAnalysis,
      dependencyPlan: dependencyPlan !== undefined ? dependencyPlan : state.dependencyPlan,
      assumptions: assumptions !== undefined ? assumptions : state.assumptions,
      risks: risks !== undefined ? risks : state.risks,
    }));
  },

  setWorkPackages: (workPackages, extraMeta = {}) => {
    const allocatedTotal = workPackages.reduce((sum, wp) => sum + (wp.allocatedPrice || 0), 0);
    const budget = get().budget;
    const prompt = get().prompt;

    const proposal: ProjectProposal = {
      merchantId: '',
      merchantName: '',
      merchantEmail: '',
      projectName: extraMeta.projectName || get().proposal?.projectName || 'New Launch Project',
      merchantPrompt: prompt,
      totalBudget: budget,
      allocatedTotal,
      savings: Math.max(0, budget - allocatedTotal),
      workPackages,
      status: 'draft',
      createdAt: new Date().toISOString(),
      aiAnalysis: extraMeta.aiAnalysis || get().aiAnalysis || undefined,
      dependencyPlan: extraMeta.dependencyPlan || get().dependencyPlan || undefined,
      assumptions: extraMeta.assumptions || get().assumptions,
      risks: extraMeta.risks || get().risks,
    };

    set({ workPackages, proposal });
  },

  updatePackagePrice: (packageId, newPrice) => {
    const updated = get().workPackages.map((wp) =>
      wp.id === packageId ? { ...wp, allocatedPrice: newPrice } : wp
    );
    get().setWorkPackages(updated);
  },

  setPaymentStatus: (paymentStatus, paypalOrderId) => {
    set({ paymentStatus, paypalOrderId: paypalOrderId || null });
  },

  setCreatePhase: (createPhase) => set({ createPhase }),

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  setSelectedFreelancer: (packageId, freelancer) =>
    set((state) => ({
      selectedFreelancers: { ...state.selectedFreelancers, [packageId]: freelancer },
    })),

  resetChat: () => set({ chatMessages: [], createPhase: 'prompt' }),

  resetDraft: () => {
    set({
      prompt: '',
      budget: 0,
      isAnalyzing: false,
      currentStep: 1,
      workPackages: [],
      proposal: null,
      paymentStatus: 'idle',
      paypalOrderId: null,
      aiAnalysis: null,
      dependencyPlan: null,
      assumptions: [],
      risks: [],
      createPhase: 'prompt',
      chatMessages: [],
      selectedFreelancers: {},
    });
  },
}));
