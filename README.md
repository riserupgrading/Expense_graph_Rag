# Nodal — Personal Finance Graph + Vector RAG Assistant

A full-stack **MERN** application that answers natural-language questions about your spending by
combining two retrieval strategies:

- **Graph traversal** (MongoDB `$graphLookup`) over category hierarchies, merchants, and
  auto-detected recurring subscriptions
- **Vector search** (a self-contained local embedding + cosine similarity engine — zero external
  API keys required) over messy, real-world transaction description text

This is the classic **GraphRAG** pattern: structural/relational questions ("what subscriptions am
I not using") are answered by graph traversal, while fuzzy/semantic questions ("show me my travel
spending") are answered by vector similarity search — and some questions need both.

## Why two retrieval strategies?

Bank/UPI statements are messy: the same merchant shows up as `SWIGGY*ORDER8827`,
`Swiggy Bangalore Pvt Ltd`, and `UPI-SWIGGY-swiggy@icici` across different transactions. Pure
keyword/category search can't reliably group these. Pure vector search, on the other hand, can't
answer "which of my subscriptions are recurring and unused" — that's a structural pattern (regular
interval + stable amount + no recent usage), not a similarity question.

Nodal uses graph traversal for the *relationship* questions and vector search for the *fuzzy
content* questions, and routes each incoming question to the right one (see
`backend/utils/ragEngine.js`).

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   React UI  │─────▶│  Express API      │─────▶│  MongoDB             │
│  (Vite)     │      │  /api/query       │      │  - Categories (tree) │
│             │◀─────│  /api/dashboard   │◀─────│  - Merchants         │
└─────────────┘      │  /api/subscriptions│      │  - Transactions      │
                      │  /api/transactions │      │  - Subscriptions     │
                      └──────────┬────────┘      │  - UsageLogs         │
                                 │                └─────────────────────┘
                     ┌───────────┴────────────┐
                     │                        │
              graphTraversal.js         embeddings.js
              ($graphLookup +           (feature-hashing
              subscription             embeddings + cosine
              detection algorithm)     similarity vector search)
```

### The "graph" layer
`backend/utils/graphTraversal.js`
- Categories form a small tree via a self-referencing `parent` field (`Food` → `Food Delivery`,
  `Dining Out`, `Groceries`). `$graphLookup` recursively rolls up spend across a category *and*
  every sub-category in one aggregation query.
- `detectRecurringSubscriptions()` groups each merchant's transactions, measures the gap between
  consecutive dates and the variance in amount, and — if the pattern is regular (weekly/monthly/
  yearly) and the amount is stable — materializes a `Subscription` node linking back to every
  contributing `Transaction`. No hardcoded list of "known subscription apps".
- `flagUnusedSubscriptions()` cross-references simulated usage logs to flag subscriptions that are
  still being charged but haven't been used in 45+ days.

### The "vector DB" layer
`backend/utils/embeddings.js`
- A dependency-free embedding function using **feature hashing** (the same technique behind
  scikit-learn's `HashingVectorizer` and Vowpal Wabbit): tokenize → hash each token/bigram into one
  of 128 buckets → L2-normalize. Cosine similarity on these vectors gives real semantic-ish fuzzy
  matching (e.g. a query for "travel" surfaces Uber/Ola/IRCTC transactions) with **zero external
  API calls or costs**.
- Swapping in real embeddings (OpenAI/Cohere/HF) later is a one-function change — the rest of the
  app just calls `embedText()` / `cosineSimilarity()` / `vectorSearch()`.

### The RAG query engine
`backend/utils/ragEngine.js`
1. Classify rough intent from the question (subscriptions / compare / category-or-merchant /
   semantic)
2. Route to a graph query, a vector search, or both
3. Synthesize a plain-English answer from whatever facts were retrieved (template-based by
   default, so the whole app works with **zero LLM API keys**; see `.env.example` for the optional
   LLM plug-in point)

## Project structure

```
expense-graph-rag/
├── backend/
│   ├── config/db.js
│   ├── models/            # Category, Merchant, Transaction, Subscription, UsageLog
│   ├── routes/            # transactions, categories, subscriptions, dashboard, query
│   ├── utils/
│   │   ├── embeddings.js      # local vector embedding + cosine similarity
│   │   ├── graphTraversal.js  # $graphLookup rollups + subscription detection
│   │   └── ragEngine.js       # hybrid retrieval + answer synthesis
│   ├── seed/seedData.js   # synthetic 6-month dataset generator
│   └── server.js
└── frontend/
    └── src/
        ├── components/     # Dashboard, ChatAssistant, TransactionsList,
        │                   # SubscriptionsPanel, GraphPanel, Sidebar
        └── api/api.js
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env      # edit MONGO_URI if needed
npm run seed               # generates 6 months of synthetic data
npm run dev                 # starts the API on http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # starts the UI on http://localhost:5173 (proxies /api to :5000)
```

Open `http://localhost:5173`.

## Example questions to ask

- "How much have I spent on Food this month?" → graph rollup across `Food` + its sub-categories
- "What subscriptions am I not using?" → graph-based recurring-payment + usage-log analysis
- "Food Delivery vs Dining Out spending" → vector search on both sides of the comparison
- "Show me my travel related spending" → semantic vector search over transaction descriptions

**why this project is useful ?**

> Bank statement merchant names are inconsistent — the same transaction can appear under five
> different text formats. I built a local feature-hashing embedding layer for fuzzy merchant/
> description matching, and combined it with MongoDB's `$graphLookup` for structural questions
> like category rollups and recurring-subscription detection — routing each incoming question to
> whichever retrieval strategy actually answers it, rather than doing pure semantic search over
> the whole dataset.


