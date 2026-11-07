import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IServiceCatalogDocument extends Document {
  serviceId: string;
  category: string;
  description: string;
  baselinePrice: number;
  minimumPrice: number;
  maximumPrice: number;
  currency: string;
  managedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const STANDARD_AI_SERVICES = [
  'website development',
  'logo and branding',
  'graphic design',
  'social media creatives',
  'food photography',
  'digital menu design',
  'social media management',
  'digital marketing',
] as const;

export type StandardAiService = (typeof STANDARD_AI_SERVICES)[number];

const ServiceCatalogSchema = new Schema<IServiceCatalogDocument>(
  {
    serviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    baselinePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    maximumPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },
    managedBy: {
      type: String,
      default: 'gigsaw-ai',
      trim: true,
    },
  },
  {
    collection: 'ai_service_catalog',
    timestamps: true,
  }
);

export const ServiceCatalogModel: Model<IServiceCatalogDocument> =
  mongoose.models.ServiceCatalog ||
  mongoose.model<IServiceCatalogDocument>('ServiceCatalog', ServiceCatalogSchema, 'ai_service_catalog');
