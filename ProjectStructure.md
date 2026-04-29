# Project Structure

This document outlines the current repository layout and highlights key files related to fraud detection.

Top-level files and folders
- README.md
- requirements.txt
- sample.txt
- verify_complaints.js

backend/
- db.js
- package.json
- requirements.txt
- seed_social.js
- server.js  (Express app; mounts routes including `/fraud`)
- auth/
  - aadhaar.service.js
  - auth.controller.js
  - auth.routes.js
  - auth.utils.js
  - otp.service.js
  - whatsapp.service.js
- middleware/
  - auth.js
- routes/
  - alertRoutes.js
  - complaints.js
  - fraud.js            <-- fraud API: GET /flags, GET /clusters, POST /run, PATCH /flags/:id
  - sentimentRoutes.js
  - simulation.js
  - social_feed.js
  - socialRoutes.js
  - tenders.js         <-- tender creation/listing and contractor-name endpoint used by the fraud UI
  - topicRoutes.js
  - topics.js
  - upload.js
  - users.js
- uploads/ (static uploads)

chatbot/
- __init__.py
- README.md
- rasa/ (rasa config, data, actions)

service/
- __init__.py
- app.py

config/
- priority_keywords.json

frontend/
- index.html
- OTPenable.md
- package.json
- README.md
- vite.config.js
- src/
  - App.jsx            <-- routes include `/admin/fraud`
  - index.css
  - main.jsx
  - rasaChatbotWidget.css
  - rasaChatbotWidget.js
  - components/
    - ProtectedRoute.jsx
  - contexts/
    - AuthContext.jsx
  - pages/
    - admin/
      - Dashboard.jsx   (links to fraud dashboard)
      - FraudDashboard.jsx  <-- UI for fraud flags, clusters, graph, and trigger `/fraud/run`
    - ... other pages
  - utils/

infra/
- analytics.sql
- core.sql
- create_labels_csv.py
- db.py
- fraud.sql            <-- DB schema for `tenders`, `fraud_flags`, `fraud_clusters`
- fraud-detection/
  - seed_fraud_flags.py   <-- demo seeder for fraud flags
  - seed_fraud_clusters.py
- analytics/
  - daily_topics_seed.py
  - simulation_runs.py
  - social_feed_seed.py
- core/
  - seed_complaint_notes.py
  - seed_complaints.py
  - seed_labels.py
  - seed_users.py

ml/
- __init__.py
- requirements.txt
- classifier_service/
  - app.py              <-- classifier FastAPI service (separate from fraud graph)
  - evaluate.py
  - retrain.py
  - train.py
  - utils.py
  - metrics/
  - models/
- sentiment_service/
  - app.py
  - utils.py
- topic_service/
  - app.py
  - extractor.py

myenv/ (Python venv)

reports/
- fake_metrics_2026-02.md

scripts/
- retrain.sh

simulation_service/
- __init__.py
- abm_agents.py
- abm_model.py
- abm_runner.py
- agents.py
- app.py              <-- exposes `/fraud/graph` endpoint used as ML/graph analysis service
- fraud_graph.py      <-- networkx-based community detection + centrality (used by `/fraud/graph`)
- model.py
- runner.py
- test_discovery.py
- verify_simulation.py

Notes about the fraud feature
- Detection logic lives in `backend/routes/fraud.js` and is primarily rule-based:
  - `repeat_winner` — contractors winning >= threshold in last 365 days
  - `price_outlier` — amount > mean + k * std per category
  - `duplicate_beneficiary` — same beneficiary across tenders
  - simple clustering by shared phone/address/beneficiary
  - optional ML handoff to `simulation_service` via `POST ${ML_SERVICE_URL}/fraud/graph`
- DB tables defined in `infra/fraud.sql`: `fraud_flags`, `fraud_clusters`, and `tenders` schema
- Frontend dashboard: `frontend/src/pages/admin/FraudDashboard.jsx` pulls `/fraud/flags` and `/fraud/clusters`, triggers `/fraud/run`, and visualizes results (cards, bar chart, ForceGraph)
- Seed/demo data: `infra/fraud-detection/seed_fraud_flags.py` and `seed_fraud_clusters.py`

If you want, I can also:
- add a small README section describing how to run the fraud detection locally,
- or generate a `diagram.svg` or tree view file for inclusion in the repo.

---
Generated on: 2026-04-29
