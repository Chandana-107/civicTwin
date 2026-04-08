# Chatbot

This folder contains the Rasa chatbot stack.

## Folder structure

- `rasa/`: Rasa config, domain, training data, tests, and custom actions
- `runtime/`: chatbot intent/routing helper logic used by the API layer
- `service/`: standalone FastAPI service that forwards messages to Rasa and returns responses to the frontend

## Prerequisites

- Python `3.10.x` (Rasa 3.6 compatibility)
- Windows PowerShell

## One-time setup

From repository root:

```powershell
cd L:\civicTwin\chatbot
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install rasa==3.6.21 rasa-sdk==3.6.2 fastapi==0.95.2 uvicorn==0.23.2 pydantic==1.10.9 starlette==0.27.0
```

## Run locally (2 terminals)

### Terminal 1: Rasa server

```powershell
cd L:\civicTwin\chatbot\rasa
set SQLALCHEMY_SILENCE_UBER_WARNING=1
..\.venv\Scripts\python.exe -m rasa train
..\.venv\Scripts\python.exe -m rasa run --enable-api --cors "*" --port 5005
```

### Terminal 2: Chatbot API

```powershell
cd L:\civicTwin
chatbot\.venv\Scripts\python.exe -m uvicorn chatbot.service.app:app --reload --port 8002
```

## Verify chatbot is working

From repository root:

```powershell
# Rasa status
Invoke-WebRequest -Uri "http://127.0.0.1:5005/status" -UseBasicParsing

# Chatbot API health
Invoke-WebRequest -Uri "http://127.0.0.1:8002/health" -UseBasicParsing

# End-to-end chatbot response via API
$body = @{ sender = 'local-test'; message = 'Hello' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8002/chat" -Method POST -ContentType "application/json" -Body $body
```

Expected behavior:

- `/status` returns HTTP `200`
- `/health` returns `{"status":"ok","service":"chatbot"}`
- `/chat` returns an `answer` with metadata showing `source: "rasa"` and `rasa_status: "ok"`
