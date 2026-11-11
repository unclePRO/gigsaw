import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReviewDocument extends Document {
  freelancerId: string;
  freelancerName: string;
  freelancerEmail: string;
  merchantId: string;
  merchantName: string;
  merchantEmail: string;
  projectId: string;
  projectName: string;
  packageId: string;
  packageTitle: string;
  category?: string;
  rating: number; // 1 to 5
  reviewText: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReviewDocument>(
  {
    freelancerId: { type: String, required: true, index: true },
    freelancerName: { type: String, required: true },
    freelancerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    merchantId: { type: String, required: true },
    merchantName: { type: String, required: true },
    merchantEmail: { type: String, required: true, lowercase: true, trim: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, required: true },
    packageId: { type: String, required: true },
    packageTitle: { type: String, required: true },
    category: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ freelancerEmail: 1, createdAt: -1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Review) {
  delete (mongoose.models as any).Review;
}

export const ReviewModel: Model<IReviewDocument> =
  mongoose.models.Review || mongoose.model<IReviewDocument>('Review', ReviewSchema);
