# Nodal — Personal Finance Graph + Vector RAG Assistant

A full-stack **MERN** application that answers natural-language questions about personal spending by combining **graph-based retrieval** and **vector-based semantic search**.

Nodal models transactions, merchants, categories, recurring subscriptions, and usage patterns to answer questions such as:

* "How much did I spend on Food this month?"
* "Show me my travel-related spending."
* "Which subscriptions am I still paying for but not using?"
* "How much more did I spend on Dining Out than Food Delivery?"

> **Demo Note:** The current version uses a **synthetic 6-month transaction dataset** generated through `backend/seed/seedData.js` to simulate realistic bank/UPI transaction data. The ingestion layer can be extended to support CSV/Excel bank statement uploads in a production version.

---

## Problem

Personal spending data is often scattered across bank accounts, UPI apps, credit cards, and wallets. Transaction descriptions are also inconsistent, making traditional keyword or category-based analysis unreliable.

For example, the same merchant may appear as:

```text
SWIGGY*ORDER8827
Swiggy Bangalore Pvt Ltd
UPI-SWIGGY-swiggy@icici
```

This makes questions such as:

* How much did I spend on Swiggy?
* How much did I spend on travel?
* What are my recurring subscriptions?
* Which subscriptions am I still paying for but not using?
* How much do I spend on Food Delivery vs Dining Out?

difficult to answer reliably using simple keyword search.

**Nodal addresses this by combining graph-based relationship reasoning with vector-based semantic retrieval.**

---

## Why Graph + Vector Retrieval?

Different financial questions require different types of retrieval.

### Graph Retrieval

Graph retrieval is useful when a question depends on **relationships and structure**.

For example:

> "How much have I spent on Food?"

Categories can form a hierarchy:

```text
Food
├── Food Delivery
├── Dining Out
└── Groceries
```

Nodal uses MongoDB's `$graphLookup` to recursively traverse this hierarchy and calculate spending across a category and its subcategories.

Graph retrieval is also used for recurring-subscription analysis, where the system identifies regular payment patterns and connects them to subscription and usage information.

### Vector Retrieval

Vector retrieval is useful when a question is **fuzzy or semantic**.

For example:

> "Show me my travel-related spending."

Transactions may contain:

```text
UBER INDIA
OLA CABS
IRCTC
AIR INDIA
MAKEMYTRIP
```

These transactions may not share the same exact category or keywords, but their descriptions can still be related to travel.

Nodal converts transaction descriptions into local feature-hashing vectors and uses cosine similarity to retrieve relevant transactions.

---

# Architecture

```text
┌─────────────────┐
│    React UI     │
│     (Vite)      │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│        Express API           │
│                              │
│ /api/query                   │
│ /api/dashboard               │
│ /api/subscriptions           │
│ /api/transactions            │
│ /api/categories              │
└────────────┬─────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│             MongoDB                │
│                                    │
│ Categories   Merchants             │
│ Transactions Subscriptions         │
│ UsageLogs                           │
└───────────────┬────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌────────────────┐ ┌─────────────────┐
│ Graph Retrieval│ │ Vector Retrieval│
│                │ │                 │
│ $graphLookup   │ │ Feature Hashing │
│ Category Tree  │ │ Embeddings      │
│ Subscriptions  │ │ Cosine Search   │
└───────┬────────┘ └────────┬────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
          ┌───────────────┐
          │  RAG Engine   │
          │               │
          │ Intent →      │
          │ Retrieval →   │
          │ Answer        │
          └───────┬───────┘
                  ▼
          Natural Language
              Response
```

---

# How It Works

### 1. Transaction Data

For the current demo, Nodal generates a synthetic 6-month dataset containing realistic bank/UPI-style transactions.

Example:

```text
Date        Description              Amount
2026-08-01  SWIGGY*ORDER8827         ₹450
2026-08-02  UBER INDIA               ₹280
2026-08-03  NETFLIX.COM              ₹649
2026-08-04  IRCTC                    ₹1,200
```

---

### 2. Data Modeling

Transactions are connected to merchants, categories, and recurring subscriptions.

Conceptually:

```text
Transaction
     │
     ├── PAID_TO ──→ Merchant
     │                  │
     │                  └── CATEGORY ──→ Category
     │
     └── PART_OF ──→ Subscription
```

Categories can also form a hierarchy:

```text
Food
├── Food Delivery
├── Dining Out
└── Groceries
```

---

### 3. Graph Retrieval

Implemented in:

```text
backend/utils/graphTraversal.js
```

Nodal uses MongoDB's `$graphLookup` to recursively traverse category relationships.

For example:

```text
Food
 ↓
Food Delivery
 ↓
Dining Out
 ↓
Groceries
```

A query such as:

> "How much did I spend on Food?"

can include spending from the entire category hierarchy rather than relying on exact keyword matching.

---

### 4. Recurring Subscription Detection

Nodal does not rely on a hardcoded list of subscription services.

`detectRecurringSubscriptions()` analyzes transaction history by:

* Grouping transactions by merchant
* Measuring gaps between consecutive transactions
* Checking payment amount stability
* Detecting regular weekly/monthly/yearly patterns

When a recurring pattern is detected, the system creates a `Subscription` entity linked to its contributing transactions.

---

### 5. Unused Subscription Detection

`flagUnusedSubscriptions()` cross-references simulated usage logs with recurring subscription payments.

For example:

```text
Netflix
₹649 / month
Last payment: Recent
Last usage: 60+ days ago
```

The system can flag the subscription for review because payments are continuing while recent usage evidence is missing.

---

### 6. Vector Retrieval

Implemented in:

```text
backend/utils/embeddings.js
```

Transaction descriptions are converted into local vectors using **feature hashing**.

The pipeline is:

```text
Transaction Description
        ↓
Tokenization
        ↓
Token / Bigram Hashing
        ↓
128-dimensional Vector
        ↓
L2 Normalization
```

Cosine similarity is then used to retrieve related transactions.

For example:

```text
Query:
"travel spending"

        ↓

Vector Search

        ↓

Uber
Ola
IRCTC
Air India
MakeMyTrip
```

This implementation requires **no external embedding API or API key**.

---

# RAG Query Engine

Implemented in:

```text
backend/utils/ragEngine.js
```

The query pipeline is:

```text
User Question
      ↓
Intent Classification
      ↓
┌─────────┬──────────┬────────────┐
│ Graph   │ Vector   │ Hybrid     │
└─────────┴──────────┴────────────┘
      ↓
Retrieved Facts
      ↓
Answer Synthesis
      ↓
Natural Language Response
```

The engine roughly classifies questions into:

* Subscription-related
* Comparison
* Category / merchant
* Semantic search

It then routes the question to graph retrieval, vector retrieval, or both.

---

# Example Queries

| User Query                                | Retrieval Strategy         |
| ----------------------------------------- | -------------------------- |
| How much have I spent on Food this month? | Graph traversal            |
| What subscriptions am I not using?        | Graph + usage analysis     |
| Food Delivery vs Dining Out spending      | Hybrid retrieval           |
| Show me my travel-related spending        | Vector search              |
| How much did I spend at Swiggy?           | Merchant / graph retrieval |
| What are my recurring subscriptions?      | Graph retrieval            |

---

# Key Features

* **MERN stack** — MongoDB, Express, React, Node.js
* **GraphRAG architecture**
* MongoDB `$graphLookup` for recursive category traversal
* Automatic recurring-subscription detection
* Usage-based subscription flagging
* Local feature-hashing embeddings
* Cosine similarity based vector retrieval
* Hybrid graph + vector retrieval
* Natural-language financial queries
* Synthetic 6-month transaction dataset
* No mandatory external AI API keys
* Optional LLM integration point through `.env.example`

---

# Project Structure

```text
expense-graph-rag/
│
├── backend/
│   ├── config/
│   │   └── db.js
│   │
│   ├── models/
│   │   ├── Category.js
│   │   ├── Merchant.js
│   │   ├── Transaction.js
│   │   ├── Subscription.js
│   │   └── UsageLog.js
│   │
│   ├── routes/
│   │   ├── transactions.js
│   │   ├── categories.js
│   │   ├── subscriptions.js
│   │   ├── dashboard.js
│   │   └── query.js
│   │
│   ├── utils/
│   │   ├── embeddings.js
│   │   ├── graphTraversal.js
│   │   └── ragEngine.js
│   │
│   ├── seed/
│   │   └── seedData.js
│   │
│   └── server.js
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Dashboard
        │   ├── ChatAssistant
        │   ├── TransactionsList
        │   ├── SubscriptionsPanel
        │   ├── GraphPanel
        │   └── Sidebar
        │
        └── api/
            └── api.js
```

---

# Setup

## Prerequisites

* Node.js 18+
* MongoDB running locally

**or**

* MongoDB Atlas connection string

---

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd expense-graph-rag
```

---

## 2. Backend

```bash
cd backend
npm install
```

Create `.env` from the example:

```bash
cp .env.example .env
```

Configure your MongoDB connection if required.

Generate the synthetic transaction dataset:

```bash
npm run seed
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

## 3. Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Open the frontend URL in your browser.

---

# Why This Project Is Useful

Bank and UPI transaction descriptions are often inconsistent, making traditional keyword-based expense analysis unreliable.

Nodal combines:

* **MongoDB graph traversal** for structural financial relationships
* **Local vector search** for fuzzy transaction matching
* **Hybrid retrieval** for questions requiring both
* **Natural-language querying** for easier financial analysis

Instead of applying semantic search to every question, the RAG engine determines **which retrieval strategy is better suited to the question**.

This demonstrates a practical **GraphRAG architecture where graph and vector retrieval complement each other**.

---

# Current Limitations

The current version is primarily a **demonstration/prototype**:

* Transaction data is synthetically generated.
* No direct bank or UPI account integration is implemented.
* Usage logs are simulated for subscription analysis.
* The local feature-hashing embedding approach is lightweight and is not equivalent to modern neural embedding models.
* LLM-based generation is optional; the default answer synthesis is template-based.

These choices keep the project **self-contained, reproducible, and free of mandatory external API dependencies**.

---

# Future Improvements

* CSV/Excel bank statement upload
* Automatic transaction ingestion and normalization
* Merchant name normalization across different statement formats
* Real neural embedding models
* LLM-powered answer generation
* Multi-user authentication and isolated financial data
* Bank/open-banking integrations
* Advanced anomaly and unusual-spending detection
* Personalized financial recommendations

---

# Tech Stack

### Frontend

* React
* Vite

### Backend

* Node.js
* Express.js

### Database

* MongoDB
* Mongoose
* MongoDB `$graphLookup`

### AI / Retrieval

* GraphRAG
* Vector Search
* Feature-Hashing Embeddings
* Cosine Similarity
* Optional LLM Integration

---

# Project Highlights

Nodal is designed to demonstrate that **different retrieval problems require different retrieval strategies**.

```text
Structural Question
        ↓
   Graph Search


Semantic Question
        ↓
   Vector Search


Complex Question
        ↓
 Graph + Vector
```

The core idea is simple:

> **Use the right retrieval strategy for the right question.**
