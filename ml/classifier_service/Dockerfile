# ── ML Classifier — Python 3.12 / FastAPI ─────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi==0.110.0 \
    uvicorn==0.27.1 \
    scikit-learn==1.5.2 \
    joblib==1.3.2 \
    numpy==1.26.4 \
    python-dotenv==1.0.1

# Copy application code + pre-trained model files
COPY ml/classifier_service/app.py ml/classifier_service/utils.py ./
COPY ml/classifier_service/models/ ./models/

# Copy priority keywords config (optional — classifier falls back gracefully if missing)
COPY config/ /config/

EXPOSE 8001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
