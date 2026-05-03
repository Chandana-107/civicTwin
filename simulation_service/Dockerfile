# ── Simulation Service — Python 3.12 / FastAPI + Mesa ────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi==0.110.0 \
    uvicorn==0.27.1 \
    scikit-learn==1.5.2 \
    numpy==1.26.4 \
    networkx==3.2.1 \
    mesa==3.1.1 \
    python-dotenv==1.0.1

# Copy all simulation service source files
COPY . .

EXPOSE 8003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8003"]
