# Gaps, Status & Next Steps

---

## Honest Project Status

CivicTwin is a **working, feature-complete prototype** — not a production system. All 5 core components are built and locally functional. A developer can install all dependencies, run 8 terminal processes, and interact with complaints, fraud detection, AI simulation, and the social feed. However, the project relies entirely on synthetic/seeded data (fake tenders, mock Aadhaar, hand-seeded social posts), has zero automated tests, no containerisation, and several security gaps that would be blockers for any public deployment. The codebase is strong technically but not production-hardened. Estimate: **85% of the envisioned feature set is implemented**, with the remaining 15% being real-world data integrations, testing infrastructure, and deployment scaffolding.

---

## Component-by-Component Status

| Component | Status | % Done | What Works | What's Missing |
|---|---|---|---|---|
| Policy Impact Simulator | ✅ Complete | 95% | ABM runs, live progress, comparison, resource optimizer, PDF export, Gemini AI analysis with fallback | No streaming (SSE) — uses 1s polling; no user history persistence in PostgreSQL (only SQLite) |
| Grievance Redressal | ✅ Complete | 90% | File complaint, ML classify, sentiment boost, GridFS images, admin list/map/detail/labels/notes/status | Classifier trained on ~150 examples only; English-only NLP; no auto-retraining when admins add labels |
| Fraud Detection | ✅ Complete | 88% | 9 rule patterns, IsolationForest+LOF anomaly, NetworkX graph, D3 network UI, findings/clusters dashboard | No LLM narrative for fraud findings; relies entirely on synthetic tender data; no live procurement data |
| Sentiment & Engagement | ✅ Complete | 85% | VADER sentiment on complaints + social, YAKE daily topics, social feed with posts/likes/comments, admin charts | No scheduled auto-extraction (manual trigger only); English-only VADER; no multilingual support |
| Collusion Detector | ✅ Complete | 85% | Greedy modularity community detection, circular relationship detection, eigenvector centrality scoring | Blended into fraud pipeline — not independently surfaced; graph built from synthetic data only |

---

## What is Fully Working

A user can do all of these right now with the local setup:

- **Register** with email + password + Aadhaar number (from the mock registry seed)
- **Login** and be redirected to the correct citizen or admin dashboard
- **File a complaint** with title, text, geolocation, and photo — the ML classifier assigns a category and priority score automatically
- **View their own complaints** with status tracking
- **Browse the social feed** — view posts, like them, add comments, save posts, upload photos
- **Admin: Generate AI summary of a social post** — `POST /social/:id/ai-summary` triggers Gemini analysis of reactions and comments
- **Admin: View all complaints** in a paginated table and on a Leaflet geospatial map
- **Admin: Drill into a complaint** — add labels, internal notes, update status
- **Admin: Trigger a fraud audit** — the pipeline runs against all seeded tenders and produces findings
- **Admin: View fraud findings** — table with severity filters, D3 collusion network graph, audit run history
- **Admin: View sentiment dashboard** — VADER scores charted over time by category and date
- **Admin: Run an ABM simulation** — type a policy scenario, watch live step progress, get AI consequence analysis
- **Admin: Compare two simulation scenarios** side-by-side
- **Admin: Run the resource optimizer** — 6 budget variants ranked by custom priority weights
- **Admin: Export simulation report** as PDF or JSON
- **Chatbot** — ask civic questions; chatbot routes to DB assistant, profile assistant, or Rasa NLU

---

## What is Partially Built

- **Classifier retraining:** `ml/classifier_service/retrain.py` and `scripts/retrain.sh` exist, but there is no trigger — admin-applied labels are stored but not fed back automatically into the training pipeline
- **Rasa chatbot NLU:** The Rasa model trains and runs, but because the FastAPI router intercepts domain-specific queries before they reach Rasa, the NLU model's actual reach is limited. Its training data quality is unknown.
- **Alert spike detection:** `backend/routes/alertRoutes.js` (`GET /alerts/sentiment_spike`) detects 3σ spikes in daily negative sentiment using a statistical algorithm. However, there is no delivery mechanism — no email, push, or SMS is triggered when a spike is detected. The detection logic exists; the response pipeline does not.
- **Simulation PostgreSQL persistence:** `analytics.sql` defines `simulation_runs` table, but the simulation service primarily uses SQLite (`civictwin_results.db`). The PostgreSQL table is defined but not actively written to from the simulation service.
- **Classic simulation mode:** `simulation_service/runner.py`, `agents.py`, and `model.py` implement a simpler single-agent CitizenAgent simulation. It is wired to `POST /simulate` but the frontend primarily uses the ABM mode (`/abm/simulate`).
- **Social feed schema migration:** Many social feed columns (`is_pinned`, `is_archived`, `view_count`, `image_url`, etc.) are not in `infra/analytics.sql`. They are added at runtime via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `social_feed.js`. This works but means a fresh database setup from SQL files alone is incomplete — you must run the backend to trigger schema completion.

---

## What is Stubbed or Mocked

| Item | Location | What it pretends to be | Reality |
|---|---|---|---|
| **Aadhaar registry** | `infra/core.sql`, `backend/auth/aadhaar.service.js` | India's national Aadhaar database | A local PostgreSQL table with seeded fake Aadhaar numbers. `aadhaar.service.js` is 255 bytes — just a query to this local table. |
| **Tender data** | `infra/fraud-detection/seed_tenders.py` | Government procurement records | 14.8 KB of procedurally generated fake contractors, amounts, and departments |
| **Social feed content** | `infra/analytics/social_feed_seed.py` | Real citizen social media posts | 4.1 KB of synthetic posts seeded for demo purposes |
| **Complaint seed data** | `infra/core/seed_complaints.py` | Real citizen grievances | Synthetic complaints written to demonstrate classification |
| **Label seed data** | `infra/core/seed_labels.py` | Real admin-labeled complaints | Seed labels applied to seeded complaints — not derived from real admin review |
| **User seed data** | `infra/core/seed_users.py` | Real registered users | Synthetic users with bcrypt-hashed passwords and fake Aadhaar numbers |
| **Fraud flags/clusters** | `infra/fraud-detection/seed_fraud_flags.py`, `seed_fraud_clusters.py` | Real detected fraud | Pre-seeded findings applied to synthetic tender data |
| **Simulation history** | `infra/analytics/seed_simulation_runs.py` | Real past simulation runs | Synthetic simulation result records |
| **Priority keywords** | `config/priority_keywords.json` | Domain-tuned urgency signals | 92 bytes — likely only a handful of keywords defined |
| **Fake metrics report** | `reports/fake_metrics_2026-02.md` | Monthly analytics | Placeholder document, not derived from real data |
| **Social feed schema** | Runtime `ALTER TABLE` in `social_feed.js` | Static schema defined in SQL | 9 columns added at runtime via `ensureSocialSchema()` — not in `infra/analytics.sql` |

---

## What is Not Started

- **Real Aadhaar UIDAI integration** — requires government API partnership; UIDAI sandbox access not obtained
- **Live social media data ingestion** — no Twitter/X, Facebook, or Instagram API integration
- **Live government procurement data** — no integration with PM GatI Shakti, CPPP, or any state e-procurement portal
- **Multilingual NLP** — all ML is English-only; no Hindi, Tamil, Telugu, or regional language support
- **Docker / docker-compose** — build logs exist but no `Dockerfile` or `docker-compose.yml` at any service level
- **CI/CD pipeline** — no GitHub Actions, no automated testing on PR
- **Automated test suite** — zero unit tests (Jest, pytest), zero integration tests, zero E2E tests (Playwright/Cypress)
- **Scheduled jobs** — no cron or task queue for daily topic extraction, sentiment re-scoring, or periodic fraud re-audit
- **LLM narrative for fraud findings** — fraud findings are rule-generated text; no Gemini/GPT analysis of what each finding means
- **HTTPS / TLS** — all services run on plain HTTP
- **Real-time push** — no WebSockets or SSE for complaint status updates or live alert delivery
- **Ward/district boundary data** — geospatial map shows complaint pins but no administrative boundary overlays for aggregation

---

## Known Bugs & Issues

| Issue | Severity | File / Location | Notes |
|---|---|---|---|
| JWT tokens have no expiry | High | `backend/auth/auth.utils.js` line ~15 | `jwt.sign()` called without `expiresIn` — tokens never expire; a stolen token is permanently valid |
| CORS wildcard on all origins | High | `backend/app.js` line 21 | `app.use(cors())` with no config — allows all origins in production |
| Chatbot CORS spec violation | High | `chatbot/service/app.py` lines 27–33 | `allow_origins=["*"]` + `allow_credentials=True` — spec-invalid combination; browsers will reject credentialed requests |
| Classifier CORS spec violation | Medium | `ml/classifier_service/app.py` lines 22–28 | Same issue — `allow_origins=["*"]` + `allow_credentials=True` in the classifier FastAPI service |
| `SENTIMENT_SERVICE_URL` not in `.env.example` | Medium | `backend/routes/complaints.js:94` | Variable used but not documented — new developers won't know to set it |
| `BACKEND_API_URL` not in `.env.example` | Medium | `chatbot/service/app.py` | Same issue — undocumented environment variable |
| `GEMINI_MODEL` not in `.env.example` | Low | `backend/routes/social_feed.js:10` | `process.env.GEMINI_MODEL` used to override the Gemini model for social summaries, but not documented |
| Duplicate Mesa versions in requirements | Medium | `ml/requirements.txt:17,49` | Both `mesa==2.1.5` and `mesa==3.1.1` listed — the API changed significantly between versions; pip installs 3.1.1 (last wins) |
| Duplicate numpy in requirements | Low | `ml/requirements.txt:13,14` | `numpy==1.26.4` listed twice — harmless but untidy |
| Dead SQLAlchemy dependency in ML venv | Low | `ml/requirements.txt:22` | `sqlalchemy==2.0.28` installed in ML venv but not imported by any ML service |
| Debug `console.log` in production routes | Low | `backend/routes/complaints.js:161–164` | Logs complaint IDs and row counts to stdout — should be removed or replaced with structured logging |
| `SocialFeedDashboard.jsx` dead code | Low | `frontend/src/pages/admin/SocialFeedDashboard.jsx` | 26 KB legacy monolith retained alongside the new modular `admin/social/` pages — never navigated to but still in the bundle |
| `docker_build*.log` committed to repo | Low | Root directory | 440 KB of build logs — should be gitignored |
| `sample.txt` committed to repo | Low | Root directory | 34-byte scratch file — should be deleted or gitignored |
| No rate limiting on auth endpoints | High | `backend/app.js` — no middleware added | `POST /api/auth/login` is open to brute-force; no `express-rate-limit` |
| No input schema validation | Medium | All POST/PATCH routes | Field presence is checked (`if (!title)`) but no type/length/format validation (no Zod/Joi) |
| SQLite not safe for concurrent production use | Medium | `simulation_service/civictwin_results.db` | SQLite has write lock contention under concurrent requests; fine for dev, not suitable for production load |
| Social feed schema not in SQL files | Medium | `backend/routes/social_feed.js` — `ensureSocialSchema()` | 9 columns + 3 tables created at runtime via `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS`; a fresh database setup from SQL files alone is incomplete until the backend runs at least once |

---

## Immediate Next Steps (Priority Order)

### 1. Fix critical security issues (1–2 days)
```javascript
// auth/auth.utils.js — add expiry
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

// app.js — restrict CORS
app.use(cors({ origin: ['http://localhost:5173', 'https://yourdomain.com'] }));
```
```python
# chatbot/service/app.py — fix CORS
allow_origins=["http://localhost:5173"],   # remove wildcard
allow_credentials=False,                   # or use specific origins
```

### 2. Document missing environment variables (30 minutes)
Add these to `.env.example`:
```env
SENTIMENT_SERVICE_URL=http://localhost:6001
BACKEND_API_URL=http://localhost:3000
GEMINI_MODEL=gemini-2.0-flash   # Optional: override model used for social feed AI summaries
```

### 3. Clean up the repository (1 hour)
Add to `.gitignore`:
```
docker_build*.log
sample.txt
reports/fake_metrics_2026-02.md
*.db   # or just civictwin_results.db specifically
```
Delete `frontend/src/pages/admin/SocialFeedDashboard.jsx` (replaced by modular social pages).

### 4. Fix duplicate/dead dependencies in requirements (5 minutes)
- Remove `mesa==2.1.5` from `ml/requirements.txt:17` — keep only `mesa==3.1.1`
- Remove duplicate `numpy==1.26.4` on line 14
- Remove `sqlalchemy==2.0.28` and `psycopg2-binary==2.9.9` from ML venv (they belong in `chatbot/.venv` only)

### 5. Migrate social feed schema to SQL files (1 hour)
Move the runtime `ALTER TABLE` statements from `social_feed.js` into a new `infra/social_extensions.sql` migration file. This ensures a fresh database setup from SQL files alone is complete without needing to run the backend first.

### 6. Add rate limiting to auth endpoints (2 hours)
```javascript
// npm install express-rate-limit
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, message: 'Too many attempts' });
app.use('/api/auth/login', authLimiter);
```

### 7. Write a basic pytest suite for ML services (1–2 days)
At minimum: health check tests, one classify test with known input, one sentiment test with known sentiment input.

### 8. Build Docker Compose (2–3 days)
Containerise all 8 services with health-check dependencies to replace the 8-terminal manual startup.

---

## Roadmap

### Phase 1 — Working Demo (Next 4 Weeks)
The goal is a shareable demo that runs with a single command and shows all 5 components with realistic data.

- [ ] `docker-compose.yml` for all 8 services
- [ ] Fix the 3 critical security bugs (JWT expiry, CORS, rate limiting)
- [ ] Replace synthetic tender seed with at least 1,000 realistic records
- [ ] Add basic Hindi keyword support to the VADER sentiment pipeline (or add a Hindi stopword filter)
- [ ] Automated daily topic extraction (simple cron job or Node.js `node-schedule`)
- [ ] LLM-generated fraud finding summaries (apply same Gemini integration from simulation to fraud pipeline)
- [ ] Basic `pytest` tests for all 3 ML services
- [ ] Clean up repo (remove log files, dead code, document missing env vars)

### Phase 2 — Beta Version (1–3 Months)
The goal is a system someone outside the team can evaluate with real data.

- [ ] GitHub Actions CI pipeline: lint → test → build on every PR
- [ ] Input validation with Zod on all backend routes
- [ ] Replace polling with Server-Sent Events (SSE) for simulation progress
- [ ] Automated retraining pipeline: admin labels → trigger `/retrain` → update deployed model
- [ ] Expand classifier training data to 1,000+ labeled examples across all categories
- [ ] PostgreSQL-backed simulation run history (replace/supplement SQLite)
- [ ] Alert delivery mechanism (email via SendGrid or SMS via Twilio)
- [ ] Ward/district boundary overlay on Leaflet complaint map
- [ ] HTTPS via Nginx reverse proxy + Let's Encrypt

### Phase 3 — Full Vision (3–12 Months)
The goal is a genuinely useful governance platform deployable to a real municipality.

- [ ] **Real Aadhaar integration** — UIDAI Aadhaar Authentication API sandbox → production
- [ ] **Live procurement data** — PM GatI Shakti API or CPPP tender feed integration
- [ ] **Live social data** — Twitter/X Academic API + Facebook Graph API ingestion
- [ ] **Multilingual NLP** — IndicBERT or MuRIL for Hindi/regional language complaint classification and sentiment
- [ ] **RAG-powered chatbot** — Replace rule-based domain assistants with pgvector + embeddings over actual complaint/tender data
- [ ] **LLM fraud narratives** — Natural language explanations for each fraud finding, not just rule descriptions
- [ ] **Citizen mobile app** — React Native app for complaint filing with native camera and GPS
- [ ] **Admin notification system** — Push notifications for high-severity fraud findings and priority complaint spikes
- [ ] **Multi-municipality support** — Multi-tenant architecture for different cities with data isolation
- [ ] **Geospatial analytics** — Heatmaps, ward-level complaint aggregation, regional comparison dashboards
- [ ] **Open data export** — Anonymised complaint and sentiment datasets for academic/policy research
