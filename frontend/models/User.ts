import mongoose, { Schema, Document, Model } from 'mongoose';
import { FreelancerCategory, UserRole } from '@/types';

export interface IPastProject {
  title: string;
  description: string;
  projectUrl?: string;
  technologies: string[];
  completionDate?: string;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  category?: FreelancerCategory;
  title?: string;
  hourlyRate?: number;
  bio?: string;
  paypalEmail?: string;
  skills: string[];
  rating: number;
  completedProjects: number;
  pastProjects: IPastProject[];
  availability?: 'available' | 'busy';

  // AI Service Integration Fields (Optional for backward compatibility)
  serviceCategories?: string[];
  yearsOfExperience?: number;
  typicalDeliveryDays?: number;
  indicativeProjectPrice?: number;
  location?: string;
  priceBasis?: 'hour' | 'project';
  isProfileComplete?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PastProjectSchema = new Schema<IPastProject>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    projectUrl: { type: String },
    technologies: [{ type: String }],
    completionDate: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    // Preserved unique index for email
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    role: { type: String, enum: ['merchant', 'freelancer'], default: 'merchant', required: true },
    category: { type: String, enum: ['dev', 'designer', 'marketer'], required: false },
    title: { type: String, default: '' },
    hourlyRate: { type: Number },
    bio: { type: String, default: '' },
    paypalEmail: { type: String, default: '' },
    skills: [{ type: String }],
    rating: { type: Number, default: 0 },
    completedProjects: { type: Number, default: 0 },
    pastProjects: [PastProjectSchema],
    availability: { type: String, enum: ['available', 'busy'], default: 'available' },
    isProfileComplete: { type: Boolean, default: false },

    // AI Integration Fields
    serviceCategories: [{ type: String }],
    yearsOfExperience: { type: Number },
    typicalDeliveryDays: { type: Number },
    indicativeProjectPrice: { type: Number },
    location: { type: String, default: '' },
    priceBasis: { type: String, enum: ['hour', 'project'], default: 'hour' },
  },
  { timestamps: true }
);

// Non-unique compound index for fast talent matching by the AI Service
UserSchema.index({ role: 1, availability: 1, category: 1 });

// Index for specific detailed service lookups
UserSchema.index({ serviceCategories: 1 });

/**
 * Public projection for AI service consumption.
 * Strictly excludes sensitive fields (password, email, paypalEmail).
 */
export const AI_SAFE_USER_FIELDS =
  '_id name title bio category serviceCategories skills rating hourlyRate indicativeProjectPrice yearsOfExperience typicalDeliveryDays location availability priceBasis completedProjects pastProjects';

export function sanitizeUserForAi(user: Partial<IUserDocument> | any) {
  if (!user) return null;
  return {
    id: user._id?.toString() || user.id,
    name: user.name,
    title: user.title || '',
    bio: user.bio || '',
    category: user.category,
    serviceCategories: user.serviceCategories || [],
    skills: user.skills || [],
    rating: user.rating ?? 0,
    hourlyRate: user.hourlyRate ?? 0,
    indicativeProjectPrice: user.indicativeProjectPrice,
    yearsOfExperience: user.yearsOfExperience,
    typicalDeliveryDays: user.typicalDeliveryDays,
    location: user.location || '',
    availability: user.availability || 'available',
    priceBasis: user.priceBasis || 'hour',
    completedProjects: user.completedProjects ?? 0,
    pastProjects: user.pastProjects || [],
    isProfileComplete: Boolean(user.isProfileComplete),
  };
}

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
