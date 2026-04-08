from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
import concurrent.futures

from runner import run_single_simulation
from abm_runner import run_abm_multi_seed
from fraud_graph import analyze_fraud_graph

app = FastAPI(title="CivicTwin Simulation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation_store: Dict[str, Dict[str, Any]] = {}
abm_simulation_store: Dict[str, Dict[str, Any]] = {}

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


class GraphData(BaseModel):
    nodes: list
    edges: list


@app.get("/health")
async def health():
    return {"status": "ok", "service": "simulation"}


@app.post("/simulate", response_model=SimulationResponse)
async def start_simulation(config: SimulationConfig):
    simulation_id = str(uuid.uuid4())

    try:
        results = run_single_simulation(config.dict())
        simulation_store[simulation_id] = {
            "status": "completed",
            "results": results,
        }
    except Exception as e:
        simulation_store[simulation_id] = {
            "status": "failed",
            "error": str(e),
        }

    return {"simulation_id": simulation_id, "status": "completed"}


@app.get("/results/{simulation_id}")
async def get_results(simulation_id: str):
    if simulation_id not in simulation_store:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return simulation_store[simulation_id]


@app.post("/abm/simulate")
async def run_abm_simulation(config: ABMSimulationConfig):
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


@app.post("/fraud/graph")
async def analyze_graph(data: GraphData):
    try:
        results = analyze_fraud_graph(data.dict())
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
