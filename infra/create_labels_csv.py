import os
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load .env variables
load_dotenv()

# Build DATABASE_URL from your .env
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

print("Connected to DB:", DATABASE_URL)

# ---------------------------------------------------------
# Pull complaint text + human-labeled category
# (based on your schema: labels has category but NOT text)
# ---------------------------------------------------------

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

OUTPUT_PATH = "labels.csv"   # stays inside infra/

df.to_csv(OUTPUT_PATH, index=False)

print(f"✔ labels.csv created successfully → {OUTPUT_PATH}")
print(df.head())
