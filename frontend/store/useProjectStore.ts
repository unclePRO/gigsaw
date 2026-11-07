import { create } from 'zustand';
import { WorkPackage, ProjectProposal } from '@/types';

interface ProjectState {
  prompt: string;
  budget: number;
  isAnalyzing: boolean;
  currentStep: 1 | 2 | 3;
  workPackages: WorkPackage[];
  proposal: ProjectProposal | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed';
  paypalOrderId: string | null;

  setPrompt: (prompt: string) => void;
  setBudget: (budget: number) => void;
  setCurrentStep: (step: 1 | 2 | 3) => void;
  setAnalyzing: (loading: boolean) => void;
  setWorkPackages: (packages: WorkPackage[]) => void;
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

  setPrompt: (prompt) => set({ prompt }),
  setBudget: (budget) => set({ budget }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setWorkPackages: (workPackages) => {
    const allocatedTotal = workPackages.reduce((sum, wp) => sum + (wp.allocatedPrice || 0), 0);
    const budget = get().budget;
    const prompt = get().prompt;

    const proposal: ProjectProposal = {
      merchantId: '',
      merchantName: '',
      merchantEmail: '',
      projectName: 'New Launch Project',
      merchantPrompt: prompt,
      totalBudget: budget,
      allocatedTotal,
      savings: Math.max(0, budget - allocatedTotal),
      workPackages,
      status: 'draft',
      createdAt: new Date().toISOString(),
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
    });
  },
}));
