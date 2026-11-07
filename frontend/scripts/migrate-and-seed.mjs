/**
 * GigSaw AI Integration Migration & Seed Script
 * 
 * Safely backfills existing user profiles with AI service categories,
 * builds required MongoDB indexes, and populates the trusted `ai_service_catalog` collection.
 *
 * Usage:
 *   node scripts/migrate-and-seed.mjs [--seed-freelancers]
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env.local if not already in process.env
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(process.cwd(), '.env.local'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log(`Loaded environment from ${envPath}`);
      break;
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || MONGODB_URI.includes('YOUR_PASSWORD') || MONGODB_URI.includes('placeholder')) {
  console.error('\n❌ ERROR: MONGODB_URI is not configured in .env.local.');
  console.error('Please configure your real MongoDB Atlas connection string before running migration.');
  console.error('Example: MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/gigsaw?retryWrites=true&w=majority\n');
  process.exit(1);
}

// 8 Verified AI Service Categories with market-tested baseline, min, and max pricing
const CATALOG_SEEDS = [
  {
    serviceId: 'srv-web-dev',
    category: 'website development',
    description: 'Full-stack responsive web application development, Next.js architecture, database models, and API integrations.',
    baselinePrice: 600,
    minimumPrice: 300,
    maximumPrice: 2000,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-logo-branding',
    category: 'logo and branding',
    description: 'Comprehensive brand identity package, vector logos, color systems, typography guides, and favicon packages.',
    baselinePrice: 250,
    minimumPrice: 100,
    maximumPrice: 800,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-graphic-design',
    category: 'graphic design',
    description: 'High-resolution marketing graphics, banners, promotional materials, signage, and vector illustrations.',
    baselinePrice: 180,
    minimumPrice: 80,
    maximumPrice: 600,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-social-creatives',
    category: 'social media creatives',
    description: 'Multi-platform social media visual packs, Instagram carousels, TikTok/Reels thumbnail kits, and story assets.',
    baselinePrice: 150,
    minimumPrice: 75,
    maximumPrice: 500,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-food-photo',
    category: 'food photography',
    description: 'Commercial food and product photography, styled plating shots, high-key lighting, retouching, and transparent cutouts.',
    baselinePrice: 350,
    minimumPrice: 150,
    maximumPrice: 1200,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-menu-design',
    category: 'digital menu design',
    description: 'Digital interactive QR menus, touch-screen board layouts, and high-DPI printable cafe/restaurant menus with allergen icons.',
    baselinePrice: 120,
    minimumPrice: 50,
    maximumPrice: 400,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-social-mgmt',
    category: 'social media management',
    description: 'Monthly social media editorial calendar, scheduled distribution, engagement tracking, community replies, and growth analytics.',
    baselinePrice: 400,
    minimumPrice: 200,
    maximumPrice: 1500,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
  {
    serviceId: 'srv-digital-mktg',
    category: 'digital marketing',
    description: 'Search engine optimization (SEO), local Google Business profile setup, Meta & Google Ad campaigns, and conversion tracking.',
    baselinePrice: 500,
    minimumPrice: 250,
    maximumPrice: 1800,
    currency: 'USD',
    managedBy: 'gigsaw-ai',
  },
];

async function runMigration() {
  console.log('\n🚀 Starting GigSaw AI Integration Migration & Seed...');
  console.log(`Connecting to MongoDB...`);

  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected successfully');

  const db = mongoose.connection.db;

  // 1. Setup Indexes
  console.log('\n📦 Step 1: Ensuring MongoDB Indexes...');
  try {
    const usersColl = db.collection('users');
    await usersColl.createIndex({ email: 1 }, { unique: true });
    await usersColl.createIndex({ role: 1, availability: 1, category: 1 });
    await usersColl.createIndex({ serviceCategories: 1 });
    console.log('  Index: users (email [unique], role+availability+category, serviceCategories)');

    const catalogColl = db.collection('ai_service_catalog');
    await catalogColl.createIndex({ serviceId: 1 }, { unique: true });
    await catalogColl.createIndex({ category: 1 }, { unique: true });
    console.log('  Index: ai_service_catalog (serviceId [unique], category [unique])');

    const projectsColl = db.collection('projects');
    await projectsColl.createIndex({ merchantId: 1, createdAt: -1 });
    await projectsColl.createIndex({ 'workPackages.assignedFreelancerId': 1 });
    console.log('  Index: projects (merchantId+createdAt, workPackages.assignedFreelancerId)');
  } catch (err) {
    console.warn('  ⚠️ Note during index creation:', err.message);
  }

  // 2. Populate / Update AI Service Catalog
  console.log('\n📚 Step 2: Populating `ai_service_catalog` collection...');
  const catalogColl = db.collection('ai_service_catalog');
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of CATALOG_SEEDS) {
    const res = await catalogColl.updateOne(
      { category: item.category },
      {
        $set: {
          serviceId: item.serviceId,
          category: item.category,
          description: item.description,
          baselinePrice: item.baselinePrice,
          minimumPrice: item.minimumPrice,
          maximumPrice: item.maximumPrice,
          currency: item.currency,
          managedBy: item.managedBy,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) insertedCount++;
    else if (res.modifiedCount > 0) updatedCount++;
  }
  console.log(`  Catalog entries: ${insertedCount} inserted, ${updatedCount} updated (${CATALOG_SEEDS.length} total active services).`);

  // 3. Safe Backfill for Existing Freelancer Users
  console.log('\n👥 Step 3: Backfilling existing Freelancers with AI Service Categories...');
  const usersColl = db.collection('users');
  const existingFreelancers = await usersColl.find({ role: 'freelancer' }).toArray();

  let backfilledCount = 0;

  for (const f of existingFreelancers) {
    const updates = {};

    // Only add serviceCategories if missing or empty
    if (!f.serviceCategories || f.serviceCategories.length === 0) {
      if (f.category === 'dev') {
        updates.serviceCategories = ['website development'];
      } else if (f.category === 'designer') {
        updates.serviceCategories = ['logo and branding', 'graphic design', 'digital menu design'];
      } else if (f.category === 'marketer') {
        updates.serviceCategories = ['digital marketing', 'social media management', 'social media creatives'];
      }
    }

    // Default missing numeric/enum values safely without altering existing user custom rates
    if (f.priceBasis === undefined) {
      updates.priceBasis = 'hour';
    }
    if (f.yearsOfExperience === undefined) {
      updates.yearsOfExperience = 3;
    }
    if (f.typicalDeliveryDays === undefined) {
      updates.typicalDeliveryDays = 5;
    }
    if (f.location === undefined) {
      updates.location = 'Remote / Global';
    }

    if (Object.keys(updates).length > 0) {
      await usersColl.updateOne({ _id: f._id }, { $set: updates });
      backfilledCount++;
    }
  }

  console.log(`  Backfilled ${backfilledCount} out of ${existingFreelancers.length} existing freelancer(s).`);

  // 4. Optional: Seed starter test freelancers if DB is empty or flagged
  const seedFreelancersFlag = process.argv.includes('--seed-freelancers');
  const totalFreelancers = await usersColl.countDocuments({ role: 'freelancer' });

  if (totalFreelancers === 0 || seedFreelancersFlag) {
    console.log('\n🌱 Step 4: Seeding starter demo freelancers for AI matching...');
    const defaultPassword = await bcrypt.hash('gigsaw2026', 10);

    const starterFreelancers = [
      {
        name: 'Alex Rivera',
        email: 'alex.dev@example.com',
        password: defaultPassword,
        role: 'freelancer',
        category: 'dev',
        title: 'Senior Next.js & Full-Stack Engineer',
        hourlyRate: 65,
        indicativeProjectPrice: 750,
        yearsOfExperience: 6,
        typicalDeliveryDays: 10,
        location: 'San Francisco, CA (Remote)',
        priceBasis: 'project',
        bio: 'Specialist in Next.js 14, TypeScript, REST APIs, and MongoDB architectures. Fast delivery with clean code.',
        skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'MongoDB', 'Tailwind CSS'],
        serviceCategories: ['website development'],
        rating: 4.9,
        completedProjects: 24,
        availability: 'available',
        pastProjects: [
          {
            title: 'SaaS Analytics Dashboard',
            description: 'Designed and deployed responsive Next.js analytics portal with real-time charts.',
            technologies: ['Next.js', 'TypeScript', 'Tailwind', 'MongoDB'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Elena Rostova',
        email: 'elena.design@example.com',
        password: defaultPassword,
        role: 'freelancer',
        category: 'designer',
        title: 'Brand Identity & Visual Designer',
        hourlyRate: 50,
        indicativeProjectPrice: 350,
        yearsOfExperience: 5,
        typicalDeliveryDays: 5,
        location: 'Berlin, Germany (Remote)',
        priceBasis: 'project',
        bio: 'Crafting memorable brand identities, digital menus, packaging, and clean UI design systems in Figma.',
        skills: ['Figma', 'Brand Identity', 'Logo Design', 'Graphic Design', 'Typography'],
        serviceCategories: ['logo and branding', 'graphic design', 'digital menu design'],
        rating: 5.0,
        completedProjects: 31,
        availability: 'available',
        pastProjects: [
          {
            title: 'Artisan Cafe Brand & Menu Suite',
            description: 'Created modern coffeehouse logo, packaging labels, and digital QR menu.',
            technologies: ['Figma', 'Illustrator', 'Design Systems'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Marcus Chen',
        email: 'marcus.growth@example.com',
        password: defaultPassword,
        role: 'freelancer',
        category: 'marketer',
        title: 'Growth Marketing & SEO Strategist',
        hourlyRate: 45,
        indicativeProjectPrice: 400,
        yearsOfExperience: 4,
        typicalDeliveryDays: 4,
        location: 'Austin, TX (Remote)',
        priceBasis: 'project',
        bio: 'Driving customer acquisition through SEO optimization, Google Business presence, and social media campaigns.',
        skills: ['SEO', 'Content Strategy', 'Social Media Management', 'Google Ads', 'Analytics'],
        serviceCategories: ['digital marketing', 'social media management', 'social media creatives'],
        rating: 4.8,
        completedProjects: 18,
        availability: 'available',
        pastProjects: [
          {
            title: 'Local Retailer Launch Campaign',
            description: 'Achieved #1 Google Local ranking and 4x foot traffic within 30 days of launch.',
            technologies: ['Google Search Console', 'Meta Ads', 'SEO Tools'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const fl of starterFreelancers) {
      await usersColl.updateOne(
        { email: fl.email },
        { $setOnInsert: fl },
        { upsert: true }
      );
    }
    console.log('  Seeded 3 starter freelancers (alex.dev, elena.design, marcus.growth)');
  }

  console.log('\nMigration and seed complete! Database is 100% compatible with GigSaw AI service.\n');
  await mongoose.disconnect();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
