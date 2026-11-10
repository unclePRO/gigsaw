import mongoose, { Schema, Document, Model } from 'mongoose';
import { FreelancerCategory, IChatMessage, IProgressUpdate } from '@/types';

export interface IWorkPackage {
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
  status: 'Pending' | 'In Progress' | 'Completed' | 'Revision Requested' | 'Cancelled';
  deliverableLink?: string;
  deliverableNotes?: string;
  progressUpdates?: IProgressUpdate[];

  // AI Integration Fields (Optional for backward compatibility)
  requiredSkills?: string[];
  deliverables?: string[];
  estimatedDays?: number;
  currency?: string;
  quotationAmount?: number;
  quotationCurrency?: string;
  quotationDeliveryDays?: number;
  quotationScope?: string;
  quotationStatus?: 'pending' | 'accepted' | 'declined' | 'counteroffer';
  matchScore?: number;
  matchScoreBreakdown?: Record<string, number>;
  matchReasons?: string[];
  assignedFreelancerBio?: string;
  assignedFreelancerSkills?: string[];
  assignedFreelancerRating?: number;
  assignedFreelancerCompletedProjects?: number;
  assignedFreelancerPastProjects?: any[];
  assignedFreelancerYearsOfExperience?: number;
  assignedFreelancerHourlyRate?: number;
  assignedFreelancerLocation?: string;
  closureRequested?: boolean;
  reviewSubmitted?: boolean;
  reviewRating?: number;
  reviewText?: string;
  reviewedAt?: Date;
}

export interface IProjectDocument extends Document {
  merchantId: string;
  merchantName: string;
  merchantEmail: string;
  projectName: string;
  merchantPrompt: string;
  totalBudget: number;
  allocatedTotal: number;
  savings: number;
  workPackages: IWorkPackage[];
  messages: IChatMessage[];
  status: 'draft' | 'ON_HOLD' | 'READY_TO_FUND' | 'funded' | 'FUNDED_IN_PROGRESS' | 'completed' | 'cancelled';
  paypalOrderId?: string;
  aiAnalysis?: any;
  dependencyPlan?: any;
  assumptions?: string[];
  risks?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProgressUpdateSchema = new Schema<IProgressUpdate>(
  {
    id: { type: String, required: true },
    message: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    id: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderEmail: { type: String, required: true },
    senderRole: { type: String, enum: ['merchant', 'freelancer', 'ai_assistant'], required: true },
    message: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const WorkPackageSchema = new Schema<IWorkPackage>({
  id: { type: String, required: true },
  category: { type: String, required: true },
  roleName: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  allocatedPrice: { type: Number, required: true },
  dependencies: [{ type: String }],
  dependencyNames: [{ type: String }],
  assignedFreelancerId: { type: String },
  assignedFreelancerName: { type: String },
  assignedFreelancerEmail: { type: String },
  inviteStatus: {
    type: String,
    enum: ['invited', 'accepted', 'declined'],
    default: 'invited',
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Revision Requested', 'Cancelled'],
    default: 'Pending',
  },
  deliverableLink: { type: String },
  deliverableNotes: { type: String },
  progressUpdates: [ProgressUpdateSchema],

  // AI Integration Fields
  requiredSkills: [{ type: String }],
  deliverables: [{ type: String }],
  estimatedDays: { type: Number },
  currency: { type: String, default: 'USD' },
  quotationAmount: { type: Number },
  quotationCurrency: { type: String, default: 'USD' },
  quotationDeliveryDays: { type: Number },
  quotationScope: { type: String },
  quotationStatus: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'counteroffer'],
  },
  matchScore: { type: Number },
  matchScoreBreakdown: { type: Schema.Types.Mixed },
  matchReasons: [{ type: String }],
  assignedFreelancerBio: { type: String },
  assignedFreelancerSkills: [{ type: String }],
  assignedFreelancerRating: { type: Number },
  assignedFreelancerCompletedProjects: { type: Number },
  assignedFreelancerPastProjects: [{ type: Schema.Types.Mixed }],
  assignedFreelancerYearsOfExperience: { type: Number },
  assignedFreelancerHourlyRate: { type: Number },
  assignedFreelancerLocation: { type: String },
  closureRequested: { type: Boolean, default: false },
  reviewSubmitted: { type: Boolean, default: false },
  reviewRating: { type: Number },
  reviewText: { type: String },
  reviewedAt: { type: Date },
});

const ProjectSchema = new Schema<IProjectDocument>(
  {
    merchantId: { type: String, required: true },
    merchantName: { type: String, required: true },
    merchantEmail: { type: String, required: true },
    projectName: { type: String, required: true },
    merchantPrompt: { type: String, required: true },
    totalBudget: { type: Number, required: true },
    allocatedTotal: { type: Number, required: true },
    savings: { type: Number, required: true },
    workPackages: [WorkPackageSchema],
    messages: [ChatMessageSchema],
    status: {
      type: String,
      enum: ['draft', 'ON_HOLD', 'READY_TO_FUND', 'funded', 'FUNDED_IN_PROGRESS', 'completed', 'cancelled'],
      default: 'ON_HOLD',
    },
    paypalOrderId: { type: String },
    aiAnalysis: { type: Schema.Types.Mixed },
    dependencyPlan: { type: Schema.Types.Mixed },
    assumptions: [{ type: String }],
    risks: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes for querying projects by merchant and assigned freelancers
ProjectSchema.index({ merchantId: 1, createdAt: -1 });
ProjectSchema.index({ 'workPackages.assignedFreelancerId': 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Project) {
  delete (mongoose.models as any).Project;
}

export const ProjectModel: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>('Project', ProjectSchema);
