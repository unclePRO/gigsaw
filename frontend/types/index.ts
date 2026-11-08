export type FreelancerCategory = 'dev' | 'designer' | 'marketer' | string;
export type UserRole = 'merchant' | 'freelancer';

export interface IPastProject {
  title: string;
  description: string;
  projectUrl?: string;
  technologies: string[];
  completionDate?: string;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  category?: FreelancerCategory;
  title?: string;
  hourlyRate?: number;
  bio?: string;
  paypalEmail?: string;
  skills?: string[];
  rating?: number;
  completedProjects?: number;
  pastProjects?: IPastProject[];
  availability?: 'available' | 'busy';
  // AI Integration Fields (optional for backward compatibility)
  serviceCategories?: string[];
  yearsOfExperience?: number;
  typicalDeliveryDays?: number;
  indicativeProjectPrice?: number;
  location?: string;
  priceBasis?: 'hour' | 'project';
  createdAt?: string;
  updatedAt?: string;
}

export interface IProgressUpdate {
  id: string;
  message: string;
  authorName: string;
  authorRole: string;
  timestamp: string;
}

export interface IChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: UserRole;
  message: string;
  timestamp: string;
}

export interface IAiScoreBreakdown {
  semantic_relevance?: number;
  skill_overlap?: number;
  rating?: number;
  availability?: number;
  price_compatibility?: number;
  delivery_time?: number;
}

export interface WorkPackage {
  id: string;
  category: FreelancerCategory;
  roleName?: string;
  title: string;
  description: string;
  allocatedPrice: number;
  dependencies?: string[];
  dependencyNames?: string[];
  assignedFreelancerId?: string;
  assignedFreelancerName?: string;
  assignedFreelancerEmail?: string;
  inviteStatus?: 'invited' | 'accepted' | 'declined';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Revision Requested';
  deliverableLink?: string;
  deliverableNotes?: string;
  progressUpdates?: IProgressUpdate[];
  // AI Integration Fields
  requiredSkills?: string[];
  deliverables?: string[];
  estimatedDays?: number;
  currency?: string;
  quotationAmount?: number;
  quotationCurrency?: string;
  quotationDeliveryDays?: number;
  quotationScope?: string;
  quotationStatus?: 'pending' | 'accepted' | 'declined' | 'counteroffer';
  // Explainable AI Match Data
  matchScore?: number;
  matchScoreBreakdown?: IAiScoreBreakdown;
  matchReasons?: string[];
}

export interface IAiAnalysis {
  project_name: string;
  business_goal: string;
  summary: string;
  required_services: string[];
  assumptions: string[];
  risks: string[];
}

export interface IAiBudgetAllocation {
  service_category: string;
  allocated_amount: string | number;
  percentage?: number;
}

export interface IAiBudgetPlan {
  allocated_total: string | number;
  currency: string;
  allocations: IAiBudgetAllocation[];
}

export interface ProjectProposal {
  _id?: string;
  id?: string;
  merchantId: string;
  merchantName: string;
  merchantEmail: string;
  projectName: string;
  merchantPrompt: string;
  totalBudget: number;
  allocatedTotal: number;
  savings: number;
  workPackages: WorkPackage[];
  messages?: IChatMessage[];
  status: 'draft' | 'funded' | 'completed';
  paypalOrderId?: string;
  createdAt: string;
  // Extended AI metadata
  aiAnalysis?: IAiAnalysis;
  dependencyPlan?: Record<string, string[]>;
  assumptions?: string[];
  risks?: string[];
}

export interface IServiceCatalog {
  _id?: string;
  serviceId: string;
  category: string;
  description: string;
  baselinePrice: number;
  minimumPrice: number;
  maximumPrice: number;
  currency: string;
  managedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IAiCounterofferAnalysis {
  amount_delta: number;
  percentage_delta: number;
  delivery_days_delta: number;
  budget_impact: string;
  recommendation: string;
  approval_required: boolean;
}

export interface IAiInvoiceDraft {
  invoice_number: string;
  client_name: string;
  freelancer_name: string;
  currency: string;
  line_items: { description: string; amount: string }[];
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  payment_note: string;
  disclaimer: string;
}

export interface IAiProgressSummary {
  project_name: string;
  completion_percentage: number;
  completed_count: number;
  in_progress_count: number;
  blocked_tasks: string[];
  overdue_tasks: string[];
  summary: string;
  recommended_actions: string[];
}
