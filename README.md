# GigSaw

Autonomous Freelance Team Marketplace and Escrow Management Platform

## Live Deployments

- Web Application (Vercel): https://gigsaw.vercel.app/
- AI Microservice (Render): https://gigsaw-ai.onrender.com/

---

## Overview

Hiring freelancers for a new project usually requires finding, interviewing, negotiating with, and paying multiple individuals separately (such as designers, frontend developers, and backend engineers). Managing separate contracts and payments across uncoordinated workers often leads to delays, miscommunication, and project failure.

GigSaw solves this by assembling a complete, coordinated freelance team from a single project prompt. The platform uses AI to understand the project requirements, breaks the work into ordered milestone packages, matches verified specialists, and consolidates the entire team under a single escrow payment.

---

## Key Features

### 1. Goal and Budget Scoping
- Clients enter a brief description of what they want to build along with their target budget.
- An interactive AI Project Manager asks clarifying questions regarding design style, functional requirements, and target deadlines to create an accurate project specification.

### 2. Milestone and Task Breakdown
- The AI divides the project into clear, sequential milestones.
- Budgets are divided fairly among milestones, ensuring the total cost matches the client's budget.

### 3. Automated Specialist Matching
- Matches verified freelancers from the platform's database based on required skills, client ratings, past completed work, and availability.
- Clients can inspect freelancer profiles, portfolios, and ratings before dispatching invitations.

### 4. Dual-Sided Team Invitations
- Freelancers receive invitation cards detailing project scope, deliverables, and milestone compensation.
- Once all specialists review and accept their invitations, the project advances to payment.

### 5. Multi-Seller Escrow Checkout
- Clients pay once through a unified PayPal checkout.
- Funds are held in escrow for each specialist and are released milestone by milestone upon client review and approval.

### 6. Collaborative Workspaces and Review
- Real-time project dashboard with integrated team chat.
- Freelancers submit work links (such as GitHub repositories or Figma designs) and implementation notes.
- Clients review deliverables, award star ratings with feedback, and release funds upon satisfaction.

---

## Architecture and Technology Stack

### Architecture Overview

```
+-------------------------------------------------------+
|                 Next.js 14 Web Client                 |
|       (App Router, React, Tailwind CSS, NextAuth)     |
+---------------------------+---------------------------+
                            |
                 REST APIs / JSON Payloads
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
+-----------------------+        +-----------------------+
|  FastAPI AI Service   |        |     MongoDB Atlas     |
|   (Render Deployment) |        | (Users, Projects,     |
|                       |        |  Milestones, Reviews) |
+-----------------------+        +-----------------------+
```

### Technology Details

- Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide icons
- Authentication: NextAuth.js with JWT session tokens and role-based access control
- Database: MongoDB Atlas with Mongoose
- Payments: PayPal Multi-Seller REST APIs (Orders v2) and PayPal JavaScript SDK
- AI Service: Python 3.11+, FastAPI, Pydantic v2, Google Gemini API
- Deployment: Vercel (Frontend & Serverless API Routes), Render (FastAPI Microservice)

---

## Project Structure

```
gigsaw/
├── frontend/                       # Full-stack Next.js 14 application
│   ├── app/                        # App Router pages and API route handlers
│   │   ├── (auth)/login/           # Sign in and registration
│   │   ├── api/                    # Serverless endpoints (Auth, Projects, PayPal, AI)
│   │   ├── create/                 # Project creation studio and AI scoping chat
│   │   ├── dashboard/              # Merchant project tracking dashboard
│   │   └── freelancer/             # Freelancer workspace, invitations, and profile
│   ├── components/                 # Reusable UI components, navigation, and modals
│   ├── lib/                        # Database connection, auth configuration, helpers
│   ├── models/                     # Mongoose database models
│   └── types/                      # TypeScript type definitions
│
└── ai/                             # Python FastAPI AI microservice
    ├── src/gigsaw_ai/              # Core microservice package
    │   ├── api/routes/             # Endpoints for scoping, matching, and proposals
    │   ├── core/                   # Configuration, settings, and logging
    │   ├── database/               # Database repositories
    │   ├── llm/                    # Language model client integration
    │   ├── schemas/                # Request and response data models
    │   └── services/               # Task decomposition and matching logic
    ├── requirements.txt            # Python package dependencies
    └── tests/                      # Automated test suite
```

---

## Test Accounts and Credentials

For testing and demonstration purposes, pre-configured accounts are available:

### Client / Merchant Account
- Email: `merchant@test.com`
- Password: `merchant`
- Permissions: Create projects, chat with AI, inspect matched specialists, fund escrow via PayPal, and approve milestones.

### Freelancer / Specialist Accounts
- Developer: `dev@test.com` (Password: `freelancer`)
- Designer: `design@test.com` (Password: `freelancer`)
- Marketer: `market@test.com` (Password: `freelancer`)
- Permissions: View task invitations, accept milestone packages, access project workspaces, and submit deliverables.

New accounts can also be created directly via the registration form.

---

## Local Development Setup

### Prerequisites
- Node.js 18.x or 20.x
- Python 3.11+
- MongoDB instance (local or MongoDB Atlas connection string)

---

### 1. Database Configuration

1. In `frontend/.env.local`, set your MongoDB connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/gigsaw?retryWrites=true&w=majority
   NEXTAUTH_SECRET=your_long_random_secret_string
   NEXTAUTH_URL=http://localhost:3000
   NEXT_PUBLIC_AI_MICROSERVICE_URL=http://localhost:8001
   ```

2. Seed test freelancers and catalog categories:
   ```bash
   cd frontend
   npm run db:migrate
   ```

---

### 2. Run the AI Microservice

1. Open a terminal and navigate to the `ai` directory:
   ```bash
   cd ai
   python -m venv .venv
   ```

2. Activate the virtual environment:
   - On Windows (PowerShell):
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - On macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the service:
   - On Windows (PowerShell):
     ```powershell
     $env:PYTHONPATH = "src"
     uvicorn gigsaw_ai.main:app --host 0.0.0.0 --port 8001 --reload
     ```
   - On macOS/Linux:
     ```bash
     PYTHONPATH=src uvicorn gigsaw_ai.main:app --host 0.0.0.0 --port 8001 --reload
     ```

API documentation will be available at: http://localhost:8001/docs

---

### 3. Run the Frontend Application

1. Open a separate terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Open http://localhost:3000 in your browser.

---

## Running Tests

### Frontend Build Verification
```bash
cd frontend
npm run build
```

### AI Microservice Unit Tests
```bash
cd ai
pytest
```

---

## License

This project is licensed under the MIT License.
