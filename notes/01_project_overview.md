# AI-Powered Societal & Governance Digital Twin
## CivicTwin — *The digital nervous system of an Indian municipality*

> **Tagline:** AI-powered civic intelligence — classifying complaints, simulating policy ripple effects, detecting procurement fraud, and reading public sentiment in real time.

---

## The "Digital Twin of Society" Concept

A **Digital Twin of Society** is a live computational model of a real community — its economy, infrastructure, population, and governance — that runs in parallel to the real world. CivicTwin implements this concept for Indian municipalities: every citizen complaint, social post, and government tender is ingested as data; AI models process that data to classify issues, detect anomalies, and measure public mood; and an Agent-Based Model simulates how policy decisions would ripple through the community's economy *before* they are implemented. Decision-makers interact with the twin through dashboards rather than spreadsheets, getting AI-generated insight instead of raw data.

**Who uses it:**
- **Citizens** — file complaints, follow up on issues, post to the social feed, and use the chatbot to ask questions about their data
- **Municipal Administrators** — monitor complaint queues, audit procurement fraud, simulate policy scenarios, and track public sentiment trends

---

## What is this project?

CivicTwin is an AI-powered governance platform that creates a living digital twin of an Indian municipality. Think of it as *The Sims, but powered by real civic data and AI* — a system where citizens file real complaints, AI automatically classifies and prioritises them, government administrators simulate the ripple effects of policy decisions before implementing them, and machine learning continuously monitors procurement records for fraud. The platform serves two audiences: **citizens** who interact with government services, and **administrators** who use AI dashboards to make smarter, data-driven governance decisions.

---

## The Problem it Solves

**1. Complaints get lost or misrouted.** Citizens have no reliable channel to report civic issues (broken roads, water failures, corruption), and administrators have no intelligent tool to triage, prioritise, or track them at scale. CivicTwin gives citizens a structured complaint portal and gives admins an AI-assisted case management system.

**2. Policy decisions are made blindly.** Government departments have no way to model the downstream socioeconomic effects of a budget decision before spending public money. CivicTwin's simulation engine lets administrators run "what if I invest ₹500 crore in infrastructure vs education?" and see projected outcomes for employment, welfare, and the environment — before a rupee is spent.

**3. Procurement fraud goes undetected.** India loses an estimated ₹10–30 lakh crore annually to public procurement corruption. Tender splitting, ghost beneficiaries, and contractor collusion are difficult to detect manually. CivicTwin's fraud engine automatically audits government tenders against 9 fraud patterns and surfaces high-risk findings to administrators.

---

## The 5 Core Components

### Component 1 — Policy Impact Simulator (Ripple Effect Engine)

Administrators describe a policy in plain English (e.g., "Invest ₹800 crore in metro infrastructure and job creation") and the system runs an Agent-Based Model simulation of a virtual city's economy, projecting the downstream effects on employment, welfare, infrastructure quality, and the environment across 50 simulated time steps. Google Gemini 2.5 Flash then reads the simulation output and generates a structured risk analysis with severity ratings and concrete policy recommendations.

**Real-world example:** A municipal commissioner wants to know whether to prioritise road construction or school funding — they run both scenarios and compare the projected employment and welfare outcomes side by side before presenting to the city council.

**Status:** ✅ Fully Built  
**Key technologies:** Mesa 3.1.1 (ABM framework), Google Gemini 2.5 Flash (consequence analysis), FastAPI, React, Recharts, jsPDF (report export)

---

### Component 2 — Smart Grievance Redressal (AI Complaints Officer)

Citizens file complaints (pothole, broken water pipe, power outage) through a mobile-friendly form with location tagging and photo upload. The system automatically classifies the complaint into a category (road, water, electricity, sanitation, etc.) using a trained machine learning model, computes an urgency priority score boosted by how negative the complaint's language is, and routes it to the appropriate admin. Admins manage complaints through a Kanban-style dashboard with map view, internal notes, and status tracking.

**Real-world example:** A citizen photographs a collapsed road and files it — within seconds the complaint is categorised as "road", priority-scored at 0.91 (boosted because the text says "dangerous and life-threatening"), and appears at the top of the admin queue.

**Status:** ✅ Fully Built  
**Key technologies:** scikit-learn TF-IDF + Logistic Regression (classifier), NLTK VADER (sentiment), PostGIS (geolocation), MongoDB GridFS (image storage), Leaflet (map)

---

### Component 3 — Fraud & Corruption Detection (AI Auditor)

The system continuously audits government procurement records (tenders) against 9 detection rules: repeat contract winners, single-bidder tenders, cost overruns, tender splitting to avoid approval thresholds, circular conflicts of interest (approving officer = contractor), ghost beneficiaries receiving payments after death, and more. Rule-based findings are enriched with machine learning anomaly scores (IsolationForest + LOF) and graph-based collusion cluster detection (NetworkX). Results appear in a multi-tab admin dashboard with a D3 force-graph network visualisation.

**Real-world example:** The system flags that one contractor has won 34% of all contracts in the last year, three of which were split into amounts just below the ₹10 lakh approval threshold — automatically generating a "Critical" risk finding with supporting evidence.

**Status:** ✅ Fully Built  
**Key technologies:** Node.js fraud pipeline (rule engine), scikit-learn IsolationForest + LOF, NetworkX (graph analysis), D3.js (network visualisation), PostgreSQL

---

### Component 4 — Citizen Sentiment & Engagement (Public Opinion Barometer)

A Twitter/Facebook-style social feed where citizens can post updates, photos, reactions, and civic opinions. Every post and complaint is automatically sentiment-scored with VADER NLP. A daily keyword extraction pipeline (YAKE) identifies the top civic topics being discussed. Administrators view a Sentiment Dashboard with trend charts, topic clouds, and breakdowns by category — giving government a real-time read on public mood without manual monitoring.

**Real-world example:** After a flood, the system detects a spike in "negative" sentiment posts about drainage infrastructure and surfaces "flooding" and "waterlogging" as the top trending topics — prompting the admin to issue a public response before the issue escalates.

**Status:** ✅ Fully Built  
**Key technologies:** NLTK VADER (sentiment), YAKE (keyword extraction), MongoDB GridFS (social images), Chart.js / Recharts (analytics charts)

---

### Component 5 — Cross-Cutting Anti-Fraud / Collusion Detector (AI Auditor Layer 2)

Runs underneath Component 3 as its ML augmentation layer. It builds a bipartite graph of relationships between contractors, government officials, beneficiaries, shared phone numbers, shared addresses, and shared bank accounts. NetworkX community detection identifies densely connected clusters — potential collusion rings. Levenshtein string similarity catches near-identical ghost identities. IsolationForest + LOF flag statistical outliers that the rule engine might miss. Scores are blended (70% rule-based, 20% anomaly, 10% graph) into a final risk score.

**Real-world example:** The graph analyser detects that 4 contractors who appear to be independent companies all share the same phone number and address — flagging them as a likely shell company cluster operating a bid-rigging ring.

**Status:** ✅ Built (rule-based + ML-augmented). Gap: no LLM-generated narrative for findings (unlike Component 1's consequence analysis).  
**Key technologies:** NetworkX (greedy modularity community detection), scikit-learn IsolationForest + LocalOutlierFactor, Levenshtein distance (custom implementation)

---

## Project Folder Structure

```
L:\civicTwin\
│
├── .env                        # Live secrets (not committed)
├── .env.example                # Environment variable template
├── civictwin_runbook.md        # ✅ 8-service startup guide with port reference
├── ProjectStructure.md         # Hand-written architecture notes (may be stale)
├── notes/                      # 📁 THIS FOLDER — technical documentation
│
├── backend/                    # Node.js / Express REST API (Port 3000)
│   ├── server.js               # Entry point — starts listener, connects MongoDB GridFS
│   ├── app.js                  # Express app factory — registers 13 route prefixes
│   ├── db.js                   # PostgreSQL pool + MongoDB GridFS dual connection
│   ├── package.json            # Node dependencies
│   ├── auth/                   # Authentication subsystem
│   │   ├── auth.routes.js      # Route: /register, /login, /aadhaar/*
│   │   ├── auth.controller.js  # Business logic: register, login, OTP flow
│   │   ├── auth.utils.js       # JWT signing helper
│   │   ├── otp.service.js      # OTP generate/store/verify (PostgreSQL-backed)
│   │   ├── aadhaar.service.js  # Aadhaar registry lookup (⚠️ local mock DB)
│   │   └── whatsapp.service.js # OTP delivery via Meta WhatsApp Cloud API
│   ├── middleware/
│   │   └── auth.js             # JWT verification — populates req.user
│   ├── routes/
│   │   ├── complaints.js       # ✅ Full CRUD + GridFS image upload/serve
│   │   ├── fraud.js            # Trigger pipeline, fetch runs/findings/clusters
│   │   ├── tenders.js          # Tender record CRUD
│   │   ├── social_feed.js      # ✅ Social posts + likes + comments + GridFS images
│   │   ├── sentimentRoutes.js  # Sentiment query endpoints
│   │   ├── topicRoutes.js      # Topic analytics endpoints
│   │   ├── alertRoutes.js      # Alert management
│   │   ├── simulation.js       # Proxy to simulation_service
│   │   ├── users.js            # User profile endpoints
│   │   ├── topics.js           # Daily topics read
│   │   ├── socialRoutes.js     # Synthetic/ingest social endpoints
│   │   └── upload.js           # Generic file upload
│   └── services/
│       ├── fraudPipeline.js    # ✅ Core fraud detection engine (31 KB, 9 rules)
│       └── fraudReport.js      # Canonical fraud report schema builder
│
├── frontend/                   # React + Vite SPA (Port 5173)
│   ├── src/
│   │   ├── App.jsx             # Router — 20+ routes, role-based protection
│   │   ├── contexts/AuthContext.jsx  # Auth state management
│   │   ├── components/ProtectedRoute.jsx  # Role guard HOC
│   │   ├── services/
│   │   │   ├── fraudApi.js     # Axios calls to /fraud/* endpoints
│   │   │   └── simulationApi.js  # Axios calls to simulation service
│   │   ├── pages/auth/         # Login, Signup, VerifyOTP, ForgotPassword
│   │   ├── pages/citizen/      # Dashboard, FileComplaint, MyComplaints, SocialFeed
│   │   ├── pages/admin/        # Dashboard, ComplaintList, ComplaintDetail, ComplaintMap
│   │   │   ├── SentimentDashboard.jsx   # Sentiment analytics charts
│   │   │   ├── fraud/          # FraudModule (tabs): Overview, Findings, Network, Runs, Analytics
│   │   │   └── social/         # SocialFeedModule (tabs): Overview, Compose, Feed
│   │   └── pages/simulation/   # Simulation, SimulationCompare, ResourceOptimizer, ReportExporter
│   └── package.json            # React 18, Vite, Leaflet, D3, Chart.js, Recharts, jsPDF
│
├── simulation_service/         # FastAPI — ABM + Fraud ML + Gemini AI (Port 8003)
│   ├── app.py                  # ✅ Main service (789 lines) — all endpoints
│   ├── abm_model.py            # Mesa CivicABMModel — agent init, step order, metrics
│   ├── abm_agents.py           # 6 agent types: Worker, Firm, Household, Government, Infra, Env
│   ├── abm_runner.py           # Multi-seed ensemble runner + live progress tracking
│   ├── runner.py               # Classic (simpler) single-run simulation
│   ├── agents.py               # Classic CitizenAgent
│   ├── model.py                # Classic simulation model
│   ├── fraud_graph.py          # NetworkX graph analysis + community detection
│   └── civictwin_results.db    # SQLite — simulation history (744 KB, persists restarts)
│
├── ml/                         # Python ML microservices
│   ├── requirements.txt        # All Python ML dependencies
│   ├── classifier_service/     # FastAPI complaint classifier (Port 8001)
│   │   ├── app.py              # POST /classify — TF-IDF + Logistic Regression
│   │   ├── train.py            # Training: labels.csv → tfidf.joblib + logreg.joblib
│   │   ├── retrain.py          # Retraining trigger
│   │   ├── evaluate.py         # Model evaluation metrics
│   │   └── models/             # ✅ Trained model artifacts (tfidf.joblib, logreg.joblib)
│   ├── sentiment_service/      # Flask VADER sentiment (Port 6001)
│   │   ├── app.py              # POST /sentiment → label + compound score
│   │   └── utils.py            # VADER SentimentIntensityAnalyzer wrapper
│   └── topic_service/          # Flask YAKE keyword extractor (Port 6002)
│       ├── app.py              # POST /extract → top N keywords
│       └── extractor.py        # YAKE extractor with configurable top_n
│
├── chatbot/                    # Rasa NLU (Port 5005) + FastAPI router (Port 8002)
│   ├── rasa/                   # Rasa 3.6 NLU project
│   │   ├── config.yml          # Pipeline: DIETClassifier + ResponseSelector
│   │   ├── domain.yml          # Intents, slots, responses
│   │   ├── data/               # NLU training stories and examples
│   │   └── models/             # Trained Rasa model binary
│   ├── service/app.py          # FastAPI chat router — Rasa + fallback orchestration
│   └── runtime/                # Fallback domain assistants
│       ├── db_assistant.py     # Answers DB questions (complaint counts, stats)
│       ├── profile_assistant.py  # Answers user profile questions
│       ├── site_assistant.py   # Answers platform navigation questions
│       ├── rasa_bridge.py      # HTTP client to Rasa REST :5005
│       └── rasa_chat.py        # ABM results → natural language
│
├── infra/                      # Database schemas and seed data
│   ├── core.sql                # Users, complaints, labels, notes, Aadhaar tables
│   ├── fraud.sql               # Tenders, audit_runs, findings, clusters tables
│   ├── analytics.sql           # Simulation_runs, daily_topics, social_feed tables
│   ├── core/                   # Seed scripts: users, complaints, labels, notes
│   ├── analytics/              # Seed scripts: topics, social feed, simulation runs
│   └── fraud-detection/        # Seed scripts: tenders, fraud flags, clusters
│
├── config/
│   └── priority_keywords.json  # Keywords that boost complaint priority score
│
└── scripts/
    ├── ml_audit.py             # Health-check runner for all ML services
    └── retrain.sh              # Trigger classifier retraining
```

---

## How the Components Connect

A citizen opens the platform and files a complaint about a broken road with a photo. The photo is stored in MongoDB GridFS (`complaintImages` bucket) and the text is simultaneously sent to the ML classifier (which returns category=`road`, priority=`0.75`) and the VADER sentiment service (which reads "dangerous and flooded" and returns a negative compound score, boosting priority to `0.90`). The complaint lands in PostgreSQL with its geolocation encoded as a PostGIS point and appears immediately on the admin's **Leaflet geospatial map** (`ComplaintMap.jsx`).

Separately, the YAKE topic service runs over all new complaints and social posts for a given date when triggered via `POST /topics_analytics/extract_and_store`. It extracts the top 30 civic keywords and stores them in the `daily_topics` table — which the admin's Sentiment Dashboard visualises as a trend chart showing which issues are heating up.

Meanwhile, the fraud pipeline runs periodically over the `tenders` table. The Node.js rule engine detects that two tenders from the same contractor were split below the approval threshold in a 30-day window. It sends the contractor's feature vector to the simulation service (port 8003) for IsolationForest anomaly scoring and the full entity graph to NetworkX for community detection. The blended risk score creates a `Critical` finding that appears on the admin's fraud dashboard with a **D3 force-graph** (`FraudNetworkPage.jsx`) showing who is connected to whom.

When an administrator wants to simulate a new infrastructure policy, they type the scenario into the Simulation page. The description is keyword-mapped to ABM parameters, and a Mesa simulation of 120 workers, 8 firms, 45 households, a Government agent, an Infrastructure agent, and an Environment agent runs across 50 steps in a background thread. Progress streams to the UI via 1-second polling. On completion, the step-by-step metrics are sent to **Gemini 2.5 Flash** (`simulation_service/app.py`), which returns a structured consequence analysis — which risk dimensions were impacted most, and what concrete policy corrections are recommended.

The **chatbot** (`chatbot/service/app.py`) intercepts every incoming message with a keyword classifier first. Domain-specific queries ("how many complaints are open?", "what is my role?", "how do I file a complaint?") are routed directly to one of three rule-based assistants: the **DB assistant** (queries PostgreSQL directly via psycopg2), the **profile assistant** (uses JWT user context), or the **site assistant** (static platform knowledge). Only truly conversational, non-domain messages are forwarded to the **Rasa NLU server** (port 5005).

The **social feed** (`backend/routes/social_feed.js`) also uses Gemini — admins can trigger `POST /social/:id/ai-summary` on any post to get a Gemini-generated engagement summary (`overallSentiment`, `topTopics`, `recommendedAction`) based on the post's reactions and comments.

---

## Quick Start — How to Run This Project

### Prerequisites
- Node.js ≥ 18, npm
- Python 3.11 (for ML services) + Python 3.10 (for Rasa — exact version required)
- PostgreSQL ≥ 14 with PostGIS extension
- MongoDB ≥ 6.0
- Optional: Google Gemini API key (AI analysis degrades gracefully without it)

### Step 1 — Configure environment
```powershell
# Copy the template and fill in your values
copy .env.example .env
# Required: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, MONGO_URI
# Optional: GEMINI_API_KEY, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
```

### Step 2 — Set up databases
```powershell
psql -U postgres -c "CREATE DATABASE mydb;"
psql -U postgres -d mydb -f infra/core.sql
psql -U postgres -d mydb -f infra/analytics.sql
psql -U postgres -d mydb -f infra/fraud.sql
# Seed with sample data:
python infra/core/seed_users.py
python infra/fraud-detection/seed_tenders.py
```

### Step 3 — Install dependencies
```powershell
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd ml && python -m venv myenv && .\myenv\Scripts\pip install -r requirements.txt && cd ..
cd chatbot && py -3.10 -m venv .venv
.venv\Scripts\pip install rasa==3.6.21 rasa-sdk==3.6.2 fastapi==0.95.2 uvicorn==0.23.2 pydantic==1.10.9 psycopg2-binary
```

### Step 4 — Start all 8 services (separate terminals)
| Terminal | Command | Port |
|----------|---------|------|
| 1 | `cd backend && node server.js` | 3000 |
| 2 | `cd frontend && npm run dev` | 5173 |
| 3 | `cd ml/classifier_service && ..\myenv\Scripts\uvicorn app:app --port 8001` | 8001 |
| 4 | `cd ml/sentiment_service && ..\myenv\Scripts\python app.py` | 6001 |
| 5 | `cd ml/topic_service && ..\myenv\Scripts\python app.py` | 6002 |
| 6 | `cd simulation_service && ..\ml\myenv\Scripts\uvicorn app:app --port 8003` | 8003 |
| 7 | `cd chatbot\rasa && ..\.venv\Scripts\python -m rasa run --enable-api --port 5005` | 5005 |
| 8 | `cd civicTwin && chatbot\.venv\Scripts\python -m uvicorn chatbot.service.app:app --port 8002` | 8002 |

### Step 5 — Open the app
Navigate to `http://localhost:5173`. Log in using credentials from the seed scripts (see `infra/core/seed_users.py`). Admins go to `/admin/dashboard`; citizens go to `/citizen/dashboard`.

---

## Important: What Data is Seeded vs Real

| Data Type | Source | Real? |
|---|---|---|
| Citizen complaints | Seed script: `infra/core/seed_complaints.py` | ❌ Synthetic — written for demo |
| Social feed posts | Seed script: `infra/analytics/social_feed_seed.py` / `backend/seed_social.js` | ❌ Synthetic |
| Government tenders | Seed script: `infra/fraud-detection/seed_tenders.py` | ❌ Synthetic (procedurally generated) |
| Aadhaar registry | Table in PostgreSQL seeded by `infra/core/seed_users.py` | ❌ Mock — NOT connected to UIDAI |
| ML classifier training data | `ml/labels.csv` (~150 hand-labeled rows) | ⚠️ Real labels, tiny dataset |
| Simulation results | SQLite `civictwin_results.db` | ✅ Real runs (744 KB of actual ABM output) |
| User accounts | Created on registration / seed scripts | ✅ Real (bcrypt-hashed passwords) |

> **Note:** Because all tender and Aadhaar data is synthetic, the fraud detection results are demonstrational only. For production use, real procurement data from government sources (PM GatI Shakti, CPPP) and actual UIDAI API integration would be required.
