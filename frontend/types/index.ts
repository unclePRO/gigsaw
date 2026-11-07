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
  // AI Integration Fields (optional for backward compatibility)
  requiredSkills?: string[];
  deliverables?: string[];
  estimatedDays?: number;
  currency?: string;
  quotationAmount?: number;
  quotationCurrency?: string;
  quotationDeliveryDays?: number;
  quotationScope?: string;
  quotationStatus?: 'pending' | 'accepted' | 'declined' | 'counteroffer';
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
