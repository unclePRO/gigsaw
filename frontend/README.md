# GigSaw - Autonomous Project Decomposer & Multi-Seller PayPal Orchestrator

**Built for the PayPal AI Hackathon 2024 / 2025**

---

## 💡 Problem & Solution

### The Merchant Problem
When a small business owner or entrepreneur wants to launch a venture (e.g., *“Opening Artisan Roast & Brew cafe in Seattle with a $2,000 budget”*), traditional freelance marketplaces force them to:
1. Search across hundreds of freelancers for multiple skill sets.
2. Negotiate scopes, deadlines, and rates one by one.
3. Manage multiple individual escrow payments, contracts, and milestone handoffs manually.

### The GigSaw Solution
**GigSaw** solves this through natural-language project orchestration:
1. **One Natural-Language Goal & Budget**: Enter your project description (via text or voice speech-to-text) and total budget ceiling ($2,000).
2. **AI Work Breakdown & Dependency Mapping**: GigSaw decomposes the project into sequenced milestones across 3 specialized roles:
   - **Logo & Brand Identity Designer** (Foundation milestone, ~18-20% of budget)
   - **UI/UX Designer** (Depends on Brand Assets, ~25-27% of budget)
   - **Full-Stack Coder / Website Developer** (Depends on Brand + UI/UX, ~48-53% of budget)
3. **Automated Freelancer Matching & Counteroffer Checks**: Matches vetted freelancers from the talent pool, handles acceptance states, and validates that any counteroffers stay strictly under the Merchant's budget ceiling.
4. **Single Consolidated Checkout via PayPal Multi-Seller**: The Merchant authorises ONE consolidated order. Under the hood, PayPal Orders v2 breaks it into separate `purchase_units` with direct payee emails for each freelancer and collects a 5% platform fee (`platform_fees`).
5. **Post-Payment AG Grid Operations Dashboard**: Track deliverables, view live milestone dependencies, and approve payments or request revisions in a high-performance AG Grid workspace.

---

## 🎨 Brand Identity (GigSaw Puzzle Logo)
- **App Background**: `#F8FAFC` (Soft Off-White)
- **Card & Surface Background**: `#FFFFFF` with subtle `#E2E8F0` borders
- **Primary Text & Sidebar**: `#0F172A` (Deep Navy Blue)
- **Secondary Accent**: `#2563EB` (Royal Blue)
- **Primary CTAs & AI Highlights**: `#06B6D4` (Vibrant Cyan)
- **Status Badges**:
  - Emerald (`#10B981`) for Completed / Accepted
  - Amber (`#F59E0B`) for In Progress / Counteroffer
  - Rose (`#F43F5E`) for Declined / Revision Requested

---

## 🛠️ Tech Stack & Packages
- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS + Lucide React
- **State Management**: Zustand
- **Data Grid (Hackathon Sponsor Tool)**: AG Grid React (`ag-grid-react` & `ag-grid-community`)
- **Payments**: `@paypal/react-paypal-js` + PayPal REST Orders v2 API (`/v2/checkout/orders` with multi-seller `purchase_units` & `platform_fees`)
- **Database**: MongoDB with Mongoose (with clean in-memory fallback for instant out-of-the-box demoing)
- **AI Integration**: External Python FastAPI microservice support with built-in intelligent Next.js local fallback engine

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- (Optional) MongoDB running locally or MongoDB Atlas URI

### 2. Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your PayPal Sandbox credentials:
```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
MONGODB_URI=mongodb://localhost:27017/gigsaw
NEXT_PUBLIC_AI_MICROSERVICE_URL=http://localhost:8000
```
*(Note: If no live PayPal credentials are provided, GigSaw automatically activates safe multi-seller simulation mode so judges can test every feature without getting stuck!)*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Architecture

```
gigsaw/
├── app/
│   ├── (merchant)/
│   │   ├── create/page.tsx         # 3-Step Merchant Flow (Input -> AI Matching -> Checkout)
│   │   └── dashboard/page.tsx      # AG Grid Project Tracking & Deliverables Dashboard
│   ├── (freelancer)/               # Phase 2 Scaffolding for Freelancer Portal
│   │   ├── dashboard/page.tsx      # Assigned gigs & PayPal payout tracking
│   │   ├── invitations/page.tsx    # Accept, Decline, or Counteroffer UI
│   │   ├── assistant/page.tsx      # AI Freelancer Assistant (Natural language invoices)
│   │   └── onboarding/page.tsx     # PayPal Partner Referrals merchant onboarding
│   ├── api/
│   │   ├── ai/decompose/route.ts   # Task breakdown & freelancer matching API
│   │   └── paypal/
│   │       ├── create-order/route.ts # Multi-seller Orders v2 with 5% platform fee
│   │       ├── capture-order/route.ts# Escrow capture and project funding
│   │       └── webhooks/route.ts     # PayPal webhook receiver
│   ├── globals.css                 # Tailwind & AG Grid styling
│   ├── layout.tsx                  # Root layout with Sidebar and PayPal Provider
│   └── page.tsx                    # Landing redirect to /create
├── components/
│   ├── layout/Sidebar.tsx          # Deep Navy sidebar with interlocking G logo & portal switcher
│   └── providers/PayPalProvider.tsx# PayPal React SDK wrapper
├── lib/
│   ├── mockData.ts                 # Realistic talent pool (3 roles) & Rahul's Cafe demo
│   └── mongodb.ts                  # Mongoose client with graceful offline fallback
├── models/
│   ├── Freelancer.ts               # Freelancer schema
│   └── Project.ts                  # Project & WorkPackage schema
├── store/
│   └── useProjectStore.ts          # Zustand state store
└── types/
    └── index.ts                    # TypeScript types
```
