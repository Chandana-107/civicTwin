# Data & AI Architecture

---

## System Data Flow

The diagram below shows how data enters and moves through the system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CITIZEN (Browser)                           │
│   Files complaint / posts social content / asks chatbot             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP REST
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Node.js Backend API (:3000)                       │
│  auth/middleware → routes/complaints.js → services/fraudPipeline.js │
└──────┬──────────────┬────────────────┬────────────────┬─────────────┘
       │              │                │                │
    axios          axios           PostgreSQL        MongoDB
       │              │             (pool)            GridFS
       ▼              ▼                │                │
  ML Classifier   Sentiment        Stores             Stores
   (:8001)        (:6001)         core data          images
  TF-IDF+LogReg  VADER NLP        (all tables)       (blobs)
       │              │
    category        sentiment
    priority        score/label
    reasoning       priority boost
       │              │
       └──────────────┘
              │
              ▼
     PostgreSQL INSERT
     (complaints table)
     with PostGIS geometry

                            ┌──────────────────────────────┐
                            │  Admin triggers fraud audit   │
                            └──────────────┬───────────────┘
                                           ▼
                              fraudPipeline.js reads tenders
                                 → 9 detection rules →
                              POST :8003/fraud/anomaly (IsolF+LOF)
                              POST :8003/fraud/graph (NetworkX)
                                   → UPSERT fraud_findings
                                   → UPSERT fraud_clusters

                            ┌──────────────────────────────┐
                            │  Admin runs ABM simulation    │
                            └──────────────┬───────────────┘
                                           ▼
                              POST :8003/abm/simulate
                              → ThreadPoolExecutor
                              → Mesa CivicABMModel (50 steps × N seeds)
                              → GET /abm/simulate/:id/progress (poll 1s)
                              → POST /analyse/consequences → Gemini 2.5 Flash
                              → SQLite persistence
                              → Frontend renders charts + ConsequencePanel

                            ┌──────────────────────────────┐
                            │  Topic extraction (manual)    │
                            └──────────────┬───────────────┘
                                           ▼
                              POST :6002/extract (YAKE)
                              → daily_topics INSERT
                              → Admin SentimentDashboard charts
```

---

## AI Architecture by Component

### Component 1: Policy Impact Simulator

**Input:** Natural language policy scenario text (e.g., "Invest ₹500 crore in infrastructure")

**Processing:** `simulation_service/app.py → interpret_scenario(text)`
1. Keyword matching maps text to ABM parameter overrides:
   - `"infra"` / `"road"` / `"metro"` → `infra_spend += 3000`
   - `"school"` / `"education"` → `training_budget += 2000`
   - `"subsidy"` / `"welfare"` → `subsidy_pct += 0.08`
   - `"job"` / `"employ"` → `job_find_prob += 0.15`
   - `"cut"` / `"austerity"` → `infra_spend −500, training_budget −200`
   - `"stimulus"` / `"growth"` → `job_find_prob += 0.1, infra_spend += 1000`

2. Mesa `CivicABMModel` initialised with derived params. Runs N steps × N seeds in a background thread (`ThreadPoolExecutor`).

3. `abm_runner.py` aggregates across seeds: `mean_by_step`, `std_by_step`, `mean_final`.

4. Simulation metrics are sent to Gemini 2.5 Flash with injected numeric context:
```
System: "You are a policy risk analyst for CivicTwin... Return ONLY valid JSON."
User:   "Policy: {scenario}
         Employment: {start}% → {final}% (range {min}–{max}%)
         Welfare: {start} → {final}
         Infrastructure: {start} → {final} ({trend})
         Environment: {start} → {final}
         Return exactly: { overall: str, risks: [{dimension, severity, finding, recommendation}] }"
```

**Output:** `{ overall, risks: [{ dimension, severity, finding, recommendation }] }` stored in-memory and SQLite

**Files:** `simulation_service/app.py`, `abm_model.py`, `abm_agents.py`, `abm_runner.py`

**Status:** ✅ Fully implemented. Multi-seed, live progress, comparative mode, resource optimizer, PDF export all working.

**Simulation modes:**
- **ABM mode** (`POST /abm/simulate`) — The primary mode. Uses the full `CivicABMModel` with 6 agent types, multi-seed aggregation, and live progress polling. This is what the main Simulation page and Resource Optimizer use.
- **Classic mode** (`POST /simulate`) — A simpler single-agent model (`CitizenAgent` in `simulation_service/agents.py`, `model.py`, `runner.py`). Agents have basic income/employment state with simpler rules. Does not support multi-seed or live progress. The frontend does not currently route to this endpoint — it exists as a legacy/simpler alternative.

**Live step delay (`abm_runner.py:step_delay_s`):**
Each simulation step is followed by a configurable sleep (`default 300ms`). This prevents the simulation completing before the frontend can observe progress — with 20 steps at 300ms/step, the simulation takes ~6 seconds, giving the frontend's 1-second poller 5–6 progress updates before completion. The delay is configurable via `step_delay_ms` in the request config.

---

### Component 2: Smart Grievance Redressal

**Input:** Complaint text + lat/lng + optional image (multipart form data)

**Processing:** `backend/routes/complaints.js`
1. `axios.post(ML_SERVICE_URL/classify, { text })` — timeout 3000ms, fallback to `{ category: "other", priority: 0.2 }`
2. `axios.post(SENTIMENT_URL/sentiment, { text })` — timeout 3000ms, fallback skips boost
3. Priority formula: `base_priority ± sentiment_boost`
   - If `compound ≤ −0.50`: `priority = min(1.0, priority + 0.15)`
   - If `compound ≤ −0.20`: `priority = min(1.0, priority + 0.08)`
4. PostGIS INSERT: `ST_SetSRID(ST_MakePoint($lng, $lat), 4326)`
5. Image goes to MongoDB GridFS `complaintImages` bucket; ObjectId returned and stored as `attachment_url`

**Output:** Complaint row in PostgreSQL with category, priority (0–1), sentiment label, sentiment score, PostGIS geometry

**Files:** `backend/routes/complaints.js`, `ml/classifier_service/app.py`, `ml/sentiment_service/app.py`

**Status:** ✅ Fully implemented. Graceful fallback when ML services are down.

---

### Component 3: Fraud & Corruption Detection

**Input:** All tenders in the `tenders` table (from PostgreSQL), optionally constrained by date range

**Processing:** `backend/services/fraudPipeline.js` — 9 detection patterns:

| Detection | Logic | Severity |
|---|---|---|
| Repeat winner (count) | contractor wins ≥ 30% of all contracts | Proportional to share |
| Repeat winner (value) | contractor wins ≥ 30% of total contract value | Proportional |
| Single-bidder | `meta.bidder_count = 1` | Proportional to amount |
| Cost overrun | `meta.execution_cost > awarded_amount × 1.25` | Proportional |
| Tender splitting | ≥2 contracts < ₹1M within 30-day window, total > ₹1M | Full weight |
| Near-threshold | `amount / approval_limit ∈ [0.85, 0.99]` | 70% weight |
| Circular identity | Levenshtein similarity ≥ 0.92 between contractor and official name/address/phone | Critical (score=90) |
| Ghost beneficiary | Same Aadhaar across multiple IDs / `tender.date > death_date` | Proportional / Fixed 98 |
| Regional spike | Department monthly amount > 2.5× rolling 6-month average | High (score=70) |

After rule-based scoring:
1. `axios.post(SIMULATION_SERVICE_URL/fraud/graph, { nodes, edges })` → NetworkX community detection + circular relationship detection → `graphScore`
2. `axios.post(SIMULATION_SERVICE_URL/fraud/anomaly, { features })` → IsolationForest + LOF → `anomalyScore`
3. `finalScore = ruleScore×0.70 + anomalyScore×0.20 + graphScore×0.10` (if ML available); else `ruleScore` only

**Output:** UPSERT into `fraud_findings` (idempotent by `finding_key`), UPSERT into `fraud_clusters`, UPDATE `fraud_audit_runs`

**Files:** `backend/services/fraudPipeline.js`, `backend/services/fraudReport.js`, `simulation_service/app.py`, `simulation_service/fraud_graph.py`

**Status:** ✅ Fully implemented.

---

### Component 4: Citizen Sentiment & Engagement

**Input:** Complaint text (on every POST /complaints) + social feed posts (on every POST /social)

**Processing:**
1. **Sentiment:** `ml/sentiment_service/utils.py` — VADER `polarity_scores(text)` → compound score → label
2. **Topic extraction:** `ml/topic_service/extractor.py` — YAKE on batch of text documents → top N keyword objects with scores
3. **Analytics aggregation:** PostgreSQL GROUP BY queries over `sentiment` column on both `complaints` and `social_feed` tables

**Output:**
- Each complaint stored with `sentiment TEXT` + `sentiment_score NUMERIC` in PostgreSQL
- Each social post stored with sentiment metadata
- `daily_topics` table updated with YAKE keywords per day

**Files:** `ml/sentiment_service/app.py`, `ml/topic_service/app.py`, `backend/routes/sentimentRoutes.js`, `backend/routes/topicRoutes.js`, `infra/analytics.sql`

**Status:** ✅ Fully implemented. No automation — topic extraction must be triggered manually.

---

### Component 5: Cross-Cutting Anti-Fraud / Collusion Detector

**Input:** Contractor/beneficiary/official entity data from `tenders` table, passed as nodes and edges JSON to `simulation_service`

**Processing:** `simulation_service/fraud_graph.py`
1. Build `nx.Graph()` from input nodes and edges
2. `nx.community.greedy_modularity_communities(G, weight='weight')` — fallback to `nx.connected_components(G)` on failure
3. `nx.simple_cycles(G)` — detects circular contractor↔approver loops; nodes in cycles get +0.3 score boost
4. Per-node scoring: `degree_centrality × 0.4 + betweenness × 0.4 + eigenvector × 0.2`
5. Per-cluster scoring: `edge_density × 0.6 + avg_centrality × 0.4`
6. `cluster_hash = sha256(sorted_nodes)` — deterministic identifier for idempotent upserts

**Output:** Clusters with `risk_score`, `edge_density`, `has_circular_relationship`; suspicious nodes with individual scores

**Files:** `simulation_service/fraud_graph.py`, `simulation_service/app.py` (`POST /fraud/graph`)

**Status:** ✅ Fully implemented. No LLM narrative generation for fraud findings — purely algorithmic.

---

## Database Schema

### `users` — Core user accounts
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| name | TEXT | Required |
| aadhaar_number | VARCHAR(12) UNIQUE | 12-digit regex validated |
| email | TEXT UNIQUE | Required |
| password_hash | TEXT | bcrypt 10 rounds |
| phone | TEXT | Optional |
| is_aadhaar_verified | BOOLEAN | Set true on registration |
| role | TEXT | `citizen` or `admin` |
| created_at / updated_at | TIMESTAMPTZ | Auto-managed by trigger |

### `aadhaar_registry` — Local mock Aadhaar database
| Column | Type | Notes |
|---|---|---|
| aadhaar_number | VARCHAR(12) UNIQUE | Seeded mock data — NOT real UIDAI |
| full_name | TEXT | — |
| phone | VARCHAR(15) | Linked mobile for OTP |

**Used by:** `backend/auth/aadhaar.service.js` — validates Aadhaar numbers during registration

### `aadhaar_otps` — OTP state table
| Column | Type | Notes |
|---|---|---|
| aadhaar_number | VARCHAR(12) FK | → aadhaar_registry |
| otp | VARCHAR(6) | Generated by `otp.service.js` |
| expires_at | TIMESTAMPTZ | Short window for OTP validity |
| verified | BOOLEAN | Marked true after verification |

### `complaints` — Citizen grievances
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | — |
| user_id | UUID FK | → users (ON DELETE SET NULL) |
| title | TEXT | Required |
| text | TEXT | Required — used for ML classification |
| category | TEXT | Assigned by ML classifier |
| priority | NUMERIC (0–1) | ML score + sentiment boost |
| sentiment | TEXT | positive / neutral / negative |
| sentiment_score | NUMERIC | VADER compound (-1 to 1) |
| location_geometry | GEOGRAPHY(POINT, 4326) | PostGIS — indexed with GIST |
| location_address | TEXT | Optional human-readable address |
| attachment_url | TEXT | MongoDB ObjectId of GridFS image |
| status | TEXT | open / in_progress / resolved / closed |
| assigned_to | UUID FK | → users |
| consent_given | BOOLEAN | GDPR-style consent flag |

**Indexes:** user_id, status, category, created_at DESC, priority DESC, location (GIST spatial index)

### `labels` — Admin category labels applied to complaints
| Column | Type | Notes |
|---|---|---|
| complaint_id | UUID FK | → complaints (CASCADE) |
| labeled_by | UUID FK | → users |
| category, priority, notes | TEXT/NUMERIC/TEXT | Admin-assigned overrides |

### `complaint_notes` — Internal audit trail on each complaint
| Column | Type | Notes |
|---|---|---|
| complaint_id | UUID FK | → complaints (CASCADE) |
| user_id | UUID FK | → users |
| note_type | TEXT | comment / status_change / assignment |
| text | TEXT | Content |
| metadata | JSONB | Optional structured data |

### `tenders` — Government procurement records
| Column | Type | Notes |
|---|---|---|
| tender_number | TEXT UNIQUE | Official tender identifier |
| contractor | TEXT | Contractor name |
| contractor_id | TEXT | Optional contractor identifier |
| amount | NUMERIC | Contract value (must be > 0) |
| date | DATE | Award date |
| category / department | TEXT | For filtering and analytics |
| beneficiary_id / phone / address | TEXT | For ghost beneficiary detection |
| death_date | DATE | If set and tender.date > death_date → post-death disbursement flag |
| meta | JSONB | `bidder_count`, `execution_cost`, `official_id`, `official_name`, `official_address`, `official_phone` |

### `fraud_audit_runs` — One row per pipeline execution
| Column | Type | Notes |
|---|---|---|
| status | TEXT | running / completed / failed |
| summary | JSONB | Full unified_report from pipeline |
| error_message | TEXT | If status = failed |

### `fraud_findings` — Individual fraud flags
| Column | Type | Notes |
|---|---|---|
| finding_key | TEXT UNIQUE | Idempotent upsert key (prevents duplicates across runs) |
| entity_type | TEXT | contractor / beneficiary / department / tender |
| finding_type | TEXT | repeat_winner / bid_collusion / cost_overrun / etc. |
| severity | TEXT | Low / Medium / High / Critical |
| risk_score | NUMERIC (0–100) | Blended rule + ML score |
| anomaly_score | NUMERIC | From IsolationForest (nullable) |
| graph_score | NUMERIC | From NetworkX (nullable) |
| evidence | JSONB | Supporting data for the finding |
| status | TEXT | open / investigating / escalated / dismissed / confirmed |
| reviewed_by | UUID FK | → users |

### `fraud_clusters` — Collusion rings identified by graph analysis
| Column | Type | Notes |
|---|---|---|
| cluster_hash | TEXT UNIQUE | SHA256 of sorted node IDs |
| cluster_nodes | JSONB | Array of entity IDs in the cluster |
| suspiciousness_score | NUMERIC | From NetworkX risk scoring |
| edge_density | NUMERIC | Internal edges / max possible edges |

### `simulation_runs` — PostgreSQL metadata for simulation history
| Column | Type | Notes |
|---|---|---|
| user_id | UUID FK | → users |
| params | JSONB | ABM input parameters |
| status | TEXT | queued / running / completed / failed |
| result | JSONB | ABM output metrics |

### `daily_topics` — Daily keyword extraction results
| Column | Type | Notes |
|---|---|---|
| date | DATE | Extraction date |
| topic | TEXT | Extracted keyword |
| category / score / occurrences | TEXT/NUMERIC/INT | YAKE score + frequency |
| UNIQUE(date, topic, category) | — | Prevents duplicate entries |

### `social_feed` — Citizen and admin social posts
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| source | TEXT | `civictwin` / `twitter` / `facebook` |
| source_id | TEXT | Optional external post ID |
| text | TEXT | Post content (required) |
| author | TEXT | Display name / handle |
| sentiment / sentiment_score | TEXT / NUMERIC | VADER output |
| location_geometry | GEOGRAPHY(POINT, 4326) | Optional PostGIS geotag |
| posted_at | TIMESTAMPTZ | Original post time |
| created_at | TIMESTAMPTZ | Ingestion time |
| image_url | TEXT | MongoDB ObjectId for attached image |
| posted_by | UUID FK | → users (the authenticated poster) |
| post_background | TEXT | CSS background color for text posts |
| category | TEXT | Optional civic category tag |
| department | TEXT | Optional department tag |
| priority | TEXT | `low` / `medium` / `high` / `urgent` |
| is_pinned | BOOLEAN | Admin-pinned posts appear first |
| is_archived | BOOLEAN | Admin-archived posts hidden from citizens |
| view_count | BIGINT | Incremented by `POST /social/:id/view` |

> **Note:** The columns `image_url`, `posted_by`, `post_background`, `category`, `department`, `priority`, `is_pinned`, `is_archived`, and `view_count` are NOT in `infra/analytics.sql`. They are added at runtime by `ensureSocialSchema()` in `social_feed.js` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. This is a migration-free schema evolution pattern.

### `social_post_reactions` — Per-post emoji reactions
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | Auto-increment |
| post_id | UUID FK | → social_feed (CASCADE) |
| user_id | UUID FK | → users (CASCADE) |
| reaction | TEXT | `like` / `love` / `care` / `wow` / `concern` |
| UNIQUE(post_id, user_id) | — | One reaction per user per post (upsert replaces) |

### `social_post_comments` — Text comments on posts
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| post_id | UUID FK | → social_feed (CASCADE) |
| user_id | UUID FK | → users (CASCADE) |
| comment_text | TEXT | Required, trimmed |
| created_at | TIMESTAMPTZ | Comment time |

### `social_post_saves` — Bookmarked posts per user
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | Auto-increment |
| post_id | UUID FK | → social_feed (CASCADE) |
| user_id | UUID FK | → users (CASCADE) |
| UNIQUE(post_id, user_id) | — | Toggle save: insert on save, delete on unsave |

### MongoDB GridFS Collections
```
Database: civictwin (from MONGO_URI)
├── socialFeedImages.files    — metadata for social post images
├── socialFeedImages.chunks   — binary data (255 KB chunks)
├── complaintImages.files     — metadata for complaint attachment images
└── complaintImages.chunks    — binary data (255 KB chunks)
```
Images are referenced by 24-char hex ObjectId stored as text in PostgreSQL.

---

## Agent-Based Modeling (ABM)

**Framework:** Mesa 3.1.1 (`mesa.Model`, `mesa.Agent`, `mesa.datacollection.DataCollector`)

**Is it implemented?** ✅ Yes — fully implemented.

### Agent Types

| Agent | Count | Key behaviour |
|---|---|---|
| `Worker` | 120 | Employment state, income (₹900–1300 base). 5% layoff probability per step. Unemployed workers search for jobs with probability `job_find_prob + 0.08×skill + training_boost`. Income = `base × (1 + infra_bonus)` if employed, else `base × subsidy_pct` |
| `Firm` | 8 | Maintains job openings. 30% chance per step to open a new vacancy. Hires at most one unemployed worker per step via `hiring_rate` gate (prevents market saturation) |
| `Household` | 45 | Migrates when `total_income < rent × 3.0` (55% chance) or by baseline `move_prob`. Migration increments `model.migration_count` |
| `Government` | 1 | Adjusts `subsidy_pct`, `training_budget`, `infra_spend` each step based on unemployment rate. Sets `government_spending_multiplier` from scenario keyword matching (expansionary or austerity keywords) |
| `InfrastructureAgent` | 1 | `score += gov_investment × multiplier + keyword_boost − depreciation − demand_pressure`. Starts at 50/100. Clamped 0–100 |
| `EnvironmentAgent` | 1 | `score += natural_recovery + green_boost − production_damage`. Production damage scales with employed worker count. Starts at 60/100. Clamped 0–100 |

### Step Activation Order (Causal Chain)
The step order is fixed and intentional — it enforces the causal chain:
```
1. Government.step()          Sets government_spending_multiplier for this tick
2. InfrastructureAgent.step() Reads multiplier + previous tick's employment count
3. EnvironmentAgent.step()    Reads employment count (same snapshot as Infra)
4. [Workers + Firms + Households] — shuffled within this group to avoid position-bias
5. _update_rent_index()       Compute rent stress from household affordability
6. DataCollector.collect()    Record: unemployment_rate, avg_income, avg_welfare,
                               migration_count, rent_index, infrastructure_score, env_score
```

### Multi-Seed Runner (`abm_runner.py`)
Runs the model `n_runs` times with different random seeds. On each seed completion, `_progress[sim_id]` is updated (read by the polling endpoint). Aggregation:
- `mean_by_step[metric]` — list of step-mean values across all seeds
- `std_by_step[metric]` — step-level standard deviation (uncertainty bands)
- `mean_final[metric]` — final step mean across seeds

### Resource Optimizer (`frontend/src/pages/simulation/ResourceOptimizer.jsx`)
Runs 6 parallel budget allocation variants in `Promise.allSettled()`:
- Infrastructure-heavy (80/10/10%), Infrastructure-led (60/25/15%), Balanced (40/40/20%), Education & welfare (20/60/20%), Green transition (20/20/60%), Equal distribution (33/34/33%)
- Composite score = weighted sum of `empDelta`, `welDelta×200`, `infDelta`, `envDelta` using user-defined priority sliders
- Top-ranked variant gets "★ Recommended" badge and Gemini AI analysis export option

---

## LLM / AI Model Integration

### Gemini 2.5 Flash — `simulation_service/app.py`

**Function:** `analyse_consequences(req: ConsequenceRequest)` → `POST /analyse/consequences`

**Prompt structure (abbreviated):**
```python
system_prompt = "You are a policy risk analyst for CivicTwin, an Indian civic simulation platform. "
                "Return ONLY valid JSON, no markdown, no preamble."

user_prompt = f"""Policy: {req.scenario}
Simulation: {req.n_steps} steps, {req.n_agents} agents
Employment: {employment_start:.1f}% -> {employment_final:.1f}% (range {employment_min:.1f}-{employment_max:.1f}%)
Welfare: {welfare_start:.3f} -> {welfare_final:.3f} (min {welfare_min:.3f} at step {welfare_min_step})
Infrastructure: {infra_start:.1f} -> {infra_final:.1f} ({infra_trend})
Environment: {env_start:.1f} -> {env_final:.1f} (min {env_min:.1f} at step {env_min_step})
Return exactly this JSON:
{{
  "overall": "2-3 sentence assessment of biggest UNINTENDED consequence",
  "risks": [
    {{
      "dimension": "Employment | Welfare | Infrastructure | Environment",
      "severity": "high | medium | low",
      "finding": "1-2 sentences with numbers from the simulation",
      "recommendation": "one concrete action with implementation timeline"
    }}
  ]
}}"""
```

**Retry logic:**
```python
delays = [12, 24, 48]   # seconds, exponential backoff on 429 rate-limit
```

**Fallback (`_consequence_fallback()`):** Deterministic stats-based analysis. If employment improved → `severity = "low"`, if worsened significantly → `severity = "high"`. Returns identical JSON schema — UI cannot tell the difference.

### Gemini (Social Feed Engagement Summariser) — `backend/routes/social_feed.js`

**Function:** `summarizeWithGemini({ postText, reactionCounts, comments })` → `POST /social/:id/ai-summary`

**Model selection:** Dynamic. Queries `GET /v1beta/models?key={apiKey}` to get available models, then picks from: `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash-latest` → `gemini-1.5-flash`. Falls back to `gemini-2.0-flash` if API is unreachable. Result cached in `cachedResolvedGeminiModel` for subsequent calls.

**Prompt:**
```
You are an assistant for civic admin social analytics.
Analyze citizens' reactions and comments for one post.
Return only valid JSON with exactly these keys:
overallSentiment (string), topTopics (string), recommendedAction (string).
Do not include markdown or extra keys.

Post text: {postText}
Reaction counts: {like, love, care, wow, concern totals}
Citizen comments: [last 40 comments]
```

**Output:** `{ overallSentiment, topTopics, recommendedAction }` — admin sees this inline in the social feed management view.

### Chatbot Routing Logic — `chatbot/service/app.py`

Every message hits the FastAPI router first. The router applies a keyword classification heuristic *before* any Rasa call:

```
message → classify_domain(text)
    ├─ DB queries ("complaints", "open", "count", "report", "fraud", "tender")
    │     └─ db_assistant.py → direct psycopg2 queries to PostgreSQL
    ├─ Profile ("profile", "my role", "logged in as", "my account", "citizen")
    │     └─ profile_assistant.py → JWT user context
    ├─ Platform navigation ("how do I", "where is", "feature", "simulation", "dashboard")
    │     └─ site_assistant.py → static platform knowledge base
    └─ Everything else
          └─ rasa_bridge.py → POST http://localhost:5005/webhooks/rest/webhook
                └─ Rasa NLU (DIETClassifier) → response text
```

This means Rasa handles general civic Q&A and small-talk; the deterministic assistants handle data and navigation queries where precision matters.

### Sentiment Spike Alert — `backend/routes/alertRoutes.js`

**Endpoint:** `GET /alerts/sentiment_spike`

**Algorithm:**
1. Compute negative sentiment percentage per day for the last 7 days from `social_feed`
2. Calculate baseline `mean` and `std` from those 7 days
3. Compute today's negative percentage
4. `spike = todayNegPercent > mean + 3 × std` (3-sigma rule)
5. Returns: `{ spike: bool, todayNegPercent, baselineMean, baselineStd, threshold }`

This is a statistical anomaly detector. A spike indicates today's negative sentiment is unusually high relative to the week's baseline.

---

## Real-Time Data Pipeline

| Mechanism | Status | Details |
|---|---|---|
| WebSockets | ❌ Not implemented | — |
| Server-Sent Events (SSE) | ❌ Not implemented | — |
| HTTP Polling | ✅ Implemented | Frontend polls `GET /abm/simulate/:id/progress` every 1 second during ABM run |
| Message broker (Kafka/RabbitMQ) | ❌ Not implemented | — |
| Celery / task queue | ❌ Not implemented | Background jobs use Python `ThreadPoolExecutor` instead |
| Cron / scheduled jobs | ❌ Not implemented | Topic extraction and re-scoring must be triggered manually |

---

## Data Sources

| Data Type | Current Source | Production Target |
|---|---|---|
| Citizen complaints | User-submitted via platform | Same — genuine user submissions |
| Social posts | Seeded via `seed_social.js`; user-submitted on platform | Twitter/X API, Facebook Graph API (not integrated) |
| Tenders / procurement | Synthetic seed data (`infra/fraud-detection/seed_tenders.py`) | PM GatI Shakti API, state e-procurement portals, Central Public Procurement Portal |
| Aadhaar identity | Local mock registry (`infra/core.sql` `aadhaar_registry` table) | UIDAI Aadhaar authentication API (requires government partnership) |
| User labels for classifier | Hand-labeled `ml/labels.csv` (~150 rows, 5.8 KB) | Admin-labeled complaints → automated retraining pipeline |
| Geospatial boundaries | Not integrated — bare PostGIS point geometry only | Ward/district boundaries from Bhuvan or GADM for spatial aggregation |
