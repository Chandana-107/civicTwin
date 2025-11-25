# ml/classifier_service/retrain.py
import os, pandas as pd, subprocess
from sqlalchemy import create_engine, text
from datetime import datetime

DB_URL = os.getenv("DATABASE_URL")
LABELS_CSV = "../../infra/labels.csv"
MODELS_DIR = "models"
TMP_DIR = f"models/tmp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

def export_labels():
    engine = create_engine(DB_URL)
    df = pd.read_sql("SELECT text, correct_category AS category FROM labels", engine)
    df.to_csv(LABELS_CSV, index=False)

def retrain():
    os.makedirs(TMP_DIR, exist_ok=True)
    export_labels()
    subprocess.check_call([
        "python3", "train.py",
        "--labels", LABELS_CSV,
        "--out", TMP_DIR
    ])
    # atomic replace
    if os.path.exists(MODELS_DIR):
        os.rename(MODELS_DIR, MODELS_DIR + "_old")
    os.rename(TMP_DIR, MODELS_DIR)

if __name__ == "__main__":
    if not DB_URL:
        raise RuntimeError("DATABASE_URL missing")
    retrain()
    print("Retrain completed")
