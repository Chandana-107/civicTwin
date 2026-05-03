from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

# Load .env so GEMINI_API_KEY is available even when running directly
load_dotenv(Path(__file__).parent.parent / ".env")

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

from abm_runner import (
    _live_results, _progress,
    get_live_results, get_progress,
    run_abm_multi_seed,
)
from fraud_graph import analyze_fraud_graph
from runner import run_single_simulation

# Ã¢â€â‚¬Ã¢â€â‚¬ App Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

app = FastAPI(title="CivicTwin Simulation Service")

# CORS: allow_origins=["*"] + allow_credentials=True is spec-invalid and is
# rejected by browsers in stricter environments (the spec requires a concrete
# origin when credentials are included).  Using explicit dev-server origins and
# allow_credentials=False is correct for a local-only API with no auth cookies.
_CORS_ORIGINS = [
    "http://localhost:5173",   # Vite dev server (default port)
    "http://localhost:4173",   # Vite preview
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=False,   # no auth cookies — wildcard-safe
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for background ABM runs.
# The ABM uses time.sleep() per step -- it must NOT run on the event loop.
# max_workers=8: 6 optimizer variants + 2 headroom for single-sim requests.
_executor = ThreadPoolExecutor(max_workers=8)

# Ã¢â€â‚¬Ã¢â€â‚¬ In-memory fallback stores Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
simulation_store:     Dict[str, Dict[str, Any]] = {}
abm_simulation_store: Dict[str, Dict[str, Any]] = {}

# Ã¢â€â‚¬Ã¢â€â‚¬ SQLite persistence Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
DB_PATH = Path(__file__).parent / "civictwin_results.db"


def _init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS simulations (
                id           TEXT PRIMARY KEY,
                created_at   TEXT NOT NULL,
                source       TEXT NOT NULL,
                config_json  TEXT,
                results_json TEXT
            )
            """
        )
        conn.commit()


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _save_simulation(sim_id: str, source: str, config: dict, results: dict) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO simulations "
            "(id, created_at, source, config_json, results_json) VALUES (?,?,?,?,?)",
            (sim_id, created_at, source, json.dumps(config), json.dumps(results)),
        )
        conn.commit()


def _load_simulation(sim_id: str) -> Optional[dict]:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM simulations WHERE id = ?", (sim_id,)
        ).fetchone()
    if row is None:
        return None
    return {
        "id":         row["id"],
        "created_at": row["created_at"],
        "source":     row["source"],
        "config":     json.loads(row["config_json"]  or "{}"),
        "results":    json.loads(row["results_json"] or "{}"),
    }


@app.on_event("startup")
def startup():
    _init_db()
    key_status = "SET" if os.getenv("GEMINI_API_KEY") else "MISSING — using fallback"
    print(f"[startup] GEMINI_API_KEY {key_status}")


# Ã¢â€â‚¬Ã¢â€â‚¬ Scenario interpreter Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

def interpret_scenario(scenario: str) -> dict:
    """Rule-based keyword Ã¢â€ â€™ ABM parameter mapping."""
    if not scenario:
        return {}

    text   = scenario.lower()
    params: dict = {}

    if any(k in text for k in ("infra", "road", "bridge", "construction", "transport", "metro", "highway")):
        params["infra_spend"] = params.get("infra_spend", 1000.0) + 3000.0

    if any(k in text for k in ("train", "school", "education", "skill", "college", "university", "learn")):
        params["training_budget"] = params.get("training_budget", 500.0) + 2000.0

    if any(k in text for k in ("subsid", "welfare", "cash", "poor", "benefit", "stipend", "allowance")):
        params["subsidy_pct"] = min(0.3, params.get("subsidy_pct", 0.1) + 0.08)

    if any(k in text for k in ("job", "employ", "work", "hire", "recruit", "labour", "labor")):
        params["job_find_prob"]    = min(0.85, params.get("job_find_prob", 0.3) + 0.15)
        params["firm_hiring_rate"] = min(0.7,  params.get("firm_hiring_rate", 0.3) + 0.15)

    if any(k in text for k in ("cut", "auster", "reduce spend", "budget cut")):
        params["infra_spend"]      = max(200.0, params.get("infra_spend", 1000.0) - 500.0)
        params["training_budget"]  = max(100.0, params.get("training_budget", 500.0) - 200.0)

    if any(k in text for k in ("stimulus", "boost", "growth", "expand")):
        params["job_find_prob"] = min(0.85, params.get("job_find_prob", 0.3) + 0.1)
        params["infra_spend"]   = params.get("infra_spend", 1000.0) + 1000.0

    return params


# Ã¢â€â‚¬Ã¢â€â‚¬ Pydantic models Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

class SimulationConfig(BaseModel):
    N:                int   = 100
    strictness:       float = 0.5
    steps:            int   = 10
    infra_spending:   float = 0.0
    subsidy:          float = 0.0
    training_budget:  float = 0.0
    job_creation_rate: float = 0.05
    description:      Optional[str] = None


class SimulationResponse(BaseModel):
    simulation_id: str
    status:        str


class ABMSimulationConfig(BaseModel):
    n_workers:        int   = 120
    n_firms:          int   = 8
    n_households:     int   = 45
    n_steps:          int   = 50
    n_runs:           int   = 1
    job_find_prob:    float = 0.15
    move_prob:        float = 0.1
    subsidy_pct:      float = 0.1
    infra_spend:      float = 1000.0
    training_budget:  float = 500.0
    firm_hiring_rate: float = 0.3
    step_delay_ms:    int   = 300   # Fix 4: inter-step pause for live visibility
    scenario:         Optional[str] = None


class GraphData(BaseModel):
    nodes: list
    edges: list


class FeatureRow(BaseModel):
    entity_id:       str
    entity_type:     str
    wins:            Optional[float] = 0
    avg_amount:      Optional[float] = 0
    max_amount:      Optional[float] = 0
    single_bid_rate: Optional[float] = 0
    overrun_rate:    Optional[float] = 0
    claim_count:     Optional[float] = 0
    unique_phones:   Optional[float] = 0
    unique_addresses: Optional[float] = 0
    unique_banks:    Optional[float] = 0


class AnomalyData(BaseModel):
    contractor_features:  List[FeatureRow] = []
    beneficiary_features: List[FeatureRow] = []


# Ã¢â€â‚¬Ã¢â€â‚¬ Background ABM job (Fix 1) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

def _run_abm_job(sim_id: str, cfg: dict, interpreted_params: dict) -> None:
    """Executed in a ThreadPoolExecutor thread.

    Blocks freely (uses time.sleep per step). The event loop is NOT blocked,
    so concurrent GET /progress and GET /results requests are served normally.
    """
    try:
        result = run_abm_multi_seed(cfg, simulation_id=sim_id)
        record = {
            "status":            "completed",
            "results":           result,
            "config":            cfg,
            "interpreted_params": interpreted_params,
        }
        abm_simulation_store[sim_id] = record
        _save_simulation(sim_id, "abm", cfg, record)
    except Exception as exc:
        _progress[sim_id] = {
            "status":     "error",
            "steps_done": 0,
            "total_steps": 0,
            "pct":        0,
            "error":      str(exc),
        }
        abm_simulation_store[sim_id] = {"status": "failed", "error": str(exc)}


# Ã¢â€â‚¬Ã¢â€â‚¬ Endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@app.get("/health")
async def health():
    return {"status": "ok", "service": "simulation"}


# Ã¢â€â‚¬Ã¢â€â‚¬ Classic CitizenAgent model (unchanged) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@app.post("/simulate", response_model=SimulationResponse)
async def start_simulation(config: SimulationConfig):
    simulation_id = str(uuid.uuid4())
    cfg = config.dict()
    try:
        results = run_single_simulation(cfg)
        record  = {"status": "completed", "results": results}
        simulation_store[simulation_id] = record
        _save_simulation(simulation_id, "classic", cfg, record)
    except Exception as e:
        record = {"status": "failed", "error": str(e)}
        simulation_store[simulation_id] = record
    return {"simulation_id": simulation_id, "status": "completed"}


@app.get("/results/{simulation_id}")
async def get_results(simulation_id: str):
    # 1. Live partial results (simulation still running in background thread)
    live = get_live_results(simulation_id)
    if live:
        return live
    # 2. Completed in-memory result
    if simulation_id in simulation_store:
        return simulation_store[simulation_id]
    # 3. Persistent SQLite result (survives restart)
    row = _load_simulation(simulation_id)
    if row:
        return row["results"]
    raise HTTPException(status_code=404, detail="Simulation not found")


# Ã¢â€â‚¬Ã¢â€â‚¬ ABM multi-seed model Ã¢â‚¬â€ Fix 1: non-blocking, returns immediately Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@app.post("/abm/simulate")
async def run_abm_simulation(config: ABMSimulationConfig):
    """Start a background ABM run and return the simulation_id immediately.

    The simulation executes in a ThreadPoolExecutor thread with per-step
    time.sleep() pauses. The event loop is never blocked, so concurrent
    GET /abm/simulate/{id}/progress and GET /results/{id} requests are served
    in real time while the ABM is still computing.

    V2: run_in_executor is called Ã¢â‚¬â€ simulation is NOT awaited inline.
    """
    simulation_id = str(uuid.uuid4())
    cfg = config.dict()

    # Scenario interpretation
    interpreted_params: dict = {}
    if config.scenario:
        interpreted_params = interpret_scenario(config.scenario)
        for key, value in interpreted_params.items():
            cfg[key] = value
    cfg["scenario"] = config.scenario or ""

    # Seed the progress store immediately so the first poll returns something
    _progress[simulation_id] = {
        "status":      "running",
        "steps_done":  0,
        "total_steps": config.n_steps * config.n_runs,
        "pct":         0.0,
    }

    # V2: fire-and-forget into thread pool Ã¢â‚¬â€ endpoint returns immediately
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _executor,
        _run_abm_job,
        simulation_id,
        cfg,
        interpreted_params,
    )

    # Return ONLY the sim_id Ã¢â‚¬â€ no results yet (they stream via polling)
    return {
        "simulation_id":    simulation_id,
        "status":           "started",
        "interpreted_params": interpreted_params,
        # NOTE: no "results" key Ã¢â‚¬â€ frontend must poll, not read inline
    }


@app.get("/abm/results/{simulation_id}")
async def get_abm_results(simulation_id: str):
    if simulation_id in abm_simulation_store:
        return abm_simulation_store[simulation_id]
    row = _load_simulation(simulation_id)
    if row:
        return row["results"]
    raise HTTPException(status_code=404, detail="ABM simulation not found")


@app.get("/abm/simulate/{simulation_id}/progress")
async def abm_progress(simulation_id: str):
    return get_progress(simulation_id)


@app.get("/simulations")
async def list_simulations():
    """Return the last 20 simulation runs with metadata."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, created_at, source, config_json FROM simulations "
            "ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
    history = []
    for row in rows:
        cfg             = json.loads(row["config_json"] or "{}")
        scenario_snippet = (cfg.get("scenario") or cfg.get("description") or "")[:80]
        history.append({
            "id":         row["id"],
            "created_at": row["created_at"],
            "source":     row["source"],
            "scenario":   scenario_snippet,
            "n_steps":    cfg.get("n_steps") or cfg.get("steps"),
            "n_runs":     cfg.get("n_runs"),
        })
    return {"simulations": history}


# Ã¢â€â‚¬Ã¢â€â‚¬ Fraud graph Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@app.post("/fraud/graph")
async def analyze_graph(data: GraphData):
    try:
        return analyze_fraud_graph(data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Ã¢â€â‚¬Ã¢â€â‚¬ Fraud anomaly Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@app.post("/fraud/anomaly")
async def anomaly_scores(data: AnomalyData):
    try:
        rows = []
        for row in data.contractor_features:
            rows.append({
                "entity_id":   row.entity_id,
                "entity_type": row.entity_type,
                "features":    [row.wins, row.avg_amount, row.max_amount,
                                 row.single_bid_rate, row.overrun_rate],
            })
        for row in data.beneficiary_features:
            rows.append({
                "entity_id":   row.entity_id,
                "entity_type": row.entity_type,
                "features":    [row.claim_count, row.unique_phones,
                                 row.unique_addresses, row.unique_banks],
            })

        if len(rows) < 3:
            return {"anomalies": []}

        max_len = max(len(r["features"]) for r in rows)
        matrix  = [r["features"] + [0.0] * (max_len - len(r["features"])) for r in rows]
        X       = np.array(matrix, dtype=float)

        iso        = IsolationForest(contamination=0.15, random_state=42)
        iso.fit(X)
        iso_scores = -iso.score_samples(X)

        lof       = LocalOutlierFactor(n_neighbors=min(10, len(rows) - 1), contamination=0.15)
        lof_pred  = lof.fit_predict(X)
        lof_scores = -lof.negative_outlier_factor_

        anomalies = []
        for i, r in enumerate(rows):
            combined   = float((iso_scores[i] + lof_scores[i]) / 2.0)
            normalized = combined / (1.0 + combined)
            if iso.predict([X[i]])[0] == -1 or lof_pred[i] == -1:
                anomalies.append({
                    "entity_id":   r["entity_id"],
                    "entity_type": r["entity_type"],
                    "score":       round(normalized, 4),
                })

        anomalies.sort(key=lambda x: x["score"], reverse=True)
        return {"anomalies": anomalies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ── AI Consequence Analyser ──────────────────────────────────────────────────

class ConsequenceRequest(BaseModel):
    scenario:     str
    n_steps:      int
    n_agents:     int = 120
    mean_by_step: Dict[str, List[float]]


def _consequence_fallback(stats: dict) -> dict:
    """
    Deterministic, stats-driven fallback returned when:
      - Gemini returns a non-429 HTTP error
      - Any network/timeout exception is raised
      - The Gemini JSON response cannot be parsed

    Uses the actual simulation start/end/min/max values so the output is
    meaningful even without AI analysis. All monetary references use ₹ crore.
    """
    emp_start  = stats["employment_start"]
    emp_final  = stats["employment_final"]
    emp_min    = stats["employment_min"]
    emp_max    = stats["employment_max"]
    wel_start  = stats["welfare_start"]
    wel_final  = stats["welfare_final"]
    wel_min    = stats["welfare_min"]
    wel_min_s  = stats["welfare_min_step"]
    inf_start  = stats["infra_start"]
    inf_final  = stats["infra_final"]
    inf_trend  = stats["infra_trend"]
    env_start  = stats["env_start"]
    env_final  = stats["env_final"]
    env_min    = stats["env_min"]
    env_min_s  = stats["env_min_step"]
    n_steps    = stats["n_steps"]
    n_agents   = stats["n_agents"]

    emp_delta  = emp_final - emp_start
    wel_delta  = wel_final - wel_start
    inf_delta  = inf_final - inf_start
    env_delta  = env_final - env_start

    # ── Severity thresholds ────────────────────────────────────────────────
    def emp_severity():
        if abs(emp_delta) > 10 or emp_min < emp_start - 8:
            return "high"
        if abs(emp_delta) > 4 or emp_min < emp_start - 3:
            return "medium"
        return "low"

    def wel_severity():
        if wel_min < wel_start * 0.85 or wel_delta < -0.05:
            return "high"
        if wel_min < wel_start * 0.92 or wel_delta < -0.02:
            return "medium"
        return "low"

    def inf_severity():
        if inf_delta < -10:
            return "high"
        if inf_delta < -4:
            return "medium"
        return "low"

    def env_severity():
        if env_min < env_start * 0.80 or env_delta < -8:
            return "high"
        if env_min < env_start * 0.90 or env_delta < -3:
            return "medium"
        return "low"

    # ── Directional helpers ────────────────────────────────────────────────
    def signed(v, unit=""):
        prefix = "+" if v >= 0 else ""
        return f"{prefix}{v:.1f}{unit}"

    emp_direction = "improved" if emp_delta >= 0 else "declined"
    inf_direction = "rose" if inf_delta >= 0 else "fell"
    env_direction = "improved" if env_delta >= 0 else "deteriorated"
    wel_direction = "strengthened" if wel_delta >= 0 else "weakened"

    # ── Overall summary ────────────────────────────────────────────────────
    worst_dim = max(
        [("employment", abs(emp_delta / max(emp_start, 1))),
         ("welfare",    abs(wel_delta / max(wel_start, 0.001))),
         ("infrastructure", abs(inf_delta / max(inf_start, 1))),
         ("environment", abs(env_delta / max(env_start, 1)))],
        key=lambda x: x[1],
    )[0]

    overall = (
        f"Across {n_steps} simulation steps with {n_agents} agents, the dominant unintended "
        f"consequence centred on {worst_dim}. "
        f"Employment {emp_direction} from {emp_start:.1f}% to {emp_final:.1f}% "
        f"(range {emp_min:.1f}\u2013{emp_max:.1f}%), while infrastructure {inf_direction} "
        f"from {inf_start:.1f} to {inf_final:.1f} and the environment {env_direction} "
        f"from {env_start:.1f} to {env_final:.1f}. "
        f"Welfare {wel_direction} to a final index of {wel_final:.3f}. "
        f"(Statistics-based assessment \u2014 enable GEMINI_API_KEY for AI narrative.)"
    )

    # ── Per-dimension risk cards ───────────────────────────────────────────
    risks = [
        {
            "dimension": "Employment",
            "severity":  emp_severity(),
            "finding": (
                f"Employment {emp_direction} by {signed(emp_delta, 'pp')} over {n_steps} steps "
                f"(from {emp_start:.1f}% to {emp_final:.1f}%). "
                f"The rate ranged between {emp_min:.1f}% and {emp_max:.1f}% during the run, "
                f"indicating {'significant' if abs(emp_delta) > 5 else 'moderate'} labour market volatility."
            ),
            "recommendation": (
                "Increase active labour market spending (₹ crore for retraining and job-placement "
                "schemes) if employment dropped more than 5 pp, or lock in gains with wage-support "
                "subsidies if the trend was positive."
                if emp_delta < 0
                else
                "Sustain current policy momentum; allocate ₹ crore to apprenticeship programmes "
                "to convert short-term employment gains into durable skills."
            ),
        },
        {
            "dimension": "Welfare",
            "severity":  wel_severity(),
            "finding": (
                f"Welfare index {wel_direction} from {wel_start:.3f} to {wel_final:.3f} "
                f"({signed(wel_delta * 100, 'pp')} net change). "
                f"The index dipped to a minimum of {wel_min:.3f} at step {wel_min_s}, "
                f"{'a significant dip of ' + f'{((wel_start - wel_min) / max(wel_start, 0.001) * 100):.1f}%' if wel_min < wel_start * 0.92 else 'remaining broadly stable'} "
                f"relative to the baseline."
            ),
            "recommendation": (
                f"Deploy targeted welfare transfers (₹ crore in direct benefit transfers) "
                f"to households affected by the dip at step {wel_min_s}; "
                "review subsidy eligibility thresholds quarterly."
                if wel_min < wel_start * 0.92
                else
                "Maintain current subsidy levels; consider redirecting ₹ crore "
                "from general transfers to targeted skill-development grants."
            ),
        },
        {
            "dimension": "Infrastructure",
            "severity":  inf_severity(),
            "finding": (
                f"Infrastructure score {inf_direction} from {inf_start:.1f} to {inf_final:.1f} "
                f"({signed(inf_delta)} points over {n_steps} steps). "
                f"The {'rising' if inf_delta >= 0 else 'falling'} trend suggests that "
                f"{'government investment outpaced depreciation and demand pressure.' if inf_delta >= 0 else 'depreciation and demand pressure exceeded investment — a structural maintenance gap is opening.'}"
            ),
            "recommendation": (
                "Protect the infrastructure budget from future austerity cuts; "
                "allocate a minimum ₹ crore per cycle to preventive maintenance "
                "to sustain the current upward trajectory."
                if inf_delta >= 0
                else
                "Urgently allocate ₹ crore for critical infrastructure maintenance; "
                "prioritise roads, water, and power networks to reverse the declining score "
                "before depreciation compounds further."
            ),
        },
        {
            "dimension": "Environment",
            "severity":  env_severity(),
            "finding": (
                f"Environmental score {env_direction} from {env_start:.1f} to {env_final:.1f} "
                f"({signed(env_delta)} points). "
                f"The lowest point was {env_min:.1f} at step {env_min_s}, "
                f"{'well below the starting baseline — indicating that economic activity temporarily overwhelmed natural recovery capacity.' if env_min < env_start * 0.88 else 'close to the starting baseline, suggesting the environment remained broadly resilient.'}"
            ),
            "recommendation": (
                f"Introduce environmental safeguard spending (₹ crore for green buffers "
                f"and pollution controls) before step {env_min_s} in future runs; "
                "consider a carbon levy to internalise production externalities."
                if env_min < env_start * 0.90
                else
                "Environment remained stable; reinforce with ₹ crore in renewable energy "
                "investment to widen the buffer against future production-driven degradation."
            ),
        },
    ]

    return {"overall": overall, "risks": risks}



@app.post("/analyse/consequences")
async def analyse_consequences(req: ConsequenceRequest):
    mbs   = req.mean_by_step
    unemp = mbs.get("unemployment_rate", [])
    welf  = mbs.get("avg_welfare", [])
    infra = mbs.get("infrastructure_score", [])
    env_  = mbs.get("env_score", [])

    if not unemp or not welf or not infra or not env_:
        raise HTTPException(status_code=422, detail="mean_by_step must contain all 4 metric arrays.")

    employment_start = (1 - unemp[0])   * 100
    employment_final = (1 - unemp[-1])  * 100
    employment_min   = (1 - max(unemp)) * 100
    employment_max   = (1 - min(unemp)) * 100
    welfare_start    = welf[0];  welfare_final = welf[-1]
    welfare_min      = min(welf); welfare_min_step = welf.index(welfare_min) + 1
    infra_start      = infra[0]; infra_final = infra[-1]
    infra_trend      = "rising" if infra_final > infra_start else "falling"
    env_start        = env_[0];  env_final = env_[-1]
    env_min          = min(env_); env_min_step = env_.index(env_min) + 1

    # Pre-build the stats dict used by _consequence_fallback() so it has
    # real values if Gemini fails at any point after this line.
    _stats = {
        "employment_start":  employment_start,
        "employment_final":  employment_final,
        "employment_min":    employment_min,
        "employment_max":    employment_max,
        "welfare_start":     welfare_start,
        "welfare_final":     welfare_final,
        "welfare_min":       welfare_min,
        "welfare_min_step":  welfare_min_step,
        "infra_start":       infra_start,
        "infra_final":       infra_final,
        "infra_trend":       infra_trend,
        "env_start":         env_start,
        "env_final":         env_final,
        "env_min":           env_min,
        "env_min_step":      env_min_step,
        "n_steps":           req.n_steps,
        "n_agents":          req.n_agents,
    }

    system_prompt = (
        "You are a policy risk analyst for CivicTwin, an Indian civic simulation platform. "
        "Return ONLY valid JSON, no markdown, no preamble, no explanation. "
        "When referring to government spending or budget amounts, always use Indian Rupees (₹ crore)."
    )
    user_prompt = (
        f"Policy: {req.scenario}\n"
        f"Simulation: {req.n_steps} steps, {req.n_agents} agents\n"
        f"Employment: {employment_start:.1f}% -> {employment_final:.1f}% (range {employment_min:.1f}-{employment_max:.1f}%)\n"
        f"Welfare: {welfare_start:.3f} -> {welfare_final:.3f} (min {welfare_min:.3f} at step {welfare_min_step})\n"
        f"Infrastructure: {infra_start:.1f} -> {infra_final:.1f} ({infra_trend})\n"
        f"Environment: {env_start:.1f} -> {env_final:.1f} (min {env_min:.1f} at step {env_min_step})\n"
        'Return exactly this JSON shape (fill in the ...): '
        '{"overall":"2-3 sentence assessment of biggest UNINTENDED consequence",'
        '"risks":['
        '{"dimension":"Employment","severity":"high|medium|low","finding":"1-2 sentences with numbers","recommendation":"one concrete action"},'
        '{"dimension":"Welfare","severity":"high|medium|low","finding":"...","recommendation":"..."},'
        '{"dimension":"Infrastructure","severity":"high|medium|low","finding":"...","recommendation":"..."},'
        '{"dimension":"Environment","severity":"high|medium|low","finding":"...","recommendation":"..."}'
        ']}'
    )

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key == "your-gemini-api-key-here":
        return {
            "overall": (
                f"Simulation completed {req.n_steps} steps. "
                f"Employment: {employment_start:.1f}% to {employment_final:.1f}%. "
                f"Infrastructure: {infra_trend}. Set GEMINI_API_KEY for AI analysis."
            ),
            "risks": [
                {"dimension": "Employment",     "severity": "medium" if abs(employment_final - employment_start) > 5 else "low", "finding": f"Employment ranged {employment_min:.1f}-{employment_max:.1f}%.", "recommendation": "Set GEMINI_API_KEY for AI risk analysis."},
                {"dimension": "Welfare",        "severity": "medium" if welfare_min < welfare_start * 0.9 else "low",            "finding": f"Welfare dipped to {welfare_min:.3f} at step {welfare_min_step}.",                 "recommendation": "Monitor welfare during policy transition."},
                {"dimension": "Infrastructure", "severity": "low",                                                               "finding": f"Infrastructure {infra_trend} from {infra_start:.1f} to {infra_final:.1f}.",         "recommendation": "Allocate ₹ crore maintenance budgets to prevent score decline."},
                {"dimension": "Environment",    "severity": "medium" if env_min < env_start * 0.9 else "low",                    "finding": f"Environment lowest at {env_min:.1f} on step {env_min_step}.",                       "recommendation": "Add environmental safeguards."},
            ],
        }

    gemini_url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )

    async def _call_gemini():
        async with httpx.AsyncClient(timeout=60.0) as client:
            return await client.post(
                gemini_url,
                headers={"content-type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "maxOutputTokens":  2048,
                        "temperature":      0.3,
                        "thinkingConfig":   {"thinkingBudget": 0},
                    },
                },
            )

    try:
        # Exponential backoff for 429 (rate limit).
        # Delays: 12 s → 24 s → 48 s before giving up.
        # Three retries give the optimizer time to recover when all 6
        # concurrent variant requests hit the quota simultaneously.
        _BACKOFF_DELAYS = [12, 24, 48]
        response = await _call_gemini()
        for _delay in _BACKOFF_DELAYS:
            if response.status_code != 429:
                break
            await asyncio.sleep(_delay)
            response = await _call_gemini()
        # If still 429 after all retries, raise_for_status() will
        # trigger the HTTPStatusError branch below which returns the
        # user-readable rate-limit message.
        response.raise_for_status()
        # gemini-2.5-flash returns multiple parts (thought + response).
        # Skip thought=True parts; use the first non-thought text part.
        parts = response.json()["candidates"][0]["content"]["parts"]
        raw_text = ""
        for part in parts:
            if not part.get("thought", False) and part.get("text", "").strip():
                raw_text = part["text"].strip()
                break
        if not raw_text:
            raw_text = " ".join(p.get("text", "") for p in parts if p.get("text", "")).strip()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            return {
                "overall": "AI analysis rate-limited — please wait 30 seconds and re-run the simulation.",
                "risks": [
                    {"dimension": d, "severity": "low",
                     "finding": "Rate limit reached. Gemini API quota exceeded temporarily.",
                     "recommendation": "Wait 30 seconds then run the simulation again."}
                    for d in ["Employment", "Welfare", "Infrastructure", "Environment"]
                ],
            }
        import logging; logging.getLogger("consequence").error("Gemini HTTP error: %s", exc)
        return _consequence_fallback(_stats)
    except Exception as exc:
        import logging; logging.getLogger("consequence").error("Gemini call failed: %s", exc)
        return _consequence_fallback(_stats)

    try:
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(cleaned)
        if "overall" not in result or "risks" not in result:
            raise ValueError("Missing keys")
        return result
    except Exception as exc:
        import logging; logging.getLogger("consequence").error("JSON parse failed: %s | raw=%s", exc, raw_text[:200])
        return _consequence_fallback(_stats)