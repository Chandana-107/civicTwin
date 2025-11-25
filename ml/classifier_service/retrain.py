import os
import pandas as pd
from sqlalchemy import create_engine
from datetime import datetime, timezone
from dotenv import load_dotenv
import subprocess

# Load environment variables
load_dotenv()

# Build paths
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL missing in .env")

LABELS_CSV = os.path.abspath("../../infra/labels.csv")
MODELS_DIR = os.path.abspath("models")

def export_labels():
    print("📥 Exporting labels from database...")

    engine = create_engine(DB_URL)

    QUERY = """
    SELECT 
        complaints.text AS text,
        labels.category AS category
    FROM labels
    JOIN complaints ON complaints.id = labels.complaint_id
    WHERE labels.category IS NOT NULL
      AND complaints.text IS NOT NULL
    ORDER BY labels.created_at DESC;
    """

    df = pd.read_sql(QUERY, engine)

    if df.empty:
        raise RuntimeError("❌ No labeled samples found in DB. Add labels first!")

    df.to_csv(LABELS_CSV, index=False)
    print(f"✔ Exported {len(df)} labeled rows → {LABELS_CSV}")

def train_model():
    print("🛠 Training model...")

    subprocess.check_call([
        "python", "train.py",
        "--labels", LABELS_CSV,
        "--out", MODELS_DIR
    ])

    print(f"✔ Model updated → {MODELS_DIR}")

if __name__ == "__main__":
    print("====== CivicTwin Simple Retrain ======")

    try:
        export_labels()
        train_model()
        print("🎉 Retraining completed successfully!")
    except Exception as e:
        print("❌ Error during retrain:", e)