# ml/classifier_service/utils.py
import json, os
from datetime import datetime

def save_metrics(metrics, out="metrics"):
    os.makedirs(out, exist_ok=True)
    fname = datetime.utcnow().strftime("%Y%m%d_%H%M%S") + ".json"
    path = os.path.join(out, fname)
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    return path
