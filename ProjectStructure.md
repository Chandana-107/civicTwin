# Project Structure

Comprehensive documentation of the CivicTwin repository layout. All folders and files are documented except for the `uploads/` directory.

## Top-Level Files

- **README.md** — Main project documentation
- **requirements.txt** — Python dependencies (root-level)
- **sample.txt** — Sample data or reference file
- **verify_complaints.js** — Node utility for complaint verification
- **ProjectStructure.md** — This file

---

## `/backend` — Express.js Server & API Layer

Main application server handling authentication, routes, database, and fraud detection.

### Core Files
- **server.js** — Main Express application entry point
- **app.js** — Express app configuration
- **db.js** — Database connection and initialization
- **package.json** — Node.js dependencies
- **requirements.txt** — Python dependencies for this module
- **seed_social.js** — Social feed seeding utility

### `/auth` — Authentication Services
- **auth.controller.js** — Authentication controller (login, signup, token management)
- **auth.routes.js** — Auth endpoints
- **auth.utils.js** — Authentication utilities (validation, token generation)
- **aadhaar.service.js** — Aadhaar verification integration
- **otp.service.js** — OTP generation and validation service
- **whatsapp.service.js** — WhatsApp messaging service integration

### `/middleware`
- **auth.js** — Authentication middleware (JWT verification, protected routes)

### `/routes` — API Endpoints
- **alertRoutes.js** — Alert notification endpoints
- **complaints.js** — Complaint submission and retrieval
- **fraud.js** — Fraud detection API:
  - `GET /fraud/flags` — Retrieve fraud findings
  - `GET /fraud/clusters` — Retrieve collusion clusters
  - `GET /fraud/report` — Download audit report
  - `POST /fraud/run` — Trigger fraud detection run
  - `PATCH /fraud/flags/:id` — Update flag status
- **sentimentRoutes.js** — Sentiment analysis endpoints
- **simulation.js** — Simulation and modeling endpoints
- **social_feed.js** — Social feed data endpoints
- **socialRoutes.js** — Social network routes
- **tenders.js** — Tender CRUD operations and contractor metadata
- **topicRoutes.js** — Topic extraction endpoints
- **topics.js** — Topic data endpoints
- **upload.js** — File upload handling
- **users.js** — User management endpoints

### `/uploads` — Static Files
_Not documented per user request_

---

## `/chatbot` — Rasa NLU & Dialog Engine

Conversational AI for citizen inquiries and support automation.

### Core Files
- **__init__.py** — Python package marker
- **README.md** — Chatbot documentation

### `/rasa` — Rasa Configuration & Data
- **config.yml** — Rasa training configuration
- **credentials.yml** — Third-party service credentials (Slack, etc.)
- **domain.yml** — NLU domain, intents, entities, slots
- **endpoints.yml** — Action server and backend service URLs

#### `/rasa/actions`
- **actions.py** — Custom action handlers (API calls, DB queries)

#### `/rasa/data`
- **nlu.yml** — NLU training data (intents, entities, examples)
- **rules.yml** — Dialog flow rules and response patterns

#### `/rasa/models`
Trained Rasa model artifacts (generated during `rasa train`)

#### `/rasa/tests`
Test data for validating NLU and dialog flows

### `/runtime` — Runtime Services
- **__init__.py** — Python package marker
- **rasa_bridge.py** — Bridge between backend and Rasa server
- **rasa_chat.py** — Chat session management and history
- **db_assistant.py** — DB query assistant using NLU context
- **profile_assistant.py** — User profile and preference assistant
- **site_assistant.py** — Site/location-based assistance

### `/service` — Chatbot Service
- **__init__.py** — Python package marker
- **app.py** — FastAPI service exposing chatbot endpoints

---

## `/config` — Configuration Files

- **priority_keywords.json** — Keywords for complaint prioritization and routing

---

## `/frontend` — React + Vite SPA

Modern web application for citizen and admin dashboards.

### Root Files
- **index.html** — HTML entry point
- **vite.config.js** — Vite build configuration
- **package.json** — npm dependencies and scripts
- **README.md** — Frontend documentation
- **OTPenable.md** — OTP feature documentation

### `/src` — Source Code

#### Core Application
- **main.jsx** — React entry point
- **App.jsx** — Main router and layout component

#### `/components` — Reusable UI Components
- **ProtectedRoute.jsx** — Route guard for authenticated pages

#### `/contexts` — React Context (State Management)
- **AuthContext.jsx** — Global authentication state and user profile

#### `/pages` — Page Components

##### `/pages/admin` — Admin Dashboard
- **Dashboard.jsx** — Main admin dashboard hub (links to modules)
- **Admin.css** — Admin module styling

##### `/pages/admin/fraud` — Fraud Detection Module
- **FraudModule.jsx** — Main fraud module container with tabs and data fetching
- **FraudOverviewPage.jsx** — Summary cards, key metrics, high-priority alerts
- **FraudAnalyticsPage.jsx** — Charts: risk distribution, severity, histograms
- **FraudFindingsPage.jsx** — Detailed findings table with filters and actions
- **FraudNetworkPage.jsx** — Collusion network visualization (D3)
- **FraudRunsPage.jsx** — Audit run history and execution logs
- **Fraud.css** — Fraud module comprehensive styling

###### `/pages/admin/fraud/components`
- **FindingsTable.jsx** — Expandable findings table with evidence and actions
- **NetworkGraph.jsx** — D3-powered force graph for network visualization
  - Contains `buildOverviewGraph()`, `buildClusterGraph()`, and interactive zoom/drag
- **fraudConstants.js** — Shared constants: `TYPE_ICON`, `TYPE_LABEL`, `SEV_COLOR`

#### Styling
- **index.css** — Global design tokens and base styles (colors, typography, spacing)
- **rasaChatbotWidget.css** — Chatbot widget styling

#### `/services` — API Client Layer
- Handles HTTP calls to backend (`/fraud`, `/complaints`, etc.)
- Centralized API URLs from `import.meta.env.VITE_API_URL`

#### `/utils` — Utility Functions
- Formatting, validation, storage helpers

---

## `/infra` — Infrastructure & Database

Database schemas, seeding scripts, and data pipeline.

### Database Schemas
- **core.sql** — Core domain tables: users, complaints, feedback
- **fraud.sql** — Fraud detection tables:
  - `tenders` — Public procurement tenders
  - `fraud_flags` — Detection findings (contractor_risk, duplicate_aadhaar, etc.)
  - `fraud_clusters` — Collusion clusters with evidence
  - `fraud_runs` — Execution history of detection runs
- **analytics.sql** — Analytics and reporting tables (optional)

### Configuration & Setup
- **db.py** — Database connection and utilities
- **create_labels_csv.py** — Generate label CSV for ML training

### `/core` — Core Data Seeding
- **seed_users.py** — Create demo users (admin, officer, citizen)
- **seed_complaints.py** — Load sample complaints and grievances
- **seed_complaint_notes.py** — Attach notes and updates to complaints
- **seed_labels.py** — Populate label and classification tables

### `/fraud-detection` — Fraud Data Seeding
- **seed_fraud_flags.py** — Generate synthetic fraud findings
- **seed_fraud_clusters.py** — Create demo collusion clusters
- **seed_tenders.py** — Load tender data for testing

### `/analytics` — Analytics & Simulation Data
- **daily_topics_seed.py** — Seed topic extraction results
- **social_feed_seed.py** — Load social media feed samples
- **simulation_runs.py** — Generate ABM simulation run records

---

## `/ml` — Machine Learning Services

Python FastAPI microservices for classification, sentiment analysis, and topic extraction.

### Root Files
- **__init__.py** — Python package marker
- **requirements.txt** — ML service dependencies (scikit-learn, transformers, etc.)

### `/classifier_service` — Document Classification
- **app.py** — FastAPI app exposing `/classify` endpoint
- **train.py** — Model training pipeline
- **retrain.py** — Retraining with new data
- **evaluate.py** — Model evaluation metrics
- **utils.py** — Shared utilities
- `/metrics` — Performance metrics and logs
- `/models` — Trained model artifacts (.pkl, .joblib)

### `/sentiment_service` — Sentiment Analysis
- **app.py** — FastAPI service for sentiment scoring
- **utils.py** — Sentiment analysis utilities

### `/topic_service` — Topic Extraction
- **app.py** — FastAPI service for topic modeling
- **extractor.py** — LDA/NMF topic extraction implementation

### `/myenv` — Python Virtual Environment
Complete Python environment with installed packages (generated by `python -m venv myenv`)

---

## `/simulation_service` — Agent-Based Modeling (ABM)

Python service for collusion network detection and graph analysis.

### Core Components
- **__init__.py** — Python package marker
- **app.py** — FastAPI server exposing `/fraud/graph` endpoint for ML-powered graph analysis
- **fraud_graph.py** — NetworkX-based fraud graph:
  - Community detection (Louvain algorithm)
  - Centrality calculations (betweenness, eigenvector)
  - Anomaly scoring based on network topology
  - Circular relationship detection

### Simulation Engine
- **model.py** — Core simulation model class
- **agents.py** — Agent definitions (Contractor, Official, Beneficiary)
- **abm_model.py** — Complete ABM implementation
- **abm_runner.py** — Simulation execution engine
- **abm_agents.py** — Agent behavior and interactions

### Testing & Verification
- **test_discovery.py** — Unit tests for community detection
- **verify_simulation.py** — Simulation output validation

---

## `/scripts` — Utility Scripts

- **retrain.sh** — Shell script to trigger ML model retraining

---

## `/reports` — Generated Reports

- **fake_metrics_2026-02.md** — Sample fraud audit report (generated or template)

---

## Fraud Detection Feature Overview

### Architecture
The fraud detection system is composed of multiple layers:

1. **Rule-Based Detection** (`backend/routes/fraud.js`)
   - Repeat winner detection: contractors winning ≥ threshold in 365 days
   - Price outlier: amount > mean + k·std per category
   - Duplicate beneficiary across tenders
   - Shared phone/address/bank clustering
   - Post-death disbursement checks
   - Regional disbursement spikes

2. **Graph-Based ML Analysis** (`simulation_service/fraud_graph.py`)
   - Community detection (Louvain algorithm)
   - Centrality-based anomaly scoring
   - Circular relationship identification
   - Called via `POST /fraud/graph` when ML service is available

3. **Frontend UI** (`frontend/src/pages/admin/fraud/`)
   - **Overview**: Key metrics, high-priority alerts, active modules
   - **Findings**: Expandable table with evidence, status tracking, bulk actions
   - **Analytics**: Charts (pie, bar, line) for distributions and trends
   - **Network**: D3 force graph for cluster visualization with drill-in capability
   - **Runs**: Audit execution history and performance logs

### Data Flow
1. Admin clicks "Run AI Detection" on `/admin/fraud`
2. Backend executes rule-based detection → creates `fraud_flags`, `fraud_clusters`
3. (Optional) If ML service active, calls `simulation_service/fraud_graph.py`
4. Results stored in DB and returned to frontend
5. Frontend displays findings, allows investigation workflow (open → investigating → escalated/confirmed/dismissed)

### Key Database Tables (infra/fraud.sql)
- **tenders** — Public procurement records
- **fraud_flags** — Individual findings (risk_score, severity, evidence)
- **fraud_clusters** — Collusion groups (suspiciousness_score, cluster_nodes, evidence)
- **fraud_runs** — Execution metadata (started_at, completed_at, summary)

---

## Development & Deployment

### Environment Setup
```bash
# Backend
cd backend && npm install && npm start

# ML services
cd ml && python -m venv myenv
source myenv/bin/activate && pip install -r requirements.txt
python classifier_service/app.py  # Port 8001
python sentiment_service/app.py   # Port 8002
python topic_service/app.py       # Port 8003

# Simulation/Graph service
cd simulation_service
python app.py  # Port 8004, exposes /fraud/graph

# Frontend
cd frontend && npm install && npm run dev

# Chatbot
cd chatbot && rasa train && rasa run -m models --enable-api
```

### Database Initialization
```bash
cd infra
python -c "from db import init_db; init_db()"
# OR manually run .sql files in psql/mysql
```

---

Generated on: 2026-04-30  
Updated to include all project files and comprehensive documentation.
