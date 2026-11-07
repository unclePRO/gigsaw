# GigSaw AI service

An independently runnable FastAPI service that turns customer requests into structured project analysis, work packages, explainable freelancer recommendations, draft proposals, counteroffer analysis, invoice drafts, and progress summaries. It is intentionally an advisory service: it does not authenticate people, approve quotations, create PayPal orders/invoices, capture payments, or process webhooks.

## Quick start (safe demo mode)

```powershell
cd 'A:\PayPal Project\AI\gigsaw\ai'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
$env:PYTHONPATH = 'src'
uvicorn gigsaw_ai.main:app --host 0.0.0.0 --port 8001 --reload
```

On the supplied MSYS2 Python installation, use `.\.venv\bin\Activate.ps1` rather than `Scripts`; standard Windows CPython uses `Scripts` as shown above.

Open `http://localhost:8001/docs`. The supplied `.env` starts in `AI_PROVIDER=demo`, which uses fictional in-memory data and needs no API key, MongoDB, or ChromaDB service. Run the full sample workflow with:

```powershell
$env:PYTHONPATH = 'src'
python scripts/test_ai_pipeline.py
```

## Configuration

Copy `.env.example` to `.env` and keep real credentials outside source control. For production-like use, set `AI_PROVIDER=gemini`, a `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, a reachable `MONGODB_URI`, and `CHROMA_PERSIST_DIRECTORY`. Gemini mode fails clearly at startup if its required configuration or providers are unavailable; it never downgrades silently to demo output.

Run fictional demonstration seeding only against an explicitly configured database:

```powershell
$env:PYTHONPATH = 'src'
python scripts/seed_demo_data.py
```

## Connect the existing Node.js Mongoose backend safely

The service can read the supplied `User` and `Project` Mongoose schemas without copying or changing them. Set the following values in `.env`; use an Atlas *development/staging database containing a safe copy of the backend `users` and `projects` data*, never a production database. A brand-new empty database will not have freelancers to match.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=replace_with_your_key
MONGODB_URI=replace_with_your_atlas_connection_string
MONGODB_DATABASE=gigsaw_ai_yourname_dev
MONGODB_SCHEMA_MODE=backend_mongoose
MANAGE_MONGO_INDEXES=false
BACKEND_USERS_COLLECTION=users
BACKEND_PROJECTS_COLLECTION=projects
BACKEND_SERVICE_CATALOG_COLLECTION=ai_service_catalog
CHROMA_PERSIST_DIRECTORY=./storage/chroma-yourname-dev
CHROMA_COLLECTION=freelancer_portfolios-yourname-dev
```

In this mode, `users` is read only. The adapter selects only `role: "freelancer"`, maps `_id` to `freelancer_id`, maps the broad Node category (`dev`, `designer`, or `marketer`) to GigSaw service categories, and builds portfolio search text from `bio`, `skills`, and `pastProjects`. It deliberately never reads password, account email, or PayPal email into AI responses or Chroma documents. `projects` is also read only and is not altered by this service.

The existing backend has no service-price catalogue. Create the separate `ai_service_catalog` collection with reviewed marketplace prices. To create clearly labelled **starter development prices** for testing only, run:

```powershell
$env:PYTHONPATH = 'src'
python scripts/initialize_backend_catalog.py --confirm-starter-prices
```

Build the local Chroma portfolio index after the key, Mongo connection, and freelancer records are available:

```powershell
$env:PYTHONPATH = 'src'
python scripts/index_backend_portfolios.py
```

Do **not** run `seed_demo_data.py` in `backend_mongoose` mode: it refuses rather than insert fictional data into the Node.js backend schema. The Mongoose backend should add these optional fields to make rankings accurate: `serviceCategories: string[]`, `yearsOfExperience: number`, `typicalDeliveryDays: number`, `indicativeProjectPrice: number`, and `location: string`. Until then, ranking uses the existing broad `category`, `completedProjects`, `hourlyRate`, and a conservative 14-day delivery default. An hourly rate is never treated as a fixed project quote.

## Architecture

`src/gigsaw_ai` has a deliberately thin HTTP layer, Pydantic contracts, direct Gemini client, source-of-truth repositories, retrieval adapter, and deterministic business services. The `ApplicationContainer` selects infrastructure at startup:

| Mode | Structured data | Portfolio search | Intelligence |
| --- | --- | --- | --- |
| `demo` | in-memory fictional records | in-memory lexical retrieval | deterministic schema-valid outputs |
| `gemini` | MongoDB | ChromaDB with Gemini embeddings | Gemini structured JSON |

MongoDB collections are `freelancers`, `services`, `projects`, `work_packages`, `quotations`, and `proposals`. Relevant unique and query indexes are initialized for freelancer, service, project, quotation, proposal, and work-package IDs. Chroma collection `freelancer_portfolios` stores portfolio/skills text and a `freelancer_id` metadata reference only. Every retrieval hit is resolved against MongoDB before it can be recommended; MongoDB remains authoritative for identity, rates, ratings and availability.

The demo dataset contains twelve clearly fictional freelancers, eight service catalogue categories, a cafe launch project with work-package statuses, and accepted/declined/counteroffer quotations. The seed script persists those fictional records to the listed MongoDB collections and indexes their freelancer portfolio text in ChromaDB.

## API

All endpoints are prefixed by `/api/v1` and use stable Pydantic JSON contracts:

- `GET /health`
- `POST /projects/analyze`
- `POST /matching/freelancers`
- `POST /proposals/generate`
- `POST /proposals/counteroffer/analyze`
- `POST /freelancer-assistant/invoice-draft`
- `POST /projects/progress-summary`

The OpenAPI UI provides a realistic cafe example for project analysis. The analyze response preserves a submitted `project_name`, returns the submitted `budget` with `pricing_status`, and includes `budget_plan` allocations only from the trusted service catalogue. Gemini service labels are canonicalized to the catalogue keys before decomposition and matching. `estimated_days` means initial working-day effort; `delivery_period_days` describes a calendar/usage period such as a 30-day social content calendar. These are estimates, not backend-confirmed deadlines. The main Node.js/Next.js backend should call this service server-to-server, retain ownership of authentication and authoritative records, validate all monetary values and approvals, then perform authorised payment actions itself. Do not expose Gemini or database credentials to the browser.

## Rules behind recommendations

Project analysis and task decomposition use validated structured Gemini output in Gemini mode. Budget allocation uses only trusted MongoDB service catalogue baselines and `Decimal`; it does not accept LLM-invented prices. Freelancer ranking is explainable: semantic relevance (35), requested skills (25), rating (15), availability (10), indicative price (10), and delivery time (5). Vector similarity cannot independently determine a recommendation. Dependency ordering detects cycles. Proposal totals retain only accepted quotations, counteroffers are never auto-approved, and invoices are drafts only.

## Testing

```powershell
cd 'A:\PayPal Project\AI\gigsaw\ai'
$env:PYTHONPATH = 'src'
pytest
```

The test suite is self-contained: no real Gemini request, MongoDB server, or Chroma service is needed by default. It covers schema validation, analysis, decomposition, budget cents, matching, repositories, portfolio retrieval, dependency cycles, proposal totals, invoice approval validation, FastAPI error handling, and the complete demo cafe workflow. External provider health is verified at application startup in Gemini mode; live connectivity requires the corresponding local services and credentials.

## Limitations

This MVP does not supply authentication/authorization, multi-tenant isolation, asynchronous job queues, background reindexing, rate limiting, audit retention, live payment integration, or production monitoring. Add these in the owning platform/backend before a production deployment.
