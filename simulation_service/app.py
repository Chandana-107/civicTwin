from fastapi import FastAPI, BackgroundTasks, HTTPException
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
import concurrent.futures
from runner import run_single_simulation

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

