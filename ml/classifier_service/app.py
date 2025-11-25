"""
Real Classifier Service for CivicTwin
Replaces the stub with:
- TF-IDF vectorizer + Logistic Regression classifier
- Keyword-based priority boosting
- Explainability: reasons, probs, top_tokens
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import joblib
import numpy as np
import json
import os

# ----------- FASTAPI APP -----------
app = FastAPI(title="Classifier Service", version="1.0")

# ----------- CORS -----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------- REQUEST MODEL -----------
class ClassifyReq(BaseModel):
    text: str


# PATHS (relative to your structure)
MODEL_DIR = "models"
PRIORITY_KEYWORDS_FILE = "../../configs/priority_keywords.json"

# GLOBALS
vectorizer = None
model = None
priority_keywords = []


# ============================================================
#                LOAD MODEL + KEYWORDS ON STARTUP
# ============================================================
@app.on_event("startup")
def load_artifacts():
    global vectorizer, model, priority_keywords

    # Load TF-IDF and Logistic Regression
    vec_path = os.path.join(MODEL_DIR, "tfidf.joblib")
    model_path = os.path.join(MODEL_DIR, "logreg.joblib")

    if not os.path.exists(vec_path) or not os.path.exists(model_path):
        raise RuntimeError("Model artifacts not found. Run train.py first.")

    vectorizer = joblib.load(vec_path)
    model = joblib.load(model_path)

    # Load priority keywords
    if os.path.exists(PRIORITY_KEYWORDS_FILE):
        with open(PRIORITY_KEYWORDS_FILE, "r") as f:
            priority_keywords = [kw.lower() for kw in json.load(f)]
    else:
        priority_keywords = []


# ============================================================
#                          HEALTH CHECK
# ============================================================
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": vectorizer is not None,
        "service": "real_classifier",
    }


# ============================================================
#                        CLASSIFY ENDPOINT
# ============================================================
@app.post("/classify")
def classify(req: ClassifyReq):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    # TF-IDF transform
    X = vectorizer.transform([text])

    # Predict category + probabilities
    proba = model.predict_proba(X)[0]
    classes = model.classes_

    probs = {cls: float(p) for cls, p in zip(classes, proba)}

    # Best category
    best_idx = int(np.argmax(proba))
    category = classes[best_idx]
    max_prob = float(proba[best_idx])

    # Priority base formula
    priority = 0.2 + 0.8 * max_prob
    reasons = [f"model_prob:{max_prob:.2f}"]

    # Keyword boosting
    text_lower = text.lower()
    for kw in priority_keywords:
        if kw in text_lower:
            priority = min(1.0, priority + 0.15)
            reasons.append(f"keyword:{kw}")

    # Optional: top contributing tokens
    try:
        feature_names = np.array(vectorizer.get_feature_names_out())
        row_values = X.toarray()[0]
        top_indices = row_values.argsort()[::-1][:10]
        top_tokens = [
            feature_names[i] for i in top_indices if row_values[i] > 0
        ]
    except:
        top_tokens = []

    return {
        "category": category,
        "priority": float(priority),
        "probs": probs,
        "reasons": reasons,
        "top_tokens": top_tokens,
    }
