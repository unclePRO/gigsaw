/**
 * GigSaw AI Client
 * 
 * Typed API bridge communicating with the Python FastAPI microservice (port 8001).
 * Gracefully handles timeouts and fallbacks.
 */

import {
  IAiAnalysis,
  IAiBudgetPlan,
  IAiCounterofferAnalysis,
  IAiInvoiceDraft,
  IAiProgressSummary,
} from '@/types';

const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_MICROSERVICE_URL || 'http://localhost:8001';

async function fetchFromAi<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  const url = `${AI_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[AI Client] Error calling ${path}: HTTP ${res.status}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[AI Client] Failed to reach ${path}:`, err.message || err);
    return null;
  }
}

export interface ProjectAnalyzeResponse {
  analysis: IAiAnalysis;
  budget: { amount: string; currency: string; pricing_status: string } | null;
  budget_plan: IAiBudgetPlan | null;
  work_packages: {
    work_package_id: string;
    name: string;
    service_category: string;
    description: string;
    required_skills: string[];
    deliverables: string[];
    dependencies: string[];
    estimated_days: number;
  }[];
  dependency_plan: Record<string, string[]>;
}

export interface FreelancerMatchItem {
  freelancer: any;
  score: number;
  score_breakdown: {
    semantic_relevance?: number;
    skill_overlap?: number;
    rating?: number;
    availability?: number;
    price_compatibility?: number;
    delivery_time?: number;
  };
  reasons: string[];
}

export interface FreelancerMatchResponse {
  matches: FreelancerMatchItem[];
  search_note?: string;
}

export const aiClient = {
  /**
   * Check if the FastAPI service and databases are online
   */
  async checkHealth() {
    return fetchFromAi<{
      status: string;
      environment: string;
      ai_provider: string;
      databases: Record<string, string>;
    }>('/api/v1/health', { method: 'GET' });
  },

  /**
   * Analyze high-level customer prompt, decompose into work packages, and compute budget plan
   */
  async analyzeProject(params: {
    customer_request: string;
    budget: number | string;
    currency?: string;
    project_name?: string;
  }): Promise<ProjectAnalyzeResponse | null> {
    return fetchFromAi<ProjectAnalyzeResponse>('/api/v1/projects/analyze', {
      method: 'POST',
      body: JSON.stringify({
        customer_request: params.customer_request,
        budget: params.budget.toString(),
        currency: params.currency || 'USD',
        project_name: params.project_name,
      }),
    });
  },

  /**
   * Explainable 6-factor freelancer matching
   */
  async matchFreelancers(params: {
    service_category: string;
    required_skills: string[];
    brief: string;
    budget?: number;
    max_delivery_days?: number;
    limit?: number;
  }): Promise<FreelancerMatchResponse | null> {
    return fetchFromAi<FreelancerMatchResponse>('/api/v1/matching/freelancers', {
      method: 'POST',
      body: JSON.stringify({
        service_category: params.service_category,
        required_skills: params.required_skills,
        brief: params.brief,
        budget: params.budget ? params.budget.toString() : undefined,
        max_delivery_days: params.max_delivery_days,
        limit: params.limit || 3,
      }),
    });
  },

  /**
   * Analyze counteroffer schedule and budget variance
   */
  async analyzeCounteroffer(params: {
    original_quotation: {
      quotation_id: string;
      freelancer_id: string;
      work_package_id: string;
      amount: string | number;
      delivery_days: number;
      scope: string;
      status: string;
    };
    proposed_amount: string | number;
    proposed_delivery_days: number;
    message: string;
    project_budget_remaining?: string | number;
  }): Promise<IAiCounterofferAnalysis | null> {
    return fetchFromAi<IAiCounterofferAnalysis>('/api/v1/proposals/counteroffer/analyze', {
      method: 'POST',
      body: JSON.stringify({
        original_quotation: {
          ...params.original_quotation,
          amount: params.original_quotation.amount.toString(),
        },
        proposed_amount: params.proposed_amount.toString(),
        proposed_delivery_days: params.proposed_delivery_days,
        message: params.message,
        project_budget_remaining: params.project_budget_remaining
          ? params.project_budget_remaining.toString()
          : undefined,
      }),
    });
  },

  /**
   * Draft itemized PayPal invoice for finished deliverable
   */
  async createInvoiceDraft(params: {
    quotation: {
      quotation_id: string;
      freelancer_id: string;
      work_package_id: string;
      amount: string | number;
      delivery_days: number;
      scope: string;
      status: string;
    };
    client_name: string;
    freelancer_name: string;
    invoice_number: string;
    tax_rate_percent?: string | number;
  }): Promise<IAiInvoiceDraft | null> {
    return fetchFromAi<IAiInvoiceDraft>('/api/v1/freelancer-assistant/invoice-draft', {
      method: 'POST',
      body: JSON.stringify({
        quotation: {
          ...params.quotation,
          amount: params.quotation.amount.toString(),
        },
        client_name: params.client_name,
        freelancer_name: params.freelancer_name,
        invoice_number: params.invoice_number,
        tax_rate_percent: params.tax_rate_percent ? params.tax_rate_percent.toString() : '0',
      }),
    });
  },

  /**
   * Summarize project progress, calculate completion %, and identify blockers
   */
  async getProgressSummary(params: {
    project_name: string;
    tasks: {
      work_package_id: string;
      name: string;
      status: 'not_started' | 'in_progress' | 'blocked' | 'completed';
      due_date?: string;
      blocker?: string;
    }[];
  }): Promise<IAiProgressSummary | null> {
    return fetchFromAi<IAiProgressSummary>('/api/v1/projects/progress-summary', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
