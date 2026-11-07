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
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    role: { type: String, enum: ['merchant', 'freelancer'], default: 'merchant', required: true },
    category: { type: String, enum: ['dev', 'designer', 'marketer'], required: false },
    title: { type: String, default: '' },
    hourlyRate: { type: Number, default: 50 },
    bio: { type: String, default: '' },
    paypalEmail: { type: String, default: '' },
    skills: [{ type: String }],
    rating: { type: Number, default: 5.0 },
    completedProjects: { type: Number, default: 0 },
    pastProjects: [PastProjectSchema],
    availability: { type: String, enum: ['available', 'busy'], default: 'available' },
  },
  { timestamps: true }
);

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
