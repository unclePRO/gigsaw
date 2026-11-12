/**
 * Seed 300 Freelancers into Gigsaw MongoDB
 * 
 * - 100 Developers (category: 'dev')
 * - 100 Designers (category: 'designer')
 * - 100 Marketers (category: 'marketer')
 * 
 * Specifications:
 * - Email for each ends with @test.com
 * - Password for all is 'freelancer' (hashed via bcrypt)
 * - Ratings range from very bad (1.1 - 2.4) to mediocre (2.5 - 3.6) to decent (3.7 - 4.4).
 *   No perfect accounts (max rating 4.4).
 * - All fields fully populated with wide diverse ranges for AI matchmaking.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env.local
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

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI not found in .env.local');
  process.exit(1);
}

// First & Last Name pools for realistic freelancer names
const FIRST_NAMES = [
  'Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore',
  'Mateo', 'Levi', 'Sebastian', 'Daniel', 'Jack', 'Alexander', 'Owen', 'Asher', 'Samuel', 'Ethan',
  'Leo', 'Jackson', 'Mason', 'Ezra', 'John', 'Hudson', 'Luca', 'David', 'Joseph', 'Julian',
  'Emma', 'Olivia', 'Amelia', 'Sophia', 'Charlotte', 'Ava', 'Isabella', 'Mia', 'Luna', 'Harper',
  'Evelyn', 'Gianna', 'Abigail', 'Ella', 'Emily', 'Chloe', 'Camila', 'Penelope', 'Aria', 'Layla',
  'Elena', 'Nora', 'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Claire',
  'Skylar', 'Lucy', 'Paisley', 'Everly', 'Anna', 'Caroline', 'Nova', 'Genesis', 'Emilia', 'Kennedy',
  'Samantha', 'Maya', 'Willow', 'Kinsley', 'Naomi', 'Aaliyah', 'Elena', 'Sarah', 'Ariana', 'Allison',
  'Gabriella', 'Alice', 'Madelyn', 'Cora', 'Ruby', 'Eva', 'Serenity', 'Autumn', 'Adeline', 'Hailey',
  'Gianna', 'Valentina', 'Isla', 'Eliana', 'Quinn', 'Nevaeh', 'Ivy', 'Sadie', 'Piper', 'Lydia'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
];

const LOCATIONS = [
  'San Francisco, CA, USA', 'New York, NY, USA', 'Austin, TX, USA', 'Seattle, WA, USA',
  'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'London, UK', 'Manchester, UK', 'Edinburgh, UK',
  'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany',
  'Amsterdam, Netherlands', 'Paris, France', 'Lyon, France',
  'Madrid, Spain', 'Barcelona, Spain', 'Valencia, Spain',
  'Stockholm, Sweden', 'Copenhagen, Denmark', 'Oslo, Norway',
  'Warsaw, Poland', 'Krakow, Poland', 'Prague, Czech Republic',
  'Bengaluru, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India',
  'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia',
  'Tokyo, Japan', 'Osaka, Japan', 'Seoul, South Korea',
  'Singapore', 'Taipei, Taiwan', 'Auckland, New Zealand',
  'Sao Paulo, Brazil', 'Buenos Aires, Argentina', 'Santiago, Chile',
  'Cape Town, South Africa', 'Nairobi, Kenya', 'Dubai, UAE'
];

// Specializations & Skill Archetypes for Developers
const DEV_ARCHETYPES = [
  {
    title: 'Full-Stack Next.js & TypeScript Engineer',
    skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'Tailwind CSS', 'MongoDB', 'PostgreSQL'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} specializes in full-stack web architectures utilizing Next.js 14, React server components, and performant REST/GraphQL backends. Strong emphasis on type-safety, database indexing, and user experience.`,
    projectIdeas: [
      { title: 'SaaS Multi-Tenant Billing Portal', tech: ['Next.js', 'TypeScript', 'Stripe', 'PostgreSQL'] },
      { title: 'B2B Inventory Management System', tech: ['React', 'Node.js', 'Express', 'MongoDB'] },
      { title: 'Real-Time Collaborative Canvas', tech: ['Next.js', 'WebSockets', 'Tailwind CSS'] }
    ]
  },
  {
    title: 'Python, FastAPI & Backend Microservices Developer',
    skills: ['Python', 'FastAPI', 'Docker', 'PostgreSQL', 'Redis', 'RabbitMQ', 'AWS'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} builds reliable, low-latency backend APIs with Python, FastAPI, and async database connections. Experienced with cloud infrastructure, automated testing, and message queues.`,
    projectIdeas: [
      { title: 'High-Throughput Order Ingestion Engine', tech: ['FastAPI', 'Redis', 'PostgreSQL', 'Docker'] },
      { title: 'Asynchronous Webhook Processing Service', tech: ['Python', 'Celery', 'RabbitMQ', 'AWS'] },
      { title: 'RESTful Marketplace Backend API', tech: ['FastAPI', 'SQLAlchemy', 'Pydantic'] }
    ]
  },
  {
    title: 'Frontend React UI/UX & Design Systems Engineer',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Storybook', 'Framer Motion', 'Redux Toolkit', 'Jest'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} crafts pixel-perfect, accessible, and responsive user interfaces. Expert at design system governance, fluid animations, and micro-interactions for modern web applications.`,
    projectIdeas: [
      { title: 'Enterprise Component Library & Storybook', tech: ['React', 'TypeScript', 'Tailwind CSS', 'Storybook'] },
      { title: 'Fintech Mobile-Responsive Web Dashboard', tech: ['React', 'Framer Motion', 'Redux Toolkit'] },
      { title: 'Interactive Audio Waveform Visualizer', tech: ['React', 'Web Audio API', 'Canvas'] }
    ]
  },
  {
    title: 'MERN Stack & Node.js Developer',
    skills: ['Node.js', 'Express', 'MongoDB', 'React', 'REST APIs', 'JWT Auth', 'Tailwind CSS'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} is a seasoned MERN stack developer experienced in building scalable applications from scratch. Capable of handling authentication, state management, and production cloud deploys.`,
    projectIdeas: [
      { title: 'Social Community Platform with Real-Time Feeds', tech: ['React', 'Node.js', 'MongoDB', 'Socket.io'] },
      { title: 'Freelance Milestone Tracking Suite', tech: ['Node.js', 'Express', 'MongoDB', 'JWT'] },
      { title: 'Dynamic E-Commerce Product Catalog', tech: ['React', 'Node.js', 'Tailwind CSS'] }
    ]
  },
  {
    title: 'Mobile App Developer (React Native & Expo)',
    skills: ['React Native', 'Expo', 'TypeScript', 'iOS', 'Android', 'Firebase', 'Redux'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} builds cross-platform mobile apps for iOS and Android with React Native and Expo. Focused on native performance, offline persistence, and seamless push notifications.`,
    projectIdeas: [
      { title: 'Cross-Platform Fitness Tracking App', tech: ['React Native', 'Expo', 'TypeScript', 'Firebase'] },
      { title: 'On-Demand Delivery Courier Mobile Client', tech: ['React Native', 'Redux', 'Mapbox'] },
      { title: 'Cryptocurrency Wallet UI & Biometric Auth', tech: ['React Native', 'Expo', 'SecureStore'] }
    ]
  },
  {
    title: 'E-Commerce & Shopify Headless Specialist',
    skills: ['Shopify', 'Liquid', 'Hydrogen', 'Next.js', 'GraphQL', 'Tailwind CSS', 'Webhooks'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} helps direct-to-consumer brands scale their e-commerce platforms with Shopify Plus, custom Liquid sections, and modern headless Next.js frontends.`,
    projectIdeas: [
      { title: 'Custom Headless Shopify Plus Storefront', tech: ['Hydrogen', 'Next.js', 'Shopify Storefront API'] },
      { title: 'Bespoke Product Bundling App', tech: ['Shopify Liquid', 'JavaScript', 'Tailwind CSS'] },
      { title: 'Omnichannel Order Synchronization Webhook', tech: ['Node.js', 'Shopify Admin API', 'MongoDB'] }
    ]
  },
  {
    title: 'DevOps & Cloud Infrastructure Engineer',
    skills: ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD GitHub Actions', 'Linux', 'Nginx'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} automates cloud architectures, container orchestration, and continuous integration pipelines. Ensures zero-downtime rollouts and resilient cloud security.`,
    projectIdeas: [
      { title: 'Multi-Region Kubernetes Microservice Cluster', tech: ['Kubernetes', 'AWS EKS', 'Terraform'] },
      { title: 'Automated CI/CD Pipeline & Staging Deployments', tech: ['GitHub Actions', 'Docker', 'AWS ECS'] },
      { title: 'Self-Healing Reverse Proxy & SSL Automation', tech: ['Nginx', 'Docker', 'Certbot', 'Linux'] }
    ]
  },
  {
    title: 'Golang & High-Concurrency Systems Developer',
    skills: ['Go', 'gRPC', 'PostgreSQL', 'Docker', 'Redis', 'Kafka', 'Microservices'],
    serviceCategories: ['website development'],
    bioTemplate: (name) => `${name} architects high-concurrency microservices and data pipelines with Go. Passionate about minimal memory footprints, gRPC communication, and clean architecture.`,
    projectIdeas: [
      { title: 'Distributed Event Streaming Service', tech: ['Go', 'Kafka', 'gRPC', 'Docker'] },
      { title: 'High-Frequency Financial Ticker Engine', tech: ['Go', 'WebSockets', 'Redis', 'PostgreSQL'] },
      { title: 'API Gateway with Rate Limiting Middleware', tech: ['Go', 'Redis', 'Docker'] }
    ]
  }
];

// Specializations & Skill Archetypes for Designers
const DESIGNER_ARCHETYPES = [
  {
    title: 'Senior UI/UX Product Designer',
    skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'Usability Testing', 'Mobile App UI'],
    serviceCategories: ['graphic design'],
    bioTemplate: (name) => `${name} transforms complex business logic into intuitive, elegant digital interfaces. Strong experience in B2B SaaS, mobile apps, and scalable design system creation in Figma.`,
    projectIdeas: [
      { title: 'Fintech Mobile Banking App UX Redesign', tech: ['Figma', 'Prototyping', 'Design System'] },
      { title: 'B2B Analytics Dashboard Information Architecture', tech: ['Figma', 'Wireframing', 'User Research'] },
      { title: 'Healthcare Telemedicine Patient Portal', tech: ['Figma', 'Interactive Prototypes', 'Accessibility WCAG'] }
    ]
  },
  {
    title: 'Brand Identity & Vector Logo Designer',
    skills: ['Logo Design', 'Adobe Illustrator', 'Brand Guidelines', 'Typography', 'Iconography', 'Adobe Photoshop'],
    serviceCategories: ['logo and branding', 'graphic design'],
    bioTemplate: (name) => `${name} creates iconic visual identities, memorable logos, and comprehensive brand guidelines for tech startups and lifestyle businesses.`,
    projectIdeas: [
      { title: 'Complete Brand Identity & Vector Guideline Book', tech: ['Adobe Illustrator', 'InDesign', 'Typography'] },
      { title: 'Geometric Minimalist Logo System & Favicons', tech: ['Adobe Illustrator', 'Vector Art', 'Color Systems'] },
      { title: 'Rebranding Suite for Clean Energy Startup', tech: ['Illustrator', 'Photoshop', 'Brand Guidelines'] }
    ]
  },
  {
    title: 'Social Media & Performance Creative Designer',
    skills: ['Social Media Creatives', 'Adobe Photoshop', 'Canva', 'Banner Design', 'Ad Creatives', 'Figma'],
    serviceCategories: ['social media creatives', 'graphic design'],
    bioTemplate: (name) => `${name} designs high-converting visual assets for paid and organic campaigns across Instagram, TikTok, LinkedIn, and Meta Ads. Focused on visual hierarchy and click-through rates.`,
    projectIdeas: [
      { title: '30-Day Instagram Carousel & Story Creative Pack', tech: ['Photoshop', 'Figma', 'Canva'] },
      { title: 'High-CTR Performance Ad Creative Suite for Meta', tech: ['Photoshop', 'Ad Creative Strategy'] },
      { title: 'Black Friday Promotional Banner Campaign Pack', tech: ['Illustrator', 'Photoshop', 'Digital Display Ads'] }
    ]
  },
  {
    title: 'Hospitality & Digital Menu Experience Designer',
    skills: ['Digital Menu Design', 'Graphic Design', 'Typography', 'Adobe InDesign', 'Photoshop', 'Print Design'],
    serviceCategories: ['digital menu design', 'graphic design'],
    bioTemplate: (name) => `${name} specializes in food & beverage branding, dynamic digital menu board designs, print collateral, and signage that enhances customer ordering experiences.`,
    projectIdeas: [
      { title: 'Multi-Screen Digital Restaurant Menu Board Kit', tech: ['InDesign', 'Photoshop', 'Typography'] },
      { title: 'Artisanal Cafe Packaging & Physical Print Menu', tech: ['Illustrator', 'Print Production', 'Packaging'] },
      { title: 'Interactive QR Code Contactless Menu Web Layout', tech: ['Figma', 'Mobile Web Design'] }
    ]
  },
  {
    title: 'Web & Landing Page CRO Designer',
    skills: ['Figma', 'Landing Page Design', 'Conversion Rate Optimization', 'Web Design', 'Responsive UI'],
    serviceCategories: ['graphic design'],
    bioTemplate: (name) => `${name} designs high-conversion landing pages, product marketing pages, and micro-sites that combine persuasive storytelling with clean visual design.`,
    projectIdeas: [
      { title: 'High-Converting SaaS Product Launch Landing Page', tech: ['Figma', 'CRO Principles', 'Responsive Design'] },
      { title: 'D2C E-Commerce Product Spotlight Page', tech: ['Figma', 'Photoshop', 'Wireframing'] },
      { title: 'Mobile-First Waitlist & Lead Gen Funnel UI', tech: ['Figma', 'Interactive Prototypes'] }
    ]
  },
  {
    title: 'Motion Graphics & Interactive UI Animator',
    skills: ['After Effects', 'Lottie Animations', 'Figma', 'Motion Design', 'Premiere Pro', 'Spline 3D'],
    serviceCategories: ['graphic design', 'social media creatives'],
    bioTemplate: (name) => `${name} brings interfaces and brand stories to life through micro-interactions, Lottie vector animations, and engaging 3D and 2D motion graphics.`,
    projectIdeas: [
      { title: 'Lottie UI Micro-Interactions for Web Application', tech: ['After Effects', 'Lottie', 'Figma'] },
      { title: '3D Interactive Product Explainer Visuals', tech: ['Spline 3D', 'After Effects'] },
      { title: 'Dynamic Animated Logo Stinger & Video Intro', tech: ['After Effects', 'Cinema 4D Lite'] }
    ]
  }
];

// Specializations & Skill Archetypes for Marketers
const MARKETER_ARCHETYPES = [
  {
    title: 'Performance Marketer & Paid Ads Specialist',
    skills: ['Meta Ads', 'Google Ads', 'PPC Management', 'ROAS Optimization', 'A/B Testing', 'Funnel Tracking'],
    serviceCategories: ['digital marketing'],
    bioTemplate: (name) => `${name} executes profitable paid acquisition campaigns across Meta and Google Ads. Data-driven approach to audience targeting, creative testing, and funnel economics.`,
    projectIdeas: [
      { title: 'E-Commerce 4.2x ROAS Meta Paid Ads Scaling', tech: ['Meta Ads Manager', 'Audience Segmentation', 'A/B Testing'] },
      { title: 'Google Search & PMax Lead Generation Campaign', tech: ['Google Ads', 'GA4', 'Conversion Tracking'] },
      { title: 'Retargeting Funnel & Dynamic Product Ad Setup', tech: ['Facebook Pixel', 'Google Tag Manager', 'Analytics'] }
    ]
  },
  {
    title: 'Technical SEO Strategist & Organic Growth Lead',
    skills: ['Technical SEO', 'Keyword Research', 'Ahrefs', 'SEMrush', 'Content Strategy', 'Google Search Console'],
    serviceCategories: ['digital marketing'],
    bioTemplate: (name) => `${name} drives high-intent organic search traffic through technical site audits, keyword cannibalization fixes, structured data implementation, and content architecture.`,
    projectIdeas: [
      { title: 'Enterprise SaaS Site Architecture & SEO Audit', tech: ['Ahrefs', 'Screaming Frog', 'Search Console'] },
      { title: 'Programmatic SEO Strategy for 10k+ Page Directory', tech: ['Keyword Strategy', 'Schema.org', 'Content Hubs'] },
      { title: 'Backlink Acquisition & Digital PR Outreach Sprint', tech: ['BuzzStream', 'SEMrush', 'Outreach'] }
    ]
  },
  {
    title: 'Social Media Growth & Community Manager',
    skills: ['Social Media Management', 'Instagram Growth', 'TikTok Strategy', 'Community Building', 'Content Calendar'],
    serviceCategories: ['social media management', 'social media creatives'],
    bioTemplate: (name) => `${name} manages organic social media presence, crafts viral short-form video hooks, and builds deeply engaged online communities across TikTok, Instagram, and LinkedIn.`,
    projectIdeas: [
      { title: 'Zero-to-50K Organic TikTok Growth Campaign', tech: ['TikTok Algorithm', 'Short-form Scripting', 'CapCut'] },
      { title: 'B2B Executive Personal Branding on LinkedIn', tech: ['Copywriting', 'Content Scheduling', 'Engagement Strategy'] },
      { title: 'Multi-Channel Brand Content Calendar & Repurposing', tech: ['Notion', 'Buffer', 'Social Analytics'] }
    ]
  },
  {
    title: 'Email Marketing & Retention Specialist (Klaviyo)',
    skills: ['Email Marketing', 'Klaviyo', 'Customer Retention', 'Lifecycle Flows', 'Drip Campaigns', 'Copywriting'],
    serviceCategories: ['digital marketing'],
    bioTemplate: (name) => `${name} builds automated lifecycle email and SMS funnels. Expert in Klaviyo flows including welcome series, abandoned cart recovery, browse abandonment, and win-back campaigns.`,
    projectIdeas: [
      { title: 'Automated 7-Figure Klaviyo Flow Architecture', tech: ['Klaviyo', 'Customer Segmentation', 'Copywriting'] },
      { title: 'Product Launch Drip Campaign & Warmup Sequence', tech: ['Mailchimp', 'Email Design', 'A/B Subject Testing'] },
      { title: 'VIP Loyalty & Re-engagement Retention Strategy', tech: ['Klaviyo', 'SMS Marketing', 'Churn Reduction'] }
    ]
  },
  {
    title: 'Conversion Rate Optimization (CRO) & Funnel Strategist',
    skills: ['Conversion Rate Optimization', 'Google Analytics 4', 'Hotjar', 'A/B Testing', 'Landing Page Audits'],
    serviceCategories: ['digital marketing'],
    bioTemplate: (name) => `${name} analyzes user session recordings, heatmaps, and funnel drop-offs to formulate high-impact A/B test hypotheses that systematically increase checkout conversions.`,
    projectIdeas: [
      { title: 'Mobile Checkout Funnel CRO & Friction Audit', tech: ['GA4', 'Hotjar Heatmaps', 'Usability Audits'] },
      { title: 'SaaS Pricing Page Multi-Variant A/B Test', tech: ['VWO', 'Google Optimize', 'Statistical Analysis'] },
      { title: 'Lead Magnet Opt-In Page Redesign & Conversion Lift', tech: ['Copywriting', 'Design Hypotheses', 'Analytics'] }
    ]
  },
  {
    title: 'B2B Lead Generation & Outbound Strategist',
    skills: ['B2B Lead Generation', 'Cold Email Outreach', 'Apollo.io', 'LinkedIn Sales Navigator', 'CRM Management'],
    serviceCategories: ['digital marketing'],
    bioTemplate: (name) => `${name} builds predictable B2B pipeline through verified prospect scraping, personalized cold email sequences, deliverability optimization, and CRM automation.`,
    projectIdeas: [
      { title: 'Targeted ICP Outbound Email Campaign (38% Reply Rate)', tech: ['Apollo.io', 'Instantly.ai', 'Email Deliverability'] },
      { title: 'LinkedIn Social Selling & InMail Prospecting System', tech: ['Sales Navigator', 'HubSpot CRM'] },
      { title: 'B2B Webinar Attendee Acquisition & Nurture Sequence', tech: ['Zoom Webinar', 'HubSpot', 'Zapier'] }
    ]
  }
];

// Helper to calculate rating according to the user specification:
// "The accounts should all range from very bad ratings to decent ratings (but no one should be perfect account only decent accounts)"
// index 0 to 99:
// 0 - 19: Poor (1.1 - 2.4)
// 20 - 59: Mediocre / Average (2.5 - 3.6)
// 60 - 99: Decent (3.7 - 4.4)
function getRatingForIndex(i) {
  if (i < 20) {
    // 1.1 to 2.4
    const r = 1.1 + (i / 19) * 1.3;
    return Math.round(r * 10) / 10;
  } else if (i < 60) {
    // 2.5 to 3.6
    const r = 2.5 + ((i - 20) / 39) * 1.1;
    return Math.round(r * 10) / 10;
  } else {
    // 3.7 to 4.4 (max 4.4 so nobody is perfect)
    const r = 3.7 + ((i - 60) / 39) * 0.7;
    return Math.round(r * 10) / 10;
  }
}

// Generate an individual freelancer account
function generateFreelancer(category, index, passwordHash) {
  const number = index + 1;
  const firstName = FIRST_NAMES[(index * 7 + (category === 'dev' ? 0 : category === 'designer' ? 31 : 67)) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(index * 13 + (category === 'dev' ? 5 : category === 'designer' ? 43 : 89)) % LAST_NAMES.length];
  const fullName = `${firstName} ${lastName}`;
  const location = LOCATIONS[(index * 3 + (category === 'dev' ? 1 : category === 'designer' ? 11 : 23)) % LOCATIONS.length];

  // Email format: category + number @ test.com (e.g. dev1@test.com, designer42@test.com)
  const email = `${category}${number}@test.com`.toLowerCase();

  const rating = getRatingForIndex(index);

  // Pick Archetype
  let archetype;
  if (category === 'dev') {
    archetype = DEV_ARCHETYPES[index % DEV_ARCHETYPES.length];
  } else if (category === 'designer') {
    archetype = DESIGNER_ARCHETYPES[index % DESIGNER_ARCHETYPES.length];
  } else {
    archetype = MARKETER_ARCHETYPES[index % MARKETER_ARCHETYPES.length];
  }

  // Scale experience, rates, and projects based on rating bracket
  let yearsOfExperience, hourlyRate, indicativeProjectPrice, completedProjects, typicalDeliveryDays;

  if (rating < 2.5) {
    // Poor / Junior
    yearsOfExperience = 1 + (index % 3); // 1 - 3 yrs
    hourlyRate = 18 + (index % 15); // $18 - $32/hr
    indicativeProjectPrice = 120 + (index % 180); // $120 - $300
    completedProjects = 1 + (index % 6); // 1 - 6 projects
    typicalDeliveryDays = 9 + (index % 10); // 9 - 18 days
  } else if (rating < 3.7) {
    // Mid / Mediocre
    yearsOfExperience = 3 + (index % 5); // 3 - 7 yrs
    hourlyRate = 35 + (index % 35); // $35 - $69/hr
    indicativeProjectPrice = 350 + (index % 450); // $350 - $799
    completedProjects = 6 + (index % 16); // 6 - 21 projects
    typicalDeliveryDays = 5 + (index % 8); // 5 - 12 days
  } else {
    // Decent / Senior (capped at 4.4 rating)
    yearsOfExperience = 7 + (index % 8); // 7 - 14 yrs
    hourlyRate = 75 + (index % 65); // $75 - $139/hr
    indicativeProjectPrice = 850 + (index % 1200); // $850 - $2049
    completedProjects = 18 + (index % 25); // 18 - 42 projects
    typicalDeliveryDays = 3 + (index % 6); // 3 - 8 days
  }

  // Build past projects
  const pastProjects = archetype.projectIdeas.map((idea, pIdx) => ({
    title: idea.title,
    description: `${idea.title} delivered for an enterprise client with custom specifications and responsive testing.`,
    technologies: idea.tech,
    projectUrl: `https://portfolio.gigsaw.com/work/${category}-${number}-${pIdx + 1}`,
    completionDate: `202${3 + (pIdx % 3)}-0${1 + (pIdx * 3)}`,
  }));

  const availability = index % 12 === 0 ? 'busy' : 'available'; // ~92% available
  const priceBasis = index % 2 === 0 ? 'hour' : 'project';

  return {
    name: fullName,
    email: email,
    password: passwordHash,
    role: 'freelancer',
    category: category,
    title: archetype.title,
    hourlyRate: hourlyRate,
    indicativeProjectPrice: indicativeProjectPrice,
    yearsOfExperience: yearsOfExperience,
    typicalDeliveryDays: typicalDeliveryDays,
    location: location,
    priceBasis: priceBasis,
    bio: archetype.bioTemplate(fullName),
    skills: archetype.skills,
    serviceCategories: archetype.serviceCategories,
    rating: rating,
    completedProjects: completedProjects,
    availability: availability,
    paypalEmail: `paypal.${category}${number}@test.com`,
    isProfileComplete: true,
    pastProjects: pastProjects,
    createdAt: new Date(Date.now() - (100 - index) * 86400000 * 2),
    updatedAt: new Date(),
  };
}

async function main() {
  console.log('🚀 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const db = mongoose.connection.db;
  const usersColl = db.collection('users');

  console.log('\n🔒 Hashing universal password "freelancer"...');
  const passwordHash = await bcrypt.hash('freelancer', 10);
  console.log('✅ Universal password hash generated.');

  console.log('\n⚙️ Generating 300 Freelancers:');
  console.log('  - 100 Developers (dev1@test.com ... dev100@test.com)');
  console.log('  - 100 Designers (designer1@test.com ... designer100@test.com)');
  console.log('  - 100 Marketers (marketer1@test.com ... marketer100@test.com)');

  const developers = [];
  const designers = [];
  const marketers = [];

  for (let i = 0; i < 100; i++) {
    developers.push(generateFreelancer('dev', i, passwordHash));
    designers.push(generateFreelancer('designer', i, passwordHash));
    marketers.push(generateFreelancer('marketer', i, passwordHash));
  }

  const allFreelancers = [...developers, ...designers, ...marketers];

  console.log(`\n📦 Total generated: ${allFreelancers.length} freelancers.`);

  console.log('\n💾 Upserting 300 freelancers into MongoDB "users" collection...');
  let inserted = 0;
  let updated = 0;

  for (const f of allFreelancers) {
    const res = await usersColl.updateOne(
      { email: f.email },
      { $set: f },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }

  console.log(`\n🎉 SEED COMPLETE!`);
  console.log(`  - New inserted: ${inserted}`);
  console.log(`  - Existing updated: ${updated}`);
  console.log(`  - Total processed: ${allFreelancers.length}`);

  // Verification Summary
  console.log('\n📊 Database Verification:');
  const countsByCategory = await usersColl.aggregate([
    { $match: { email: { $regex: '@test\\.com$' } } },
    { $group: { _id: '$category', count: { $sum: 1 }, minRating: { $min: '$rating' }, maxRating: { $max: '$rating' }, avgRating: { $avg: '$rating' } } }
  ]).toArray();

  console.table(countsByCategory);

  const sampleDev = await usersColl.findOne({ email: 'dev1@test.com' });
  const sampleDesigner = await usersColl.findOne({ email: 'designer50@test.com' });
  const sampleMarketer = await usersColl.findOne({ email: 'marketer100@test.com' });

  console.log('\n🔍 Sample Accounts:');
  console.log(`  Dev: ${sampleDev.name} (${sampleDev.email}) | Rating: ${sampleDev.rating} | Title: ${sampleDev.title} | Rate: $${sampleDev.hourlyRate}/hr`);
  console.log(`  Designer: ${sampleDesigner.name} (${sampleDesigner.email}) | Rating: ${sampleDesigner.rating} | Title: ${sampleDesigner.title} | Rate: $${sampleDesigner.hourlyRate}/hr`);
  console.log(`  Marketer: ${sampleMarketer.name} (${sampleMarketer.email}) | Rating: ${sampleMarketer.rating} | Title: ${sampleMarketer.title} | Rate: $${sampleMarketer.hourlyRate}/hr`);

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB. All 300 accounts ready for AI matchmaking!');
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
