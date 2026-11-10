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

export class AiClientError extends Error {
  status: number;
  retryable?: boolean;
  retryAfterSeconds?: number;
  payload?: any;

  constructor(message: string, status: number = 500, payload?: any) {
    super(message);
    this.name = 'AiClientError';
    this.status = status;
    this.payload = payload;
    this.retryable = payload?.retryable ?? (status === 503);
    this.retryAfterSeconds = payload?.retry_after_seconds ?? 5;
  }
}

async function fetchFromAi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${AI_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      let errorBody: any = null;
      try {
        errorBody = await res.json();
      } catch {}
      const errMsg =
        errorBody?.message ||
        errorBody?.detail ||
        (res.status === 503
          ? 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.'
          : `AI Microservice Error (HTTP ${res.status})`);
      console.warn(`[AI Client] Error calling ${path}: HTTP ${res.status} - ${errMsg}`);
      throw new AiClientError(errMsg, res.status, errorBody);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof AiClientError) {
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new AiClientError(
        'AI assistant request timed out. Please wait a few seconds and retry.',
        504
      );
    }
    throw new AiClientError(
      err.message || 'AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry.',
      503
    );
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

export interface ScopingChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ProjectScopingChatRequest {
  initial_goal: string;
  messages: ScopingChatMessage[];
  current_budget?: number;
  currency?: string;
  extracted_spec?: Record<string, string>;
  project_name?: string;
}

export interface ProjectScopingChatResponse {
  reply: string;
  clarifying_question?: string | null;
  suggested_replies: string[];
  extracted_spec: Record<string, string>;
  completeness_score: number;
  is_ready_to_finalize: boolean;
  ready_for_decomposition: boolean;
  recommended_action: 'continue_asking' | 'ready_to_finalize';
  project_name?: string | null;
  current_budget?: string | number | null;
  currency?: string;
  budget_changed?: boolean;
}

export interface ProjectScopingFinalizeRequest {
  initial_goal: string;
  messages: ScopingChatMessage[];
  extracted_spec?: Record<string, string>;
  budget?: number;
  currency?: string;
  project_name?: string;
  auto_decompose?: boolean;
}

export interface ProjectScopingFinalizeResponse {
  project_name: string;
  enriched_brief: string;
  detected_services: string[];
  suggested_budget?: number;
  budget?: string | number | null;
  currency: string;
  extracted_spec: Record<string, string>;
  analysis_result?: ProjectAnalyzeResponse | null;
  freelancer_matches?: Array<{
    work_package_id: string;
    service_category: string;
    allocated_amount?: string | number | null;
    match_result: FreelancerMatchResponse;
  }>;
}

export interface FreelancerSwapRequest {
  work_package_id?: string;
  service_category: string;
  required_skills?: string[];
  brief?: string;
  budget?: number;
  max_delivery_days?: number;
  current_freelancer_id: string;
  exclude_freelancer_ids?: string[];
}

export interface FreelancerSwapResponse {
  swapped: boolean;
  work_package_id?: string;
  previous_freelancer_id: string;
  new_match: FreelancerMatchItem | null;
  message: string;
}

export interface RoomMember {
  name: string;
  role: 'merchant' | 'freelancer' | 'ai_assistant';
  package_title?: string;
  freelancer_id?: string;
}

export interface RoomMessage {
  sender: string;
  role: 'merchant' | 'freelancer' | 'ai_assistant';
  text: string;
  timestamp?: string;
}

export interface ProjectChatRoomAssistRequest {
  project_id?: string;
  project_name: string;
  merchant_name?: string;
  members: RoomMember[];
  messages: RoomMessage[];
  action: 'kickoff' | 'summarize' | 'action_items' | 'mediate_scope';
}

export interface ChatActionItem {
  task: string;
  assignee: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface ProjectChatRoomAssistResponse {
  action: string;
  message: string;
  action_items: ChatActionItem[];
  summary?: string | null;
}

export interface FreelancerInvitationReviewRequest {
  freelancer_id: string;
  project_name: string;
  merchant_name?: string;
  work_package_title: string;
  service_category: string;
  description: string;
  deliverables?: string[];
  allocated_price: number;
  estimated_days: number;
  currency?: string;
}

export interface FreelancerInvitationReviewResponse {
  feasibility_score: number;
  feasibility_assessment: 'high' | 'moderate' | 'low';
  market_rate_evaluation: string;
  estimated_hours: number;
  pros: string[];
  watchouts: string[];
  suggested_decision: 'accept' | 'counteroffer' | 'request_clarification';
  recommended_counteroffer_amount?: number | null;
  recommended_counteroffer_days?: number | null;
  counteroffer_rationale?: string | null;
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

  /**
   * Interactive conversational scoping chat for merchant create flow
   */
  async scopingChat(params: ProjectScopingChatRequest): Promise<ProjectScopingChatResponse> {
    return fetchFromAi<ProjectScopingChatResponse>('/api/v1/projects/scoping/chat', {
      method: 'POST',
      body: JSON.stringify({
        initial_goal: params.initial_goal,
        messages: params.messages,
        current_budget: params.current_budget != null ? params.current_budget.toString() : undefined,
        currency: params.currency || 'USD',
        extracted_spec: params.extracted_spec || {},
      }),
    });
  },

  /**
   * Finalize scoping conversation and automatically trigger project decomposition
   */
  async scopingFinalize(params: ProjectScopingFinalizeRequest): Promise<ProjectScopingFinalizeResponse> {
    return fetchFromAi<ProjectScopingFinalizeResponse>('/api/v1/projects/scoping/finalize', {
      method: 'POST',
      body: JSON.stringify({
        initial_goal: params.initial_goal,
        messages: params.messages,
        extracted_spec: params.extracted_spec || {},
        budget: params.budget != null ? params.budget.toString() : undefined,
        currency: params.currency || 'USD',
        project_name: params.project_name,
        auto_decompose: params.auto_decompose ?? true,
      }),
    });
  },

  /**
   * Swap out matched freelancer for an alternative AI-ranked specialist
   */
  async swapFreelancer(params: FreelancerSwapRequest): Promise<FreelancerSwapResponse | null> {
    return fetchFromAi<FreelancerSwapResponse>('/api/v1/matching/freelancers/swap', {
      method: 'POST',
      body: JSON.stringify({
        work_package_id: params.work_package_id,
        service_category: params.service_category,
        required_skills: params.required_skills || [],
        brief: params.brief || '',
        budget: params.budget != null ? params.budget.toString() : undefined,
        max_delivery_days: params.max_delivery_days,
        current_freelancer_id: params.current_freelancer_id,
        exclude_freelancer_ids: params.exclude_freelancer_ids || [],
      }),
    });
  },

  /**
   * Facilitate integrated group project chat room (kickoff, summarize, action items)
   */
  async chatRoomAssist(params: ProjectChatRoomAssistRequest): Promise<ProjectChatRoomAssistResponse> {
    return fetchFromAi<ProjectChatRoomAssistResponse>('/api/v1/chat-room/assist', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Explainable feasibility review for freelancer invitations
   */
  async reviewInvitation(params: FreelancerInvitationReviewRequest): Promise<FreelancerInvitationReviewResponse | null> {
    return fetchFromAi<FreelancerInvitationReviewResponse>('/api/v1/freelancer-assistant/invitation/review', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        allocated_price: params.allocated_price.toString(),
      }),
    });
  },
};
