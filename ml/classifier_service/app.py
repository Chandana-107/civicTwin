""" 
Simple FastAPI classifier stub for the Civic project. 
 
Endpoints: - POST /classify  -> returns { category, priority, probs?, reasons? } - GET  /health    -> simple health check - POST /train     -> (optional) train endpoint placeholder (no heavy work here) 
 
This stub is intentionally small and safe to run locally while you 
replace it later with a real TF-IDF / sklearn model or an exported 
model artifact (joblib/pickle, or a TensorFlow/PyTorch model). 
""" 

from fastapi import FastAPI, HTTPException 
from pydantic import BaseModel 
from typing import Dict, Any, Optional 
from fastapi.middleware.cors import CORSMiddleware 
import re 
import math 
import datetime 
import os 
import logging 
 
logging.basicConfig(level=logging.INFO) 
logger = logging.getLogger("classifier_stub") 
 
app = FastAPI(title="Classifier Service (stub)", version="0.1") 
 
# Allow CORS from local frontend/dev origins (tweak as needed) 
app.add_middleware( 
    CORSMiddleware, 
    allow_origins=["*"],  # change to specific origins in production 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"], 
) 
 
# Simple request model 
class ClassifyReq(BaseModel): 
    text: str 
    metadata: Optional[Dict[str, Any]] = None 
 
class TrainReq(BaseModel): 
    # placeholder: in a real service you'd accept dataset URI, params, etc. 
    force: Optional[bool] = False 
 
# Tiny keyword-based heuristics for the stub 
PRIORITY_KEYWORDS = { 
    "urgent": ["injury", "collapsed", "electrocution", "fire", "danger", "fatal"], 
    "road": ["pothole", "road", "traffic", "accident", "bridge", "collapse"], 
    "water": ["water", "sewage", "flood", "leak"], 
    "electricity": ["power", "electric", "transformer", "wires", "electrical", "outage"], 
    "sanitation": ["garbage", "waste", "sanitation", "drainage"], 
} 
 
DEFAULT_PRIORITY = 0.2 
 
def normalize_text(txt: str) -> str: 
    txt = txt.lower() 
    txt = re.sub(r"[^a-z0-9\s]", " ", txt) 
    txt = re.sub(r"\s+", " ", txt).strip() 
    return txt 
 
def heuristic_classify(text: str) -> Dict[str, Any]: 
    """ 
    Returns a dict with: 
    - category (str) 
    - priority (float 0..1) 
    - probs (dict) optional estimated probabilities 
    - reasons (list) of short strings explaining decisions 
    """ 
    txt = normalize_text(text) 
    reasons = [] 
    scores = {} 
    for cat, kws in PRIORITY_KEYWORDS.items(): 
        score = 0.0 
        for kw in kws: 
            if kw in txt: 
                score += 1.0 
                reasons.append(f"keyword:{kw}") 
        if score > 0: 
            # simple softmax-ish weight 
            scores[cat] = score 
 
    # if no category matched, fallback to 'other' 
    if not scores: 
        category = "other" 
        probs = {"other": 0.9} 
        priority = DEFAULT_PRIORITY 
        reasons.append("no_keyword_match") 
    else: 
        # convert counts -> pseudo-probabilities 
        total = sum(scores.values()) 
        probs = {k: round(v/total, 3) for k, v in scores.items()} 
        # choose top category 
        category = max(scores.items(), key=lambda x: x[1])[0] 
        # priority heuristics: 
        base = 0.2 + 0.6 * max(probs.values())  # between 0.2 and 0.8 
        # bump priority for explicit urgent keywords 
        if any(k in txt for k in PRIORITY_KEYWORDS["urgent"]): 
            base = min(1.0, base + 0.2) 
            reasons.append("urgent_keyword_boost") 
        priority = round(min(1.0, base), 3) 
 
    # add a small confidence/probability map entry for chosen category if not present 
    if category not in probs: 
        probs[category] = round(1.0 - sum(probs.values()), 3) if probs else 1.0 
 
    return {"category": category, "priority": priority, "probs": probs, "reasons": reasons} 
 
@app.post("/classify") 
def classify(req: ClassifyReq): 
    """ 
    Classify complaint text, returning category and priority. 
    This is a stub using simple keyword heuristics. Replace this logic 
    with a real model (TF-IDF + LogisticRegression, or transformer) later. 
    """ 
    if not req.text or not req.text.strip(): 
        raise HTTPException(status_code=400, detail="text is required") 
 
    try: 
        out = heuristic_classify(req.text) 
        # attach a timestamp for provenance/debugging 
        out["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z" 
        return out 
    except Exception as e: 
        logger.exception("classification failed") 
        raise HTTPException(status_code=500, detail="classification failed") 
 
@app.get("/health") 
def health(): 
    """ 
    Basic health endpoint used by the backend to check readiness. 
    """ 
    return {"status": "ok", "service": "classifier_stub", "ts": datetime.datetime.utcnow().isoformat() + 
"Z"} 
 
@app.post("/train") 
def train(req: TrainReq): 
    """ 
    Placeholder training endpoint. In real usage, you'd trigger an offline 
    training job (e.g., script that writes model artifacts). This endpoint 
    can be used to trigger retrain orchestration. 
    """ 
    # NOTE: do NOT block long-running training here. This is just a trigger. 
    if req.force: 
        logger.info("Received train request with force=True") 
    else: 
        logger.info("Received train request (force=False)") 
 
    # simulate acceptance 
    return {"status": "accepted", "message": "training job scheduled (stub)", "requested_at": 
datetime.datetime.utcnow().isoformat() + "Z"}