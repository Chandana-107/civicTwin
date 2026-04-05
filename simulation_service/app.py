from fastapi import FastAPI, BackgroundTasks, HTTPException
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
import concurrent.futures
import json
import os
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen
from runner import run_single_simulation
from abm_runner import run_abm_multi_seed
from abm_chat import build_chat_answer
from site_assistant import answer_website_question_with_intent, is_website_query
from profile_assistant import answer_profile_question
from db_assistant import answer_db_question

app = FastAPI(title="CivicTwin Simulation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for simulation results
# In production, use Redis or a database
simulation_store: Dict[str, Dict[str, Any]] = {}
abm_simulation_store: Dict[str, Dict[str, Any]] = {}

# Process Pool for running simulations
executor = concurrent.futures.ProcessPoolExecutor(max_workers=4)

class SimulationConfig(BaseModel):
    N: int = 100
    strictness: float = 0.5
    steps: int = 10
    infra_spending: float = 0.0
    subsidy: float = 0.0
    training_budget: float = 0.0
    job_creation_rate: float = 0.05
    description: Optional[str] = None

class SimulationResponse(BaseModel):
    simulation_id: str
    status: str


class ABMSimulationConfig(BaseModel):
    n_workers: int = 120
    n_firms: int = 20
    n_households: int = 45
    n_steps: int = 50
    n_runs: int = 10
    job_find_prob: float = 0.3
    move_prob: float = 0.1
    subsidy_pct: float = 0.1
    infra_spend: float = 1000.0
    training_budget: float = 500.0


class ABMChatRequest(BaseModel):
    message: str
    config: Optional[ABMSimulationConfig] = None
    profile: Optional[Dict[str, Any]] = None
    complaint_context: Optional[list[Dict[str, Any]]] = None
    auth_token: Optional[str] = None


class ABMChatResponse(BaseModel):
    answer: str
    simulation_id: Optional[str] = None
    metrics: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = None

@app.post("/simulate", response_model=SimulationResponse)
async def start_simulation(config: SimulationConfig):
    simulation_id = str(uuid.uuid4())
    
    # Run synchronously for debugging/Windows stability
    try:
        results = run_single_simulation(config.dict())
        simulation_store[simulation_id] = {
            "status": "completed",
            "results": results
        }
    except Exception as e:
        print(f"Simulation failed: {e}") # Log to console
        simulation_store[simulation_id] = {
            "status": "failed",
            "error": str(e)
        }
    
    return {"simulation_id": simulation_id, "status": "completed"}

@app.get("/results/{simulation_id}")
async def get_results(simulation_id: str):
    if simulation_id not in simulation_store:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return simulation_store[simulation_id]


@app.post("/abm/simulate")
async def run_abm_simulation(config: ABMSimulationConfig):
    """Run additive Mesa ABM simulation while preserving existing routes."""
    simulation_id = str(uuid.uuid4())
    try:
        results = run_abm_multi_seed(config.dict(), min_runs=10)
        abm_simulation_store[simulation_id] = {
            "status": "completed",
            "results": results,
            "config": config.dict(),
        }
        return {
            "simulation_id": simulation_id,
            "status": "completed",
            "results": results,
        }
    except Exception as e:
        abm_simulation_store[simulation_id] = {
            "status": "failed",
            "error": str(e),
        }
        raise HTTPException(status_code=500, detail=f"ABM simulation failed: {str(e)}")


@app.get("/abm/results/{simulation_id}")
async def get_abm_results(simulation_id: str):
    if simulation_id not in abm_simulation_store:
        raise HTTPException(status_code=404, detail="ABM simulation not found")
    return abm_simulation_store[simulation_id]


def _get_latest_abm_result() -> tuple[Optional[str], Optional[Dict[str, Any]]]:
    for simulation_id in reversed(list(abm_simulation_store.keys())):
        record = abm_simulation_store[simulation_id]
        if record.get("status") == "completed":
            return simulation_id, record
    return None, None


def _fetch_complaints_from_backend(auth_token: str) -> list[Dict[str, Any]]:
    """Fetch complaints from main backend API using bearer token."""
    backend_base = os.getenv("BACKEND_API_URL", "http://localhost:3000").rstrip("/")
    candidates = [
        f"{backend_base}/complaints",
        "http://localhost:3000/complaints",
    ]

    for url in dict.fromkeys(candidates):
        try:
            req = Request(
                url,
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json",
                },
                method="GET",
            )
            with urlopen(req, timeout=4) as response:
                payload = json.loads(response.read().decode("utf-8"))
                rows = payload.get("data", []) if isinstance(payload, dict) else []
                if isinstance(rows, list):
                    return rows[:50]
        except (HTTPError, URLError, TimeoutError, ValueError):
            continue
        except Exception:
            continue

    return []


def _fetch_users_from_backend(auth_token: str) -> list[Dict[str, Any]]:
    """Fetch users from main backend API (admin token required)."""
    backend_base = os.getenv("BACKEND_API_URL", "http://localhost:3000").rstrip("/")
    candidates = [
        f"{backend_base}/users",
        "http://localhost:3000/users",
    ]

    for url in dict.fromkeys(candidates):
        try:
            req = Request(
                url,
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json",
                },
                method="GET",
            )
            with urlopen(req, timeout=4) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if isinstance(payload, list):
                    return payload
                if isinstance(payload, dict) and isinstance(payload.get("data"), list):
                    return payload.get("data", [])
        except (HTTPError, URLError, TimeoutError, ValueError):
            continue
        except Exception:
            continue

    return []


@app.post("/chat", response_model=ABMChatResponse)
async def chat_about_abm(payload: ABMChatRequest):
    """Hybrid chat endpoint for website help and ABM simulation insights."""
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    lowered = message.lower()
    trigger_words = ["run", "simulate", "forecast", "predict", "scenario"]
    metric_words = ["unemployment", "income", "migration", "rent", "trend"]
    should_run = any(word in lowered for word in trigger_words)
    wants_website_help = is_website_query(message)
    website_intent, website_answer = answer_website_question_with_intent(message)
    complaint_context = payload.complaint_context or []
    complaint_source = "client_payload" if complaint_context else "none"
    if not complaint_context and payload.auth_token:
        complaint_context = _fetch_complaints_from_backend(payload.auth_token)
        if complaint_context:
            complaint_source = "backend_fetch"

    users_context = []
    if payload.auth_token and "user" in lowered:
        users_context = _fetch_users_from_backend(payload.auth_token)

    profile_intent, profile_answer = answer_profile_question(
        message,
        payload.profile,
        complaint_context,
    )

    db_intent, db_answer = answer_db_question(
        message,
        payload.profile,
        complaint_context,
        users_context,
    )
    db_analytic_query = any(
        token in lowered
        for token in [
            "database",
            "data",
            "records",
            "how many",
            "count",
            "total",
            "status",
            "summary",
            "category",
            "top",
            "recent",
            "latest",
            "priority",
        ]
    )

    abm_intent = "summary"
    if "unemployment" in lowered:
        abm_intent = "unemployment"
    elif "income" in lowered or "salary" in lowered:
        abm_intent = "income"
    elif "migration" in lowered or "move" in lowered:
        abm_intent = "migration"
    elif "rent" in lowered or "housing" in lowered:
        abm_intent = "rent"

    simulation_id = None
    record = None
    simulation_action = "none"

    needs_abm = should_run or any(word in lowered for word in metric_words)

    if needs_abm and should_run:
        config = payload.config.dict() if payload.config else ABMSimulationConfig().dict()
        simulation_id = str(uuid.uuid4())
        results = run_abm_multi_seed(config, min_runs=10)
        record = {"status": "completed", "results": results, "config": config}
        abm_simulation_store[simulation_id] = record
        simulation_action = "ran_new"
    else:
        simulation_id, record = _get_latest_abm_result()
        if record is not None:
            simulation_action = "used_cached"
        if record is None and needs_abm:
            config = payload.config.dict() if payload.config else ABMSimulationConfig().dict()
            simulation_id = str(uuid.uuid4())
            results = run_abm_multi_seed(config, min_runs=10)
            record = {"status": "completed", "results": results, "config": config}
            abm_simulation_store[simulation_id] = record
            simulation_action = "ran_new"

    if record is None and db_answer and (db_analytic_query or not profile_answer):
        return ABMChatResponse(
            answer=db_answer,
            simulation_id=None,
            metrics=None,
            metadata={
                "matched_intents": [f"db:{db_intent}"] if db_intent else [],
                "profile_intent": profile_intent,
                "db_intent": db_intent,
                "db_source": complaint_source,
                "website_intent": website_intent,
                "abm_intent": None,
                "simulation_action": "none",
            },
        )

    if record is None and profile_answer:
        return ABMChatResponse(
            answer=profile_answer,
            simulation_id=None,
            metrics=None,
            metadata={
                "matched_intents": [f"profile:{profile_intent}"] if profile_intent else [],
                "profile_intent": profile_intent,
                "db_intent": None,
                "db_source": complaint_source,
                "website_intent": None,
                "abm_intent": None,
                "simulation_action": "none",
            },
        )

    if record is None and db_answer:
        return ABMChatResponse(
            answer=db_answer,
            simulation_id=None,
            metrics=None,
            metadata={
                "matched_intents": [f"db:{db_intent}"] if db_intent else [],
                "profile_intent": None,
                "db_intent": db_intent,
                "db_source": complaint_source,
                "website_intent": None,
                "abm_intent": None,
                "simulation_action": "none",
            },
        )

    if record is None and website_answer:
        return ABMChatResponse(
            answer=website_answer,
            simulation_id=None,
            metrics=None,
            metadata={
                "matched_intents": [f"website:{website_intent}"] if website_intent else [],
                "profile_intent": None,
                "db_intent": None,
                "db_source": complaint_source,
                "website_intent": website_intent,
                "abm_intent": None,
                "simulation_action": "none",
            },
        )

    if record is None:
        return ABMChatResponse(
            answer=(
                "I can answer both CivicTwin website questions and Mesa ABM simulation questions. "
                "Ask about routes, roles, complaint workflow, dashboards, endpoints, or say 'run simulation'."
            ),
            simulation_id=None,
            metrics=None,
            metadata={
                "matched_intents": [],
                "profile_intent": None,
                "db_intent": None,
                "db_source": complaint_source,
                "website_intent": None,
                "abm_intent": None,
                "simulation_action": "none",
            },
        )

    results = record.get("results", {})
    summary = results.get("mean_final", {})
    abm_answer = build_chat_answer(message, results)

    if db_answer and needs_abm and (db_analytic_query or not profile_answer):
        answer = f"{db_answer}\n\nSimulation insight: {abm_answer}"
    elif profile_answer and needs_abm:
        answer = f"{profile_answer}\n\nSimulation insight: {abm_answer}"
    elif website_answer and needs_abm:
        answer = f"{website_answer}\n\nSimulation insight: {abm_answer}"
    elif db_answer and not needs_abm and (db_analytic_query or not profile_answer):
        answer = db_answer
    elif profile_answer and not needs_abm:
        answer = profile_answer
    elif website_answer and wants_website_help and not needs_abm:
        answer = website_answer
    else:
        answer = abm_answer

    matched_intents = []
    if profile_intent:
        matched_intents.append(f"profile:{profile_intent}")
    if db_intent:
        matched_intents.append(f"db:{db_intent}")
    if website_intent:
        matched_intents.append(f"website:{website_intent}")
    if needs_abm:
        matched_intents.append(f"abm:{abm_intent}")

    return ABMChatResponse(
        answer=answer,
        simulation_id=simulation_id,
        metrics={
            "unemployment_rate": float(summary.get("unemployment_rate", 0.0)),
            "avg_income": float(summary.get("avg_income", 0.0)),
            "migration_count": float(summary.get("migration_count", 0.0)),
            "rent_index": float(summary.get("rent_index", 0.0)),
        },
        metadata={
            "matched_intents": matched_intents,
            "profile_intent": profile_intent,
            "db_intent": db_intent,
            "db_source": complaint_source,
            "website_intent": website_intent,
            "abm_intent": abm_intent if needs_abm else None,
            "simulation_action": simulation_action,
        },
    )

# Fraud Graph Analysis Endpoint
from fraud_graph import analyze_fraud_graph

class GraphData(BaseModel):
    nodes: list
    edges: list

@app.post("/fraud/graph")
async def analyze_graph(data: GraphData):
    try:
        # Offload to executor if graph is large, but for now run sync
        results = analyze_fraud_graph(data.dict())
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

