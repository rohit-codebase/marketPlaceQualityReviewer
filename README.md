# Marketplace Listing Quality Reviewer

An internal tool for reviewing marketplace product and service listings against a policy knowledge base and brand content guide, combining deterministic validation, AI analysis, and human approval.

---

## Overview

This application implements a structured listing review workflow:

1. A user creates a marketplace listing
2. The system runs deterministic validation (required fields, price, category, duplicates, length)
3. Relevant policy sections are retrieved from the knowledge base
4. An LLM reviews the listing against those policy sections and returns structured findings
5. A human reviewer approves, edits, or rejects each AI suggestion
6. All decisions are stored in a full audit trail

---

## Features

- **Deterministic validation** — field checks that run independently of any LLM
- **Policy knowledge base** — 12 structured policy sections across marketplace and brand guidelines
- **AI listing review** — structured JSON findings with severity, policy citations, and suggested revisions
- **Human-in-the-loop** — field-level Approve / Edit / Reject with inline editing
- **Original vs Revised comparison** — side-by-side diff view
- **Review history** — complete audit trail of all reviews and actions
- **Batch processing** — review multiple listings in one operation with per-item failure isolation
- **Structured logging** — Winston JSON logs for all operations
- **Focused tests** — validator, AI output, and batch isolation

---

## Architecture

```
React (Vite + Tailwind)
       │
       │ REST API
       ▼
Express.js Backend
  ├── Deterministic Validator   (no LLM dependency)
  ├── Policy Retriever          (keyword + category scoring)
  ├── LLM Client                (isolated, provider-swappable)
  ├── AI Output Validator       (validates before storage)
  └── Batch Service             (per-item failure isolation)
       │
       ▼
MongoDB (via Mongoose)
  ├── Listing
  ├── Review
  └── ReviewAction
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| AI | OpenAI (via `openai` SDK, provider-isolated) |
| Logging | Winston |
| Testing | Jest |

---

## Application Flow

```
User creates listing
       │
       ▼
POST /api/reviews { listingId }
       │
       ├─► Deterministic validation (required fields, price, category, duplicates)
       │
       ├─► Policy retrieval (keyword + category scoring → top 8 sections)
       │
       ├─► LLM call (listing + policy sections → structured JSON)
       │
       ├─► AI output validation (schema check, policy ID check)
       │
       └─► Review stored → human reviewer sees findings
                │
                ├─► Approve suggestion → field updated
                ├─► Edit suggestion → edited value stored
                └─► Reject suggestion → original kept
```

---

## AI Workflow

The AI workflow is implemented in `server/src/ai/`:

- **`llmClient.js`** — Wraps the OpenAI SDK. Forces JSON response mode. Logs tokens and duration. Never logs API keys.
- **`promptBuilder.js`** — Builds a strict system prompt (cites only provided policy IDs) and a user message containing the listing and relevant policy sections.
- **`listingReviewer.js`** — Orchestrates the full 8-step review workflow from listing load to review storage.
- **`outputValidator.js`** — Validates the LLM JSON response before storage. Rejects unknown policy IDs, invalid severity values, malformed structures.

The LLM is told to:
- Only evaluate against provided policy sections
- Return strict JSON (enforced by `response_format: { type: 'json_object' }`)
- Separate verifiable observations from assumptions
- Never invent external evidence or product specs
- Cite real policy IDs only

---

## Policy Retrieval

Policy retrieval is in `server/src/policies/policyRetriever.js`.

**Strategy:**
1. Score every policy section by counting keyword matches against the listing text
2. Add a large bonus for category-specific sections that match the listing's category
3. Always include baseline sections (brand tone, description guidelines)
4. Return the top 8 sections by score

This is deterministic, fast, and easy to explain — no vector database needed.

---

## Deterministic Validation

Implemented in `server/src/validators/listingValidator.js`.

Checks (always run before the LLM):
- Required fields (title, description, category, price, seller name)
- Price: must be a positive numeric value ≥ 0.01
- Category: must be in the supported list
- Title length: 10–200 characters
- Description length: 50–5000 characters
- Attributes: keys and values must be strings
- Duplicate detection: SHA-256 hash of normalized (lowercased, trimmed) title + description + category + seller name

**Duplicate detection:** Two listings with identical normalized content will have the same SHA-256 hash. A unique index on `contentHash` prevents exact duplicates from being stored at all; the validator catches near-identical content (whitespace/case variants).

---

## Database Design

### Listing
```
title, description, category, price, attributes (Map), seller {name, contact},
tags, status (active|under_review|approved|rejected), contentHash (SHA-256), timestamps
```
Index: `contentHash` (unique sparse) — for duplicate detection

### Review
```
listingId (ref), listingSnapshot (full listing at review time),
deterministicFindings[], aiFindings[], aiSummary, aiOverallStatus (pass|review|fail),
aiAssumptions[], policySectionsUsed[], status, errorMessage, batchId, timestamps
```
Index: `listingId`, `status`, `batchId`

### ReviewAction
```
reviewId (ref), listingId (ref), field, findingIndex,
action (approve|edit|reject), originalText, aiSuggestion, finalValue,
reviewerId (placeholder), timestamp
```

---

## API Overview

| Method | Path | Description |
|---|---|---|
| GET | `/api/listings/dashboard` | Dashboard stats + recent reviews |
| POST | `/api/listings` | Create listing |
| GET | `/api/listings` | List listings (filter by status/category) |
| GET | `/api/listings/:id` | Get listing |
| PUT | `/api/listings/:id` | Update listing |
| POST | `/api/reviews` | Trigger AI review |
| GET | `/api/reviews/:id` | Get review |
| POST | `/api/reviews/:id/actions` | Submit approve/edit/reject |
| GET | `/api/reviews/history` | All completed reviews |
| GET | `/api/reviews/history/:id` | Review + actions detail |
| POST | `/api/batch-reviews` | Start batch review |
| GET | `/api/batch-reviews/:batchId` | Batch status |
| GET | `/api/policies` | All policy sections |

---

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- OpenAI API key

### Backend
```bash
cd server
cp .env.example .env
# Fill in MONGODB_URI, LLM_API_KEY, etc.
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

### Seed sample data
```bash
cd server
node seed.js
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Server port (default: 5000) |
| `CLIENT_URL` | Frontend URL for CORS (default: http://localhost:5173) |
| `LLM_PROVIDER` | AI provider (currently: openai) |
| `LLM_API_KEY` | LLM API key |
| `LLM_MODEL` | Model to use (default: gpt-4o) |
| `NODE_ENV` | development or production |

---

## Running Tests

```bash
cd server
npm test
```

Tests cover:
- Required field validation
- Price validation (invalid, zero, negative)
- Category validation
- Title/description length
- Duplicate detection
- Content hash consistency
- AI output validation (schema, severity, policy IDs, confidence)
- Batch failure isolation

---

## Deployment

### Backend — Render / Railway
1. Create a web service pointing to `server/`
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables via dashboard

### Frontend — Vercel / Netlify
1. Point to `client/`
2. Build command: `npm run build`
3. Output: `dist/`
4. Set `VITE_API_URL` to your backend URL

### MongoDB
Use MongoDB Atlas free tier. Add your deployment platform's IP to the Atlas IP allowlist (or use `0.0.0.0/0` for simplicity).

---

## Completed Scope

- ✅ Listing CRUD with frontend + backend validation
- ✅ Controlled category list
- ✅ Deterministic validation service
- ✅ SHA-256 duplicate detection
- ✅ Policy knowledge base (12 sections)
- ✅ Keyword + category policy retrieval
- ✅ LLM review with structured JSON output
- ✅ AI output validation before storage
- ✅ Field-level Approve / Edit / Reject
- ✅ Listing snapshot at review time
- ✅ Original vs Revised diff view
- ✅ Review history
- ✅ Batch processing with failure isolation
- ✅ Structured logging (Winston)
- ✅ Focused tests (Jest)
- ✅ Rate limiting
- ✅ Error handling (no stack traces exposed)
- ✅ Sample data seed script

---

## Intentionally Excluded Scope

- **Authentication** — intentionally omitted. Adding auth would require session management and a user model that adds complexity without demonstrating the core review workflow. Documented as a future improvement.
- **Paraphrase duplicate detection** — SHA-256 covers exact/near-exact duplicates. ML-based semantic similarity is out of scope.
- **Real-time updates** — batch status uses polling. WebSockets were not added to keep the infrastructure simple.
- **Image moderation** — out of scope per requirements.
- **Payment processing** — out of scope.
- **Multi-provider LLM switching** — the `llmClient.js` is designed to be swapped; other providers are not implemented.

---

## Known Limitations

- Batch status is held in memory; a server restart clears in-progress batch state (DB fallback exists for completed batches)
- Policy retrieval uses keyword scoring; paraphrased policies may not be retrieved
- LLM findings quality depends on the model (gpt-4o recommended)

---

## Example Usage

1. Start both servers (`npm run dev` in `server/` and `client/`)
2. Run `node seed.js` in `server/` to create sample listings
3. Go to `http://localhost:5173`
4. Open **Listings** — you will see 7 sample listings
5. Click **Review** on "Best Phone Ever…" — the AI should detect misleading claims
6. On the Review page, Approve/Edit/Reject the AI suggestions
7. View the **Original vs Revised** tab to see changes
8. Check **Review History** for the full audit trail
9. Try **Batch Review** — select multiple listings and review them all at once

---

## Future Improvements

- User authentication and role-based access (Reviewer / Admin)
- Persistent batch job queue (e.g., BullMQ + Redis)
- Multi-provider LLM support (Anthropic, Google)
- Semantic duplicate detection
- Policy section management UI
- Export review reports (PDF/CSV)
- Listing image support and moderation
