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
  status: 'Pending' | 'In Progress' | 'Completed' | 'Revision Requested';
  deliverableLink?: string;
  deliverableNotes?: string;
  progressUpdates?: IProgressUpdate[];
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
  status: 'draft' | 'funded' | 'completed';
  paypalOrderId?: string;
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
    senderRole: { type: String, enum: ['merchant', 'freelancer'], required: true },
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
    enum: ['Pending', 'In Progress', 'Completed', 'Revision Requested'],
    default: 'Pending',
  },
  deliverableLink: { type: String },
  deliverableNotes: { type: String },
  progressUpdates: [ProgressUpdateSchema],
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
      enum: ['draft', 'funded', 'completed'],
      default: 'draft',
    },
    paypalOrderId: { type: String },
  },
  { timestamps: true }
);

export const ProjectModel: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>('Project', ProjectSchema);
