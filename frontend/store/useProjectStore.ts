import { create } from 'zustand';
import { WorkPackage, ProjectProposal, IAiAnalysis } from '@/types';

interface ProjectState {
  prompt: string;
  budget: number;
  isAnalyzing: boolean;
  currentStep: 1 | 2 | 3;
  workPackages: WorkPackage[];
  proposal: ProjectProposal | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed';
  paypalOrderId: string | null;
  // Extended AI metadata
  aiAnalysis: IAiAnalysis | null;
  dependencyPlan: Record<string, string[]> | null;
  assumptions: string[];
  risks: string[];

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
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  prompt: '',
  budget: 1500,
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

  resetDraft: () => {
    set({
      prompt: '',
      budget: 1500,
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
    });
  },
}));
