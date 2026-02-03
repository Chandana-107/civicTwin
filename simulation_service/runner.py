from model import CivicModel
import pandas as pd
import concurrent.futures

def run_single_simulation(config):
    """
    Runs a single simulation based on config and returns the results.
    Config is a dict with keys: 'N', 'strictness', 'steps'
    """
    N = config.get('N', 100)
    steps = config.get('steps', 10)
    # Extract new params or infer from description
    description = config.get('description', '')
    
    # Default values
    strictness = config.get('strictness', 0.5)
    infra_spending = config.get('infra_spending', 0)
    subsidy = config.get('subsidy', 0)
    training_budget = config.get('training_budget', 0)
    job_creation_rate = config.get('job_creation_rate', 0.05)
    
    if description:
        # Simple heuristic parser
        desc_lower = description.lower()
        if "infra" in desc_lower or "road" in desc_lower or "bridge" in desc_lower or "construction" in desc_lower:
            infra_spending += 50000
        if "subsidy" in desc_lower or "cash" in desc_lower or "poor" in desc_lower:
            subsidy += 200
        if "education" in desc_lower or "school" in desc_lower or "training" in desc_lower:
            training_budget += 20000
        if "job" in desc_lower or "employment" in desc_lower or "work" in desc_lower:
            job_creation_rate += 0.05
        if "strict" in desc_lower or "police" in desc_lower:
            strictness = 0.9
        if "relaxed" in desc_lower or "freedom" in desc_lower:
            strictness = 0.2

    model = CivicModel(
        N=N, 
        strictness=strictness,
        infra_spending=infra_spending,
        subsidy=subsidy,
        training_budget=training_budget,
        job_creation_rate=job_creation_rate
    )
    
    for i in range(steps):
        model.step()
        
    model_data = model.datacollector.get_model_vars_dataframe()
    # Convert to dict for JSON serialization
    results = model_data.to_dict(orient='list')
    return results

def run_simulation_async(config):
    """
    Submits a simulation task to a process pool.
    Returns a Future object.
    
    Note: In a real production app with multiprocessing, we need to be careful 
    about where the pool is created. For this simple example, we create a
    pool on demand or reuse a global one if possible. 
    However, for simplicity in this script, we will just run it here.
    To be truly async in FastAPI, we can use `loop.run_in_executor`.
    """
    pass # Managed by the FastAPI app usually via run_in_executor
