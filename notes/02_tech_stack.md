# Tech Stack — Complete Reference

---

## Stack Summary Table

| Layer | Technology | Version | Purpose | Where Used |
|---|---|---|---|---|
| Frontend | React | 18.2.0 | UI component framework | `frontend/src/` |
| Frontend | Vite | 8.0.8 | Build tool + dev server | `frontend/vite.config.js` |
| Frontend | react-router-dom | 6.20.0 | Client-side routing + nested routes | `frontend/src/App.jsx` |
| Frontend | axios | 1.6.2 | HTTP client for API calls | `frontend/src/utils/api.js`, all pages |
| Frontend | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 | Bar, line, doughnut charts | `SentimentDashboard.jsx`, `FraudAnalyticsPage.jsx` |
| Frontend | Recharts | 3.7.0 | AreaChart / LineChart for simulation | `Simulation.jsx`, `ResourceOptimizer.jsx` |
| Frontend | D3.js | 7.9.0 | Force-directed graph rendering | `FraudNetworkPage.jsx` |
| Frontend | react-force-graph-2d | 1.29.0 | React wrapper for D3 force graph | `FraudNetworkPage.jsx` |
| Frontend | Leaflet + react-leaflet | 1.9.4 / 4.2.1 | Interactive geospatial map | `ComplaintMap.jsx`, `FileComplaint.jsx` |
| Frontend | jsPDF | 4.2.1 | PDF report generation | `ReportExporter.jsx` |
| Frontend | emoji-picker-react | 4.18.0 | Emoji picker for social posts | `SocialFeed.jsx`, `SocialComposePage.jsx` |
| Frontend | react-hot-toast | 2.4.1 | Toast notifications | `App.jsx` |
| Backend | Node.js | ≥ 18.x | JavaScript runtime | `backend/` |
| Backend | Express | 5.1.0 | HTTP REST API framework | `backend/app.js`, all routes |
| Backend | pg (node-postgres) | 8.16.3 | PostgreSQL connection pool | `backend/db.js`, all route files |
| Backend | mongodb | 7.2.0 | MongoDB client + GridFS | `backend/db.js` |
| Backend | multer | 2.0.2 | Multipart file upload (memory buffer) | `complaints.js`, `social_feed.js` |
| Backend | jsonwebtoken | 9.0.2 | JWT sign + verify | `auth/auth.utils.js`, `middleware/auth.js` |
| Backend | bcryptjs | 3.0.3 | Password hashing (10 rounds) | `auth/auth.controller.js` |
| Backend | axios | 1.13.2 | HTTP calls to Python ML services | `routes/complaints.js`, `services/fraudPipeline.js` |
| Backend | dotenv | 17.2.3 | Load `.env` variables | `backend/server.js` |
| Backend | cors | 2.8.5 | CORS middleware | `backend/app.js` |
| AI/ML | scikit-learn | 1.5.2 | TF-IDF + LogReg classifier + IsolationForest + LOF | `ml/classifier_service/`, `simulation_service/app.py` |
| AI/ML | NLTK / VADER | 3.8.1 | Lexicon-based sentiment analysis | `ml/sentiment_service/utils.py` |
| AI/ML | YAKE | 0.4.8 | Unsupervised keyword extraction | `ml/topic_service/extractor.py` |
| AI/ML | Mesa | 3.1.1 | Agent-Based Modelling framework | `simulation_service/abm_*.py` |
| AI/ML | NetworkX | 3.2.1 | Graph analytics + community detection | `simulation_service/fraud_graph.py` |
| AI/ML | numpy | 1.26.4 | Numerical operations | `simulation_service/app.py`, `ml/classifier_service/` |
| AI/ML | pandas | 2.2.1 | Data loading in training scripts | `ml/` training scripts |
| AI/ML | joblib | 1.3.2 | Serialize/deserialize trained models | `ml/classifier_service/app.py` |
| AI/ML | Google Gemini 2.5 Flash | REST API | LLM consequence analysis | `simulation_service/app.py` |
| AI/ML | Rasa | 3.6.21 | NLU chatbot (DIETClassifier) | `chatbot/rasa/` |
| AI/ML | rasa-sdk | 3.6.2 | Custom Rasa action server | `chatbot/rasa/actions/` |
| AI/ML | httpx | (implicit) | Async HTTP client for Gemini calls | `simulation_service/app.py` |
| Backend (Python) | FastAPI | 0.110.0 | Async Python HTTP framework | `ml/classifier_service/`, `simulation_service/`, `chatbot/service/` |
| Backend (Python) | Flask | 2.2.5 | Lightweight Python HTTP framework | `ml/sentiment_service/`, `ml/topic_service/` |
| Backend (Python) | uvicorn | 0.27.1 | ASGI server for FastAPI services | All FastAPI services |
| Backend (Python) | psycopg2-binary | 2.9.9 | Direct PostgreSQL from Python | `chatbot/service/app.py` |
| Database | PostgreSQL | ≥ 14 | Primary relational store | All backend routes |
| Database | PostGIS | (extension) | Geospatial columns on complaints, social_feed | `infra/core.sql`, `infra/analytics.sql` |
| Database | pgcrypto | (extension) | UUID generation (`gen_random_uuid()`) | `infra/core.sql`, `infra/fraud.sql` |
| Database | MongoDB + GridFS | ≥ 6.0 | Binary image blob storage | `backend/db.js`, `complaints.js`, `social_feed.js` |
| Database | SQLite | (stdlib) | Simulation history persistence | `simulation_service/civictwin_results.db` |
| Infra | WhatsApp Cloud API | Meta API | OTP delivery via WhatsApp | `backend/auth/whatsapp.service.js` |
| AI/ML | Google Gemini (social) | REST API | Per-post engagement summary for social feed | `backend/routes/social_feed.js` |
| Infra | requests | 2.31.0 | HTTP client in Python seed/audit scripts | `scripts/ml_audit.py` |
| Infra | gunicorn | 21.2.0 | Production WSGI/ASGI server (optional) | Listed in `ml/requirements.txt` |

---

## Frontend

### Framework: React 18.2.0 + Vite 8.0.8

**Why React?** Declarative UI with hooks and Context API handles all the complex interactive state in the simulation and fraud dashboards. Vite replaces Create React App for faster HMR and build times.

**Key configuration** (`frontend/vite.config.js`):
```javascript
// Proxy /api → localhost:3000 to avoid CORS in development
server: { proxy: { '/api': 'http://localhost:3000' } }
```

**State management:** No Redux or Zustand. All state lives in:
- `AuthContext.jsx` — global auth state (user, token) in React Context + localStorage
- Component-level `useState` — each page manages its own data
- No shared data cache — every page re-fetches on mount

**Routing** (`frontend/src/App.jsx`):
- `react-router-dom` v6 with nested routes for fraud module and social feed module
- `ProtectedRoute` component checks `user.role` against `allowedRoles` prop
- Two roles: `citizen` and `admin`

### UI Libraries

**Chart.js + react-chartjs-2** (`SentimentDashboard.jsx`, `FraudAnalyticsPage.jsx`):
- Used for sentiment trend lines, category distribution doughnuts, and risk score bar charts
- Chosen for simple declarative API and good defaults for dashboard-style charts

**Recharts** (`Simulation.jsx`, `SimulationCompare.jsx`, `ResourceOptimizer.jsx`):
- Used for simulation time-series AreaCharts showing metric evolution per step
- Recharts handles the multi-line, multi-series data from ABM mean_by_step output more cleanly than Chart.js for this use case

**D3.js + react-force-graph-2d** (`FraudNetworkPage.jsx`):
- D3 force simulation renders the contractor/official/beneficiary collusion network
- react-force-graph-2d wraps D3 into a React component with zoom, pan, and node click handlers
- The graph nodes are coloured by entity type (contractor = red, official = blue, beneficiary = orange)

**Leaflet + react-leaflet** (`ComplaintMap.jsx`, `FileComplaint.jsx`):
- Interactive map for complaint geolocation — citizens pick their location on map when filing
- Admin complaint map clusters complaint pins by location; clicking a cluster drills down to individual complaints

**jsPDF** (`ReportExporter.jsx`):
- Generates downloadable PDF reports of simulation results including charts and AI consequence analysis
- Also supports markdown/JSON export formats

---

## Backend

### Language: Node.js, Framework: Express 5.1.0

Express 5.x (pre-release) is used. The factory pattern in `app.js` is clean:
```javascript
function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  // 13 route groups registered here
  return app;
}
```

**API style:** REST. No GraphQL or gRPC.

**No ORM** — all SQL is raw parameterised queries via `pg.Pool`. This is intentional for performance and fine-grained control, but means schema changes must be managed manually via the SQL files in `/infra`.

### Dual Database Connection (`backend/db.js`)

The backend maintains two separate database connections:
1. **PostgreSQL pool** (`pg.Pool`) — for all relational data
2. **MongoDB GridFS** (`MongoClient` + two `GridFSBucket` instances) — for image blobs

```javascript
// Two GridFS buckets — isolated storage per feature
gridBucket      = new GridFSBucket(db, { bucketName: "socialFeedImages" })
complaintBucket = new GridFSBucket(db, { bucketName: "complaintImages" })
```

MongoDB connection is lazy-initialised on first use and fails gracefully (the app continues to function without image storage).

### Key Route Files

| File | Prefix | Key behaviour |
|---|---|---|
| `auth/auth.routes.js` | `/api/auth` | JWT login, bcrypt register, Aadhaar OTP via WhatsApp |
| `routes/complaints.js` | `/complaints` | File complaint → ML classify + sentiment → PostGIS INSERT; GridFS image upload/serve |
| `routes/fraud.js` | `/fraud` | Trigger `runFraudPipeline()`, GET runs/findings/clusters |
| `routes/social_feed.js` | `/social` | CRUD posts, likes, comments; GridFS image upload/serve (22 KB — largest route file) |
| `services/fraudPipeline.js` | (service, no prefix) | 31 KB rule engine — 9 detection patterns, ML service calls, DB upserts |

### Authentication Flow
```
POST /api/auth/login { email, password, aadhaar }
  → DB lookup: users WHERE email=$1 AND aadhaar_number=$2 AND is_aadhaar_verified=true
  → bcrypt.compare(password, hash)
  → jwt.sign({ id, role }, JWT_SECRET)    ← ⚠️ No expiresIn set — tokens never expire
  → return { token }
```

### Complete API Endpoint Table

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user (bcrypt hash + Aadhaar lookup) |
| POST | `/api/auth/login` | No | Email + password + Aadhaar → JWT |
| POST | `/api/auth/aadhaar/request-otp` | No | Generate OTP and send via WhatsApp |
| POST | `/api/auth/aadhaar/verify-otp` | No | Validate OTP → mark Aadhaar as verified |
| GET | `/users/me` | Yes | Get own profile |
| GET | `/users/` | Admin | List all users |
| GET | `/complaints` | Yes | List complaints (paginated, filterable by status/category/user) |
| POST | `/complaints` | Yes | File complaint → ML classify + sentiment → PostGIS INSERT |
| GET | `/complaints/:id` | Yes | Get single complaint with full metadata |
| PATCH | `/complaints/:id/status` | Admin | Update complaint status |
| POST | `/complaints/:id/labels` | Admin | Apply admin label (category/priority override) |
| POST | `/complaints/:id/notes` | Yes | Add internal note to complaint |
| POST | `/complaints/upload-image` | Yes | Upload image to GridFS → return ObjectId |
| GET | `/complaints/image/:id` | No | Stream image from GridFS |
| GET | `/tenders` | Yes | List tenders (paginated, filterable) |
| POST | `/tenders` | Yes | Create tender record |
| GET | `/tenders/:id` | Yes | Get single tender |
| POST | `/tenders/contractor-names` | Yes | Batch lookup contractor names by IDs |
| POST | `/fraud/run` | Admin | Trigger full fraud pipeline |
| GET | `/fraud/flags` | Yes | List fraud findings (limit 500) |
| PATCH | `/fraud/flags/:id` | Admin | Update finding status (open/investigating/etc.) |
| GET | `/fraud/clusters` | Yes | List collusion clusters |
| GET | `/fraud/runs` | Yes | List audit run history |
| GET | `/fraud/runs/latest` | Yes | Get most recent audit run |
| GET | `/fraud/report` | Yes | Get text or JSON fraud report from last run |
| GET | `/social` | Yes | List social posts (paginated, pin-sorted) |
| POST | `/social` | Yes | Create social post |
| GET | `/social/image/:id` | No | Stream social image from GridFS |
| POST | `/social/:id/reactions` | Yes | Upsert or remove reaction (like/love/care/wow/concern) |
| POST | `/social/:id/comments` | Yes | Add comment to post |
| POST | `/social/:id/save` | Yes | Toggle post save |
| POST | `/social/:id/view` | Yes | Increment view count |
| PATCH | `/social/:id/pin` | Admin | Toggle pin status |
| PATCH | `/social/:id/archive` | Admin | Toggle archive status |
| DELETE | `/social/:id` | Yes | Delete post (admin or owner) |
| POST | `/social/:id/ai-summary` | Admin | Gemini engagement summary for a post |
| POST | `/simulation/*` | Yes | Proxy to simulation service (port 8003) |
| POST | `/topics_analytics/extract_and_store` | No | Run YAKE on date’s texts → store to daily_topics |
| GET | `/topics_analytics/` | No | Get daily topics for a date |
| POST | `/sentiment` | No | Proxy sentiment text to VADER service |
| POST | `/sentiment/store` | No | Score text and UPDATE complaints or social_feed |
| GET | `/alerts/sentiment_spike` | No | Detect 3σ spike in today’s negative sentiment |
| GET | `/upload` | No | Generic static file serve from `/uploads` |
| GET | `/` | No | Health check: returns service status string |

---

## AI & ML

### Model 1: Complaint Classifier (TF-IDF + Logistic Regression)
- **File:** `ml/classifier_service/app.py`
- **Model:** scikit-learn TF-IDF vectoriser (max_features=5000, ngram_range=(1,2)) + Logistic Regression
- **Training data:** `ml/labels.csv` — 5.8 KB hand-labeled complaint texts
- **Artifacts:** `ml/classifier_service/models/tfidf.joblib`, `logreg.joblib` (pre-trained, committed)
- **Output:** `{ category, priority (0–1), probs: {cat: prob}, reasons: [...], top_tokens: [...] }`
- **Priority formula:** `0.2 + 0.8 × max_class_confidence` then `+0.15 per matching priority keyword`
- **Explainability:** Returns top 10 TF-IDF feature tokens that contributed to the classification

### Model 2: VADER Sentiment Analyser
- **File:** `ml/sentiment_service/utils.py`
- **Model:** NLTK `SentimentIntensityAnalyzer` — rule-based, no training required
- **Output:** `{ label: "positive"|"neutral"|"negative", score: compound (-1 to 1) }`
- **Thresholds:** `compound ≥ 0.05` → positive; `compound ≤ −0.05` → negative
- **Integration in complaints:** Backend applies priority boost: `−0.50 ≤ compound → +0.15`, `−0.20 ≤ compound < −0.50 → +0.08`

### Model 3: YAKE Keyword Extractor
- **File:** `ml/topic_service/extractor.py`
- **Model:** YAKE (Yet Another Keyword Extractor) — statistical, unsupervised, no training required
- **Endpoint:** `POST /extract { documents: [str], top_n: int }` → top N keywords with scores
- **Used for:** Daily topic extraction from complaints + social posts → stored in `daily_topics` table

### Model 4: IsolationForest + LOF Anomaly Detection (Ensemble)
- **File:** `simulation_service/app.py` — `POST /fraud/anomaly`
- **Models:** `sklearn.ensemble.IsolationForest(contamination=0.15, random_state=42)` and `sklearn.neighbors.LocalOutlierFactor(n_neighbors=min(10, n-1), contamination=0.15)`
- **Input feature vectors:**
  - Contractors (5D): `[wins, avg_amount, max_amount, single_bid_rate, overrun_rate]`
  - Beneficiaries (4D): `[claim_count, unique_phones, unique_addresses, unique_banks]`
- **Ensemble logic:** Entity is flagged if either model predicts outlier; score = `(iso_score + lof_score) / 2` normalised to (0,1)

### Model 5: NetworkX Fraud Graph Analysis
- **File:** `simulation_service/fraud_graph.py`
- **Algorithm:** `nx.community.greedy_modularity_communities()` (falls back to `nx.connected_components()`)
- **Node types:** contractor, official, beneficiary, phone, address, bank
- **Centrality metrics:** degree centrality (0.4 weight) + betweenness centrality (0.4) + eigenvector centrality (0.2)
- **Circular relationship detection:** `nx.simple_cycles()` flags contractor↔approver loops; score boosted +0.3
- **Cluster risk score:** `edge_density × 0.6 + avg_centrality × 0.4`

### Model 6: Mesa ABM (Agent-Based Model)
- **Files:** `simulation_service/abm_model.py`, `abm_agents.py`, `abm_runner.py`
- **Framework:** Mesa 3.1.1
- **Agent types and counts:** Worker (120), Firm (8), Household (45), Government (1), InfrastructureAgent (1), EnvironmentAgent (1)
- **Step order (causal):** Government → InfrastructureAgent → EnvironmentAgent → [Workers, Firms, Households shuffled]
- **Tracked metrics per step:** unemployment_rate, avg_income, avg_welfare, migration_count, infrastructure_score, env_score
- **Multi-seed:** Runs N seeds, aggregates mean_by_step and std_by_step

### Model 7: Google Gemini 2.5 Flash (LLM)
- **File:** `simulation_service/app.py` — `POST /analyse/consequences`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **Configuration:**
```python
"generationConfig": {
    "responseMimeType": "application/json",   # forces JSON output
    "maxOutputTokens": 2048,
    "temperature": 0.3,
    "thinkingConfig": {"thinkingBudget": 0}   # thinking disabled for speed
}
```
- **System prompt:** "You are a policy risk analyst for CivicTwin, an Indian civic simulation platform. Return ONLY valid JSON, no markdown. Use Indian Rupees (₹ crore)."
- **User prompt:** Injects real simulation stats (employment start/end/range, welfare, infra, env) + policy description + strict JSON output schema
- **Output schema:** `{ overall: "2-3 sentence assessment", risks: [{ dimension, severity, finding, recommendation }] }`
- **Retry:** Exponential backoff `[12s, 24s, 48s]` on 429 rate-limit
- **Fallback:** Full deterministic stats-based function (`_consequence_fallback()`) produces identical schema without LLM

### Model 8: Rasa NLU (DIETClassifier)
- **Files:** `chatbot/rasa/config.yml`, `chatbot/rasa/data/`
- **Pipeline:** DIETClassifier (intent + entity recognition) + ResponseSelector (FAQ-style)
- **Role in system:** Handles general civic Q&A. For domain-specific questions (complaint data, platform navigation, user profile), the FastAPI router (`chatbot/service/app.py`) intercepts the message *before* sending to Rasa and routes to the appropriate rule-based assistant.
- **Training:** `rasa train` from `chatbot/rasa/` using Python 3.10 venv

### Model 9: Google Gemini (Social Feed Engagement Summariser)
- **File:** `backend/routes/social_feed.js` — `POST /social/:id/ai-summary`
- **Model:** Dynamic resolution: checks Gemini API for available models; prefers `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash-latest` → `gemini-1.5-flash` (admin-configurable via `GEMINI_MODEL` env var)
- **Config:** `temperature: 0.4, maxOutputTokens: 280, timeout: 15000ms`
- **Prompt:** Sends post text + reaction counts (like/love/care/wow/concern) + last 40 comments; requests JSON with `overallSentiment`, `topTopics`, `recommendedAction`
- **Fallback:** Returns static "Gemini key is not configured" message if `GEMINI_API_KEY` is absent
- **Note:** This is a *second, independent* Gemini integration from the simulation consequence analysis. It uses a different model resolution strategy and smaller output token budget.

---

## Database & Storage

### PostgreSQL — Primary Relational Store
- **Connection:** `pg.Pool` in `backend/db.js`, direct `psycopg2` in `chatbot/service/app.py`
- **Schema files:** `infra/core.sql`, `infra/fraud.sql`, `infra/analytics.sql`
- **Extensions required:** `postgis` (geospatial), `pgcrypto` (UUID generation)
- **No ORM** — all queries are raw parameterised SQL via the `pg` driver

### MongoDB + GridFS — Binary Image Storage
- **Connection:** `MongoClient` in `backend/db.js`
- **Two buckets:**
  - `socialFeedImages` — images attached to social posts
  - `complaintImages` — images attached to citizen complaints
- **Storage pattern:** Upload returns MongoDB ObjectId (24-char hex) stored as text in PostgreSQL. Frontend fetches image via `/social/image/:id` or `/complaints/image/:id`.

### SQLite — Simulation History
- **File:** `simulation_service/civictwin_results.db` (744 KB, already populated)
- **Schema:**
```sql
CREATE TABLE simulations (
    id           TEXT PRIMARY KEY,   -- UUID
    created_at   TEXT NOT NULL,
    source       TEXT NOT NULL,      -- 'classic' | 'abm'
    config_json  TEXT,
    results_json TEXT
)
```
- **Purpose:** Survives service restarts without needing PostgreSQL. The in-memory `Dict` is the primary store; SQLite is the fallback when the service restarts.

---

## Infrastructure & DevOps

| Area | Current State | Notes |
|---|---|---|
| Docker | ❌ None | Build logs (`docker_build*.log`) exist but no `Dockerfile` or `docker-compose.yml` |
| CI/CD | ❌ None | No GitHub Actions, no linting pipeline |
| Cloud | ❌ None | All config points to localhost; no cloud provider references |
| Process manager | ❌ Manual | Each service started individually per the runbook |
| Reverse proxy | ❌ None | All services expose their port directly |
| HTTPS/TLS | ❌ None | All traffic is plaintext HTTP |

### Environment Variables (`.env.example`)
```env
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD   # PostgreSQL
ML_SERVICE_URL=http://localhost:8001               # Classifier
DATABASE_URL=postgresql://...                      # Python scripts
JWT_SECRET                                         # Token signing
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN           # OTP delivery
VITE_API_URL=http://localhost:3000                 # Frontend → backend
VITE_SIMULATION_API_URL=http://localhost:8003      # Frontend → simulation
VITE_CHATBOT_API_URL=http://localhost:8002         # Frontend → chatbot
GEMINI_API_KEY                                     # Consequence analysis (optional)
MONGO_URI=mongodb://localhost:27017/mydb           # GridFS
```

**Missing from `.env.example` (undocumented):**
```env
SENTIMENT_SERVICE_URL=http://localhost:6001        # Used in complaints.js
BACKEND_API_URL=http://localhost:3000             # Used in chatbot/service/app.py
```

---

## External APIs & Services

| API | Purpose | Auth | File |
|---|---|---|---|
| Google Gemini 2.5 Flash | Simulation consequence narrative | `GEMINI_API_KEY` query param | `simulation_service/app.py` |
| Google Gemini (dynamic model) | Social post engagement summary | `GEMINI_API_KEY` query param | `backend/routes/social_feed.js` |
| Meta WhatsApp Cloud API | OTP delivery via WhatsApp message | `WHATSAPP_TOKEN` bearer | `backend/auth/whatsapp.service.js` |

No social media data APIs (Twitter/X, Facebook) are integrated. All social feed data is seeded/user-generated within the platform.

### All Services — Port Reference

| Port | Service | Language/Framework | Directory |
|---|---|---|---|
| 3000 | Backend REST API | Node.js / Express | `backend/` |
| 5173 | Frontend (dev) | React / Vite | `frontend/` |
| 5432 | PostgreSQL | — | (system) |
| 27017 | MongoDB | — | (system) |
| 8001 | ML Classifier | Python / FastAPI | `ml/classifier_service/` |
| 6001 | Sentiment Service | Python / Flask | `ml/sentiment_service/` |
| 6002 | Topic Service | Python / Flask | `ml/topic_service/` |
| 8003 | Simulation + Fraud ML + ABM | Python / FastAPI | `simulation_service/` |
| 5005 | Rasa NLU (optional) | Rasa 3.6 | `chatbot/rasa/` |
| 8002 | Chatbot API | Python / FastAPI | `chatbot/service/` |

### `ml/requirements.txt` Notes

The requirements file has two issues worth knowing:
- **`numpy==1.26.4` listed twice** (lines 13 and 14) — harmless duplicate, pip resolves to one version
- **`mesa==2.1.5` (line 17) AND `mesa==3.1.1` (line 49)** — conflicting versions; pip installs the last one (`3.1.1`). The Mesa 3.x API has breaking changes from 2.x. Remove line 17.
- **`sqlalchemy==2.0.28` and `psycopg2-binary==2.9.9`** — listed in the ML venv but not used by any ML service directly; the chatbot uses psycopg2 in its own separate venv (`chatbot/.venv`). These are dead dependencies in the ML venv.
- **`gunicorn==21.2.0`** — listed as optional; none of the Flask services use it (they call `app.run()` directly). Useful if deploying with a process manager.

---

## Why These Technologies?

| Decision | Rationale |
|---|---|
| **Express 5 over Fastify/Hono** | Team familiarity; broad ecosystem for the diverse set of routes needed |
| **Mesa for ABM** | Only mature Python ABM framework; Mesa 3.x has improved multi-agent scheduling over 2.x |
| **VADER over transformer-based sentiment** | No GPU required, instant startup, sufficient accuracy for civic complaint text in English |
| **YAKE over LDA/BERTopic** | Unsupervised, no training corpus needed, works well on short civic text, fast |
| **NetworkX for graph analysis** | Standard Python graph library; greedy modularity community detection is fast enough for tender-scale graphs |
| **IsolationForest + LOF ensemble** | Both are unsupervised (no labelled fraud data available); ensemble reduces false-positive rate |
| **Gemini 2.5 Flash over GPT-4** | Lower cost per token, `responseMimeType: application/json` enforces structured output natively, adequate quality for consequence narratives |
| **Dual DB (PostgreSQL + MongoDB)** | PostgreSQL for relational integrity and PostGIS geospatial; MongoDB GridFS for efficient large binary streaming without base64 overhead |
| **SQLite for simulation persistence** | Zero-config embedded DB; simulation results must survive service restarts without requiring PostgreSQL to be available |
| **Rasa over pure LLM chatbot** | Offline-capable, no per-query API cost, predictable for known civic intents; complex domain queries fall back to deterministic Python assistants anyway |
