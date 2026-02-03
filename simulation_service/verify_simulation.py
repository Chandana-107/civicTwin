from fastapi.testclient import TestClient
from ml.simulation_service.app import app
from ml.simulation_service.model import CivicModel
import time

def test_model_execution():
    print("Testing CivicModel directly...")
    model = CivicModel(N=10, strictness=0.8)
    for _ in range(5):
        model.step()
    
    results = model.datacollector.get_model_vars_dataframe()
    print("Model ran successfully. Results shape:", results.shape)
    print("Last 2 rows:")
    print(results.tail(2))
    assert not results.empty
    print("Model test PASSED.\n")

def test_api_execution():
    print("Testing API via TestClient...")
    client = TestClient(app)
    
    # 1. Start Simulation
    payload = {"N": 20, "strictness": 0.2, "steps": 5}
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    sim_id = data["simulation_id"]
    print(f"Simulation started with ID: {sim_id}")
    
    # 2. Poll for results
    # Since we use ProcessPoolExecutor, in a script like this without a persistent event loop 
    # processing events in the background might be tricky if not handling asyncio correctly.
    # However, TestClient interacts with the app synchronously usually.
    # But the background task (running in executor) needs time to finish.
    
    print("Waiting for simulation to complete...")
    for i in range(10):
        time.sleep(1)
        res = client.get(f"/results/{sim_id}")
        status = res.json()["status"]
        print(f"Status check {i+1}: {status}")
        if status == "completed":
            print("Simulation completed!")
            print("Results keys:", res.json()["results"].keys())
            break
        if status == "failed":
            print("Simulation FAILED:", res.json().get("error"))
            break
    else:
        print("Timeout waiting for simulation.")

if __name__ == "__main__":
    test_model_execution()
    test_api_execution()
