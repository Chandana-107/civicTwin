# CivicTwin — Complete Local Runbook

## Architecture at a Glance

| # | Service | Tech | Port | Directory |
|---|---------|------|------|-----------|
| 1 | **Backend API** | Node.js / Express | 3000 | `backend/` |
| 2 | **Frontend** | React / Vite | 5173 | `frontend/` |
| 3 | **Classifier Service** | FastAPI (Python) | 8001 | `ml/classifier_service/` |
| 4 | **Sentiment Service** | Flask (Python) | 6001 | `ml/sentiment_service/` |
| 5 | **Topic Service** | Flask (Python) | 6002 | `ml/topic_service/` |
| 6 | **Simulation Service** | FastAPI (Python) | 8003 | `simulation_service/` |
| 7 | **Rasa NLU Server** | Rasa 3.6 | 5005 | `chatbot/rasa/` |
| 8 | **Chatbot API** | FastAPI (Python) | 8002 | `chatbot/service/` |

> You need **7–8 separate terminal windows/tabs** running simultaneously.

---

### 1. Node.js Backend — install dependencies
```powershell
cd L:\civicTwin\backend
npm install
```

### 2. Frontend — install dependencies
```powershell
cd L:\civicTwin\frontend
npm install
```

### 3. ML / Python venv (classifier, sentiment, topic, simulation)
```powershell
cd L:\civicTwin\ml
python -m venv myenv
.\myenv\Scripts\pip install -r requirements.txt
```

> **Note:** `myenv` already exists. If deps are already installed, skip to the run commands.

### 4. Chatbot venv (Rasa — requires Python 3.10)
```powershell
cd L:\civicTwin\chatbot
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install rasa==3.6.21 rasa-sdk==3.6.2 fastapi==0.95.2 uvicorn==0.23.2 pydantic==1.10.9 starlette==0.27.0 psycopg2-binary
```

### 5. Train the Rasa model (one-time or after domain/data changes)
```powershell
cd L:\civicTwin\chatbot\rasa
$env:SQLALCHEMY_SILENCE_UBER_WARNING = "1"
..\\.venv\Scripts\python.exe -m rasa train
```

---

## Run Everything — Open 8 Terminals

### Terminal 1 — Node.js Backend (Port 3000)
```powershell
cd L:\civicTwin\backend
node server.js
```
✅ Expected: `Server listening on 3000`

---

### Terminal 2 — Frontend (Port 5173)
```powershell
cd L:\civicTwin\frontend
npm run dev
```
✅ Expected: `Local: http://localhost:5173/`

---

### Terminal 3 — ML Classifier Service (Port 8001)
```powershell
cd L:\civicTwin\ml\classifier_service
..\myenv\Scripts\uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```
✅ Expected: `Application startup complete.`

> [!IMPORTANT]
> Model artifacts (`tfidf.joblib`, `logreg.joblib`) already exist under `ml/classifier_service/models/`. If they were missing, you'd need to run `train.py` first.

---

### Terminal 4 — Sentiment Service (Port 6001)
```powershell
cd L:\civicTwin\ml\sentiment_service
..\myenv\Scripts\python app.py
```
✅ Expected: `Running on http://0.0.0.0:6001`

---

### Terminal 5 — Topic Service (Port 6002)
```powershell
cd L:\civicTwin\ml\topic_service
..\myenv\Scripts\python app.py
```
✅ Expected: `Running on http://0.0.0.0:6002`

---

### Terminal 6 — Simulation Service (Port 8003)
```powershell
cd L:\civicTwin\simulation_service
..\ml\myenv\Scripts\uvicorn app:app --host 0.0.0.0 --port 8003 --reload
```
✅ Expected: `Application startup complete.`

---

### Terminal 7 — Rasa NLU Server (Port 5005)
```powershell
cd L:\civicTwin\chatbot\rasa
$env:SQLALCHEMY_SILENCE_UBER_WARNING = "1"
..\\.venv\Scripts\python.exe -m rasa run --enable-api --cors "*" --port 5005
```
✅ Expected: `Rasa server is up and running.`

> [!NOTE]
> Chatbot still works without Rasa — it falls back to the domain/profile/DB assistant. Rasa is optional for a quick start.

---

### Terminal 8 — Chatbot API (Port 8002)
```powershell
cd L:\civicTwin
chatbot\.venv\Scripts\python.exe -m uvicorn chatbot.service.app:app --reload --port 8002
```
✅ Expected: `Application startup complete.`

---

## Health Checks (Quick Verify)

Run these in any PowerShell window after starting services:

```powershell
# Backend
Invoke-RestMethod http://localhost:3000/

# Classifier
Invoke-RestMethod http://localhost:8001/health

# Sentiment (test call)
Invoke-RestMethod -Uri http://localhost:6001/sentiment -Method POST -ContentType "application/json" -Body '{"text":"this road is broken and dangerous!"}'

# Topic (test call)
Invoke-RestMethod -Uri http://localhost:6002/extract -Method POST -ContentType "application/json" -Body '{"documents":["road pothole drainage flood"],"top_n":5}'

# Simulation
Invoke-RestMethod http://localhost:8003/health

# Chatbot API
Invoke-RestMethod http://localhost:8002/health

# Rasa
Invoke-WebRequest -Uri http://127.0.0.1:5005/status -UseBasicParsing
```

---

## Startup Order (Recommended)

```
PostgreSQL (running) → Backend → Classifier → Sentiment → Topic → Simulation → Rasa → Chatbot API → Frontend
```

The backend and frontend can start independently of Python services — they fail gracefully when an ML service is down.

---

## Port Summary

```
localhost:3000  → Node.js Backend API
localhost:5173  -> React Frontend (Vite dev)
localhost:8001  -> ML Classifier (FastAPI)
localhost:6001  -> Sentiment / VADER (Flask)
localhost:6002  -> Topic Extraction (Flask)
localhost:8003  -> Simulation + Fraud + ABM (FastAPI)
localhost:5005  -> Rasa NLU (optional)
localhost:8002  -> Chatbot API (FastAPI)
localhost:5432  -> PostgreSQL
```

---

## What Each Service Does

| Service | Role |
|---------|------|
| **Backend (3000)** | REST API for auth, complaints, fraud, tenders, social feed, alerts, topics |
| **Frontend (5173)** | React UI — citizen & admin dashboards, map, fraud, chatbot |
| **Classifier (8001)** | Categorises complaint text + computes base priority score |
| **Sentiment (6001)** | VADER sentiment — boosts complaint priority on negative tone |
| **Topic (6002)** | Batch keyword extraction from complaints + social feed per day |
| **Simulation (8003)** | Mesa ABM economics sim + IsolationForest/LOF fraud anomaly detection |
| **Rasa (5005)** | NLU chatbot for general civic Q&A |
| **Chatbot API (8002)** | Smart router — Rasa → profile/DB/site assistant fallback |
