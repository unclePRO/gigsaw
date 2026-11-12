# GigSaw AI API guide

This guide covers the HTTP APIs implemented by the independent AI service in `gigsaw/ai`. It does not document or change the Next.js frontend.

## What “API” means here

An API (Application Programming Interface) is the agreed way one program asks another program to do work. Here, the Next.js/Node backend, Swagger, or another HTTP client sends JSON to this FastAPI service. The service validates the JSON, runs the relevant AI/business logic, and returns JSON. It listens on port `8001` by default.

```text
Swagger / Node backend
        | HTTP request (JSON)
        v
GigSaw AI FastAPI routes (/api/v1/...)
        | schemas + services
        v
Gemini (when enabled), MongoDB, ChromaDB
        | HTTP response (JSON)
        v
Swagger / Node backend
```

The service provides analysis and recommendations. Authentication, authoritative project/user changes, quotation approval, and payment execution belong to the main backend.

## Start and open Swagger

From PowerShell in `A:\PayPal Project\AI\gigsaw\ai`:

```powershell
$env:PYTHONPATH = "$PWD\src"
.\paypal\Scripts\python.exe -m uvicorn gigsaw_ai.main:app --host 0.0.0.0 --port 8001 --reload
```

Open [http://localhost:8001/docs](http://localhost:8001/docs). Expand an endpoint, select **Try it out**, paste its example JSON into **Request body**, then select **Execute**. The response status and JSON appear below. To stop the service press `Ctrl+C` in its terminal.

The service is prefixed with `/api/v1`. In the tables below, paths are relative to that prefix; for example `/projects/analyze` means `POST http://localhost:8001/api/v1/projects/analyze`.

## Before testing

- `AI_PROVIDER=demo`: predictable local sample records and deterministic demo AI output. No credentials or live databases are required.
- `AI_PROVIDER=gemini`: Gemini performs model-backed analysis/scoping/chat/invitation work; MongoDB supplies real records/catalogue and Chroma supplies portfolio retrieval. A slow provider request may take longer than a demo request.
- Swagger calls run on the AI service. They do not themselves create a frontend account, approve a quotation, or make a payment.
- JSON money values should be sent as strings (for example `"2000.00"`) to avoid floating point ambiguity.
- `SchemaModel` rejects unknown request fields. Use the field names shown in these examples.

## Endpoint index

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Reports service/provider/database readiness. |
| POST | `/projects/analyze` | Analyzes a request, decomposes tasks, plans dependencies, and optionally allocates budget from the service catalogue. |
| POST | `/projects/progress-summary` | Summarizes task completion, blockers, and overdue tasks. |
| POST | `/projects/scoping/chat` | Continues a merchant’s conversational project scoping session. |
| POST | `/projects/chat` | Alias of `/projects/scoping/chat`. |
| POST | `/projects/scoping/finalize` | Finalizes scoping and can return analysis/decomposition. |
| POST | `/matching/freelancers` | Ranks available freelancers from structured data and portfolio retrieval. |
| POST | `/matching/freelancers/swap` | Finds an alternative while excluding the current freelancer and any supplied exclusions. |
| POST | `/projects/chat-room/assist` | Creates kickoff guidance, summarizes room discussion, extracts action items, or helps mediate scope. |
| POST | `/proposals/generate` | Drafts a consolidated proposal from accepted quotations. |
| POST | `/proposals/counteroffer/analyze` | Explains amount and schedule impact; requires human/backend approval. |
| POST | `/freelancer-assistant/invoice-draft` | Drafts an invoice from an accepted quotation. |
| POST | `/freelancer-assistant/invitation-review` | Reviews whether a freelancer invitation looks feasible. |

## 1. Health

### `GET /health`

No request body.

Example response:

```json
{
  "status": "ok",
  "environment": "development",
  "ai_provider": "demo",
  "databases": {
    "mongodb": "demo-memory",
    "chromadb": "demo-memory"
  }
}
```

In connected mode, database statuses should say `connected-backend-mongoose` (or `connected`) and `initialized`. This checks startup/readiness, not whether there are freelancer records or a valid service catalogue.

## 2. Analyze a customer request

### `POST /projects/analyze`

Request fields: `customer_request` (required, at least 10 characters), optional `project_name`, optional nonnegative `budget`, and 3-letter `currency` (defaults to `USD`).

```json
{
  "project_name": "Copper Cup Cafe launch",
  "customer_request": "I need a website, logo, Instagram promotional banners, food photography, digital menu and social media management for my new cafe.",
  "budget": "2000.00",
  "currency": "USD"
}
```

Response contains:

- `analysis`: project name, goal, summary, canonical required service categories, assumptions, and risks. If supplied, the customer's project name is preserved.
- `budget`: supplied amount/currency and `pricing_status` (`catalogue_planned` or `pending`). It is `null` if no budget was supplied.
- `budget_plan`: catalogue-based allocations and warnings, or `null` if no budget was supplied. Amounts come from the trusted service catalogue, never from Gemini-generated prices.
- `work_packages`: assignable package descriptions, skills, deliverables, dependencies, and initial duration estimates.
- `dependency_plan`: dependency IDs for each package.

Example response shape (model-generated wording and package IDs may differ):

```json
{
  "analysis": {
    "project_name": "Copper Cup Cafe launch",
    "business_goal": "Launch a coherent customer-facing presence",
    "summary": "Cafe website, identity, photography, menu and social launch work.",
    "required_services": ["website development", "logo and branding", "food photography", "digital menu design", "social media creatives", "social media management"],
    "assumptions": [],
    "risks": []
  },
  "budget": {"amount": "2000.00", "currency": "USD", "pricing_status": "catalogue_planned"},
  "budget_plan": {
    "currency": "USD",
    "total_budget": "2000.00",
    "allocated_total": "2000.00",
    "allocations": [
      {"service_category": "website development", "trusted_baseline": "700.00", "recommended_amount": "...", "rationale": "Proportional allocation using the trusted service catalogue baseline."}
    ],
    "warnings": []
  },
  "work_packages": [
    {
      "work_package_id": "wp-01",
      "name": "Brand identity",
      "service_category": "logo and branding",
      "description": "Create a cafe identity.",
      "required_skills": ["logo design", "brand strategy"],
      "deliverables": ["Primary logo", "Colour and typography guide"],
      "dependencies": [],
      "estimated_days": 10,
      "delivery_period_days": null,
      "estimate_basis": "working_days",
      "estimate_status": "initial_estimate",
      "status": "not_started"
    }
  ],
  "dependency_plan": {"wp-01": []}
}
```

`estimated_days` is estimated working effort. `delivery_period_days` is a usage/calendar period (for example, a 30-day content calendar). These are initial estimates, not confirmed delivery deadlines. The budget plan only includes service categories found in MongoDB; if `pricing_status` is `pending`, check the `warnings` and catalogue contents.

## 3. Project scoping chat

### `POST /projects/scoping/chat` (also `POST /projects/chat`)

Use this for a multi-turn intake. Send the current goal and recent messages each time. Preserve the returned `extracted_spec` and send it in the next request so the conversation can build on it.

```json
{
  "initial_goal": "I am opening a cafe and need launch support.",
  "messages": [
    {"role": "user", "content": "It is a small vegan cafe in Pune."},
    {"role": "assistant", "content": "Do you need online ordering or only an information website?"},
    {"role": "user", "content": "An information website with a digital menu."}
  ],
  "current_budget": "2000.00",
  "currency": "USD",
  "extracted_spec": {"business_type": "vegan cafe", "website": "information site with digital menu"}
}
```

Response includes `reply`, optional `clarifying_question`, suggested reply options, updated `extracted_spec`, `completeness_score` from 0 to 1, readiness flags, and `recommended_action` (`continue_asking` or `ready_to_finalize`).

### `POST /projects/scoping/finalize`

Send the scoping conversation and set `auto_decompose` to true to include the full analysis response.

```json
{
  "initial_goal": "I am opening a cafe and need launch support.",
  "messages": [
    {"role": "user", "content": "It is a vegan cafe; I need an information website, logo, menu, photos and Instagram launch content."}
  ],
  "extracted_spec": {"business_type": "vegan cafe", "website": "information site"},
  "budget": "2000.00",
  "currency": "USD",
  "project_name": "Copper Cup Cafe launch",
  "auto_decompose": true
}
```

Response includes `project_name`, `enriched_brief`, `detected_services`, optional `suggested_budget`, `currency`, `extracted_spec`, and optional `analysis_result` (the same general shape as `/projects/analyze`).

## 4. Freelancer matching

### `POST /matching/freelancers`

```json
{
  "service_category": "website development",
  "required_skills": ["responsive design", "seo"],
  "brief": "Build a fast cafe website with an online menu and contact details.",
  "budget": "1200.00",
  "max_delivery_days": 20,
  "limit": 5,
  "exclude_freelancer_ids": []
}
```

Response `matches` contains a freelancer profile, score (0–100), score breakdown, and human-readable reasons. The score combines portfolio relevance, skill overlap, rating, availability, price compatibility, and delivery time. For existing Mongoose users, category filtering maps `dev`/`designer`/`marketer` to detailed service categories. Hourly rates are identified as hourly and are not treated as fixed project prices. A successful empty `matches` list means no suitable available records were found; verify user role/category/availability and that portfolio documents were indexed in Chroma.

### `POST /matching/freelancers/swap`

Find another freelancer for a package while excluding the current match.

```json
{
  "work_package_id": "wp-website",
  "service_category": "website development",
  "required_skills": ["responsive design", "seo"],
  "brief": "Responsive cafe website with a menu.",
  "budget": "1200.00",
  "max_delivery_days": 20,
  "current_freelancer_id": "USER_OBJECT_ID_TO_REPLACE",
  "exclude_freelancer_ids": []
}
```

Response includes `swapped`, `previous_freelancer_id`, optional `new_match`, optional `work_package_id`, and a message. This returns a recommendation; it does not edit the project or reassign a person in MongoDB.

## 5. Project chat room assistant

### `POST /projects/chat-room/assist`

Set `action` to `kickoff`, `summarize`, `action_items`, or `mediate_scope`.

```json
{
  "project_id": "project-123",
  "project_name": "Copper Cup Cafe launch",
  "merchant_name": "Copper Cup owner",
  "members": [
    {"name": "Copper Cup owner", "role": "merchant"},
    {"name": "Maya", "role": "freelancer", "package_title": "Cafe website", "freelancer_id": "USER_OBJECT_ID"}
  ],
  "messages": [
    {"sender": "Copper Cup owner", "role": "merchant", "text": "Can the menu page include allergen notes?"},
    {"sender": "Maya", "role": "freelancer", "text": "Yes, if you send the final ingredients list by Friday."}
  ],
  "action": "action_items"
}
```

Response includes the selected `action`, facilitator `message`, `action_items` (task, assignee, status), and optional `summary`. It does not send chat messages itself.

## 6. Proposal and counteroffer

### `POST /proposals/generate`

Only quotations whose status is `accepted` are included in the proposal total.

```json
{
  "project_id": "project-123",
  "project_name": "Copper Cup Cafe launch",
  "currency": "USD",
  "quotations": [
    {
      "quotation_id": "q-website-1",
      "freelancer_id": "USER_OBJECT_ID_1",
      "work_package_id": "wp-website",
      "amount": "760.00",
      "currency": "USD",
      "delivery_days": 14,
      "scope": "Five-page responsive cafe website.",
      "status": "accepted"
    },
    {
      "quotation_id": "q-photo-1",
      "freelancer_id": "USER_OBJECT_ID_2",
      "work_package_id": "wp-photo",
      "amount": "500.00",
      "currency": "USD",
      "delivery_days": 5,
      "scope": "Food photography session.",
      "status": "pending"
    }
  ]
}
```

Response includes proposal ID, accepted quotations, exact total, currency, summary, and assumptions. It returns a draft; the backend/customer handles approval.

### `POST /proposals/counteroffer/analyze`

```json
{
  "original_quotation": {
    "quotation_id": "q-photo-1",
    "freelancer_id": "USER_OBJECT_ID_2",
    "work_package_id": "wp-photo",
    "amount": "500.00",
    "currency": "USD",
    "delivery_days": 5,
    "scope": "Half-day food photography session.",
    "status": "counteroffer"
  },
  "proposed_amount": "575.00",
  "proposed_delivery_days": 7,
  "message": "Includes additional styled shots and two more edited images.",
  "project_budget_remaining": "520.00"
}
```

Response includes amount and percentage change, schedule change, budget impact, recommendation, and `approval_required: true`. The service never accepts the counteroffer automatically.

## 7. Freelancer assistant

### `POST /freelancer-assistant/invoice-draft`

Requires `quotation.status` to be `accepted`.

```json
{
  "quotation": {
    "quotation_id": "q-website-1",
    "freelancer_id": "USER_OBJECT_ID_1",
    "work_package_id": "wp-website",
    "amount": "760.00",
    "currency": "USD",
    "delivery_days": 14,
    "scope": "Five-page responsive cafe website.",
    "status": "accepted"
  },
  "client_name": "Copper Cup Cafe",
  "freelancer_name": "Maya Chen",
  "invoice_number": "INV-2026-001",
  "tax_rate_percent": "10"
}
```

Response includes line items, subtotal, tax, total, payment note, and a draft-only disclaimer. This endpoint does not create a PayPal invoice or collect money.

### `POST /freelancer-assistant/invitation-review`

```json
{
  "freelancer_id": "USER_OBJECT_ID_1",
  "project_name": "Copper Cup Cafe launch",
  "merchant_name": "Copper Cup owner",
  "work_package_title": "Cafe website",
  "service_category": "website development",
  "description": "Build a responsive informational cafe website with menu page.",
  "deliverables": ["Responsive website", "Menu page", "Contact form"],
  "allocated_price": "900.00",
  "estimated_days": 14,
  "currency": "USD"
}
```

Response includes feasibility score/assessment, market-rate evaluation, estimated hours, pros, watchouts, suggested decision (`accept`, `counteroffer`, or `request_clarification`), and optional counteroffer suggestions. This is advice only.

## 8. Progress summary

### `POST /projects/progress-summary`

At least one task is required. Dates use `YYYY-MM-DD`.

```json
{
  "project_name": "Copper Cup Cafe launch",
  "tasks": [
    {"work_package_id": "wp-brand", "name": "Brand identity", "status": "completed", "due_date": "2026-11-01"},
    {"work_package_id": "wp-website", "name": "Website", "status": "in_progress", "due_date": "2026-11-20"},
    {"work_package_id": "wp-photo", "name": "Food photography", "status": "blocked", "due_date": "2026-11-05", "blocker": "Cafe renovation is incomplete."}
  ]
}
```

Response includes completion percentage, task counts, blocked/overdue package IDs, summary, and recommended actions. The summary uses the supplied task statuses and the server's current date.

## Errors and troubleshooting

| HTTP status | Typical cause | What to check |
|---|---|---|
| `200` | Request succeeded. | Inspect the response body; an empty match list or pending budget status can still be a valid response. |
| `422` | Invalid request, business validation, provider failure, or dependency cycle. | Read the `detail`; check field names/types, accepted quotation requirement, same-currency requirement, and Gemini provider message. |
| `500` | Unexpected service error. | Response intentionally hides stack traces. Check the AI service terminal logs. |
| Startup failure | Gemini config, MongoDB connection, or Chroma initialization failed. | Check `.env` values and startup logs; health will not be available until startup succeeds. |

Provider requests may be slow. Retry behavior and timeout are configured in `.env` using `REQUEST_TIMEOUT_SECONDS` and `MAX_LLM_RETRIES`. Demo mode is useful for quick route/contract checks; connected mode validates live provider and database integration.

## Where to trace an API

All paths below are relative to `gigsaw/ai/`:

| Concern | Location |
|---|---|
| App creation, middleware, router mounting, error handlers, startup | `src/gigsaw_ai/main.py` |
| Request dependency/container lookup | `src/gigsaw_ai/api/dependencies.py` |
| Route files | `src/gigsaw_ai/api/routes/` |
| JSON request/response contracts | `src/gigsaw_ai/schemas/` |
| Business behavior | `src/gigsaw_ai/services/` |
| Gemini client and prompt templates | `src/gigsaw_ai/llm/` |
| MongoDB and ChromaDB adapters | `src/gigsaw_ai/database/` |
| Gemini embeddings and portfolio retrieval | `src/gigsaw_ai/retrieval/` |
| Automated checks | `tests/unit/` and `tests/integration/` |

Useful route-to-code pointers:

- Health: `api/routes/health.py` → `schemas/common.py`
- Analyze/progress: `api/routes/projects.py` → `services/project_analyzer.py`, `task_decomposer.py`, `dependency_planner.py`, `budget_planner.py`, `project_monitor.py`
- Scoping: `api/routes/scoping.py` → `schemas/scoping.py` → `services/project_scoping_assistant.py`
- Match/swap: `api/routes/matching.py` → `schemas/matching.py` → `services/freelancer_matcher.py`
- Chat room: `api/routes/chat_room.py` → `schemas/chat_room.py` → `services/project_chat_room_assistant.py`
- Proposal/counteroffer: `api/routes/proposals.py` → `schemas/proposals.py` → corresponding service files
- Invoice/invitation: `api/routes/freelancer_assistant.py` → invoice/invitation schemas and services

## Calling from another backend

Send JSON over HTTP to the AI service, for example:

```http
POST /api/v1/projects/analyze HTTP/1.1
Host: localhost:8001
Content-Type: application/json
```

```json
{"project_name":"Copper Cup Cafe launch","customer_request":"I need a cafe website and logo.","budget":"2000.00","currency":"USD"}
```

For a quick terminal check, PowerShell can call the health endpoint:

```powershell
Invoke-RestMethod http://localhost:8001/api/v1/health
```

The main backend should call this service server-to-server, retain authentication and authorization, validate any returned financial recommendations, and perform all approved database/payment actions itself.
