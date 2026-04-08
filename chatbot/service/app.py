from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from chatbot.runtime.rasa_chat import build_chat_answer
from chatbot.runtime.db_assistant import answer_db_question
from chatbot.runtime.profile_assistant import answer_profile_question
from chatbot.runtime.rasa_bridge import query_rasa
from chatbot.runtime.site_assistant import answer_website_question_with_intent, is_website_query

app = FastAPI(title="CivicTwin Chatbot Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

abm_simulation_store: Dict[str, Dict[str, Any]] = {}


class ABMSimulationConfig(BaseModel):
    n_workers: int = 120
    n_firms: int = 20
    n_households: int = 45
    n_steps: int = 50
    n_runs: int = 10
    job_find_prob: float = 0.3
    move_prob: float = 0.1
    subsidy_pct: float = 0.1
    infra_spend: float = 1000.0
    training_budget: float = 500.0


class RasaChatRequest(BaseModel):
    message: str
    config: Optional[ABMSimulationConfig] = None
    profile: Optional[Dict[str, Any]] = None
    complaint_context: Optional[list[Dict[str, Any]]] = None
    auth_token: Optional[str] = None
    sender_id: Optional[str] = None


class RasaChatResponse(BaseModel):
    answer: str
    simulation_id: Optional[str] = None
    metrics: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = None


def _get_latest_abm_result() -> tuple[Optional[str], Optional[Dict[str, Any]]]:
    for simulation_id in reversed(list(abm_simulation_store.keys())):
        record = abm_simulation_store[simulation_id]
        if record.get("status") == "completed":
            return simulation_id, record
    return None, None


def _fetch_complaints_from_backend(auth_token: str) -> list[Dict[str, Any]]:
    backend_base = os.getenv("BACKEND_API_URL", "http://localhost:3000").rstrip("/")
    candidates = [
        f"{backend_base}/complaints",
        "http://localhost:3000/complaints",
    ]

    for url in dict.fromkeys(candidates):
        try:
            req = Request(
                url,
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json",
                },
                method="GET",
            )
            with urlopen(req, timeout=4) as response:
                payload = json.loads(response.read().decode("utf-8"))
                rows = payload.get("data", []) if isinstance(payload, dict) else []
                if isinstance(rows, list):
                    return rows[:50]
        except (HTTPError, URLError, TimeoutError, ValueError):
            continue
        except Exception:
            continue

    return []


def _fetch_complaints_from_database(limit: int = 200) -> list[Dict[str, Any]]:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            dbname=os.getenv("DB_NAME", "mydb"),
        )
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, user_id, title, category, priority, status, created_at
                    FROM complaints
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        finally:
            conn.close()
    except Exception:
        return []


def _fetch_users_from_backend(auth_token: str) -> list[Dict[str, Any]]:
    backend_base = os.getenv("BACKEND_API_URL", "http://localhost:3000").rstrip("/")
    candidates = [
        f"{backend_base}/users",
        "http://localhost:3000/users",
    ]

    for url in dict.fromkeys(candidates):
        try:
            req = Request(
                url,
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json",
                },
                method="GET",
            )
            with urlopen(req, timeout=4) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if isinstance(payload, list):
                    return payload
                if isinstance(payload, dict) and isinstance(payload.get("data"), list):
                    return payload.get("data", [])
        except (HTTPError, URLError, TimeoutError, ValueError):
            continue
        except Exception:
            continue

    return []


def _fetch_users_from_database(limit: int = 500) -> list[Dict[str, Any]]:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            dbname=os.getenv("DB_NAME", "mydb"),
        )
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, name, email, role, created_at
                    FROM users
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        finally:
            conn.close()
    except Exception:
        return []


@app.get("/health")
async def health():
    return {"status": "ok", "service": "chatbot"}


@app.post("/chat", response_model=RasaChatResponse)
async def chat_about_rasa(payload: RasaChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    lowered = message.lower()

    domain_keywords = [
        "complaint", "profile", "dashboard", "citizen", "admin", "user", "status", "category",
        "priority", "database", "data", "simulation", "abm", "mesa", "unemployment", "income",
        "migration", "rent", "policy", "my complaints", "raised", "filed",
        "role", "account", "my role", "my account",
        "website", "page", "pages", "route", "routes", "navigation", "login", "signup", "otp",
        "social", "sentiment", "fraud", "map", "tender", "alert", "topic",
    ]
    rasa_generic_markers = [
        "great, carry on", "how are you", "did that help you", "cheer you up", "image:",
        "i am a bot", "i am just a bot", "hey! how are you", "hey how are you", "how can i help you", "anything else i can help",
    ]

    def _looks_domain_query() -> bool:
        return any(token in lowered for token in domain_keywords)

    def _looks_generic_rasa(answer_text: str) -> bool:
        text = (answer_text or "").lower().strip()
        if not text:
            return True
        return any(marker in text for marker in rasa_generic_markers)

    def _classify_domain_scope() -> str:
        website_tokens = [
            "website", "page", "pages", "route", "routes", "navigation", "screen",
            "dashboard", "login", "signup", "otp", "auth", "admin panel", "citizen panel",
            "complaint page", "my complaints page", "new complaint page",
        ]
        profile_tokens = [
            "my profile", "profile", "my account", "account", "my role", "my email", "my name",
            "citizen profile", "admin profile", "user profile", "my complaints",
            "i filed", "i raised", "submitted by me", "raised by me",
        ]
        database_tokens = [
            "database", "data", "records", "analytics", "stats", "summary", "breakdown",
            "count", "total", "how many", "top category", "most common", "recent", "latest",
            "priority", "open complaints", "resolved", "closed", "in progress",
        ]

        db_score = sum(1 for token in database_tokens if token in lowered)
        profile_score = sum(1 for token in profile_tokens if token in lowered)
        website_score = sum(1 for token in website_tokens if token in lowered)

        if db_score > 0 and db_score >= profile_score and db_score >= website_score:
            return "database"
        if profile_score > 0 and profile_score >= website_score:
            return "profile"
        if website_score > 0:
            return "website"
        return "unknown"

    def _build_fallback_response(reason: str) -> RasaChatResponse:
        trigger_words = ["run", "simulate", "forecast", "predict", "scenario"]
        metric_words = ["unemployment", "income", "migration", "rent", "trend"]
        should_run = any(word in lowered for word in trigger_words)
        wants_website_help = is_website_query(message)
        wants_profile_help = any(
            token in lowered
            for token in [
                "my profile", "my account", "my role", "my email", "my name", "my complaints",
            ]
        )
        website_intent, website_answer = answer_website_question_with_intent(message)

        complaint_context = payload.complaint_context or []
        complaint_source = "client_payload" if complaint_context else "none"
        if not complaint_context and payload.auth_token:
            complaint_context = _fetch_complaints_from_backend(payload.auth_token)
            if complaint_context:
                complaint_source = "backend_fetch"
        if not complaint_context:
            complaint_context = _fetch_complaints_from_database(limit=200)
            if complaint_context:
                complaint_source = "database_fetch"

        users_context = []
        if payload.auth_token and "user" in lowered:
            users_context = _fetch_users_from_backend(payload.auth_token)
        if not users_context and "user" in lowered:
            users_context = _fetch_users_from_database(limit=500)

        profile_intent, profile_answer = answer_profile_question(message, payload.profile, complaint_context)
        db_intent, db_answer = answer_db_question(message, payload.profile, complaint_context, users_context)
        query_scope = _classify_domain_scope()

        db_analytic_query = any(
            token in lowered
            for token in [
                "database", "data", "records", "how many", "count", "total", "status", "summary",
                "category", "top", "recent", "latest", "priority",
            ]
        )

        if wants_website_help and not website_answer:
            website_intent = "website_general"
            website_answer = (
                "CivicTwin website includes these major areas: authentication (login/signup/OTP), "
                "citizen pages (dashboard, file complaint, my complaints, social/sentiment), "
                "and admin pages (dashboard, complaints list/detail/map, fraud, sentiment, simulation)."
            )

        if wants_profile_help and not profile_answer:
            profile_intent = "profile_general"
            if payload.profile:
                profile_answer = (
                    f"Your profile context: name {payload.profile.get('name', 'User')}, "
                    f"role {payload.profile.get('role', 'citizen')}, "
                    f"email {payload.profile.get('email', 'not available')}. "
                    "Ask me things like 'what is my role', 'show my complaints', or 'explain my profile page'."
                )
            else:
                profile_answer = (
                    "Profile questions are supported, but I need your logged-in profile context for personal answers. "
                    "Please login and ask again."
                )

        if db_analytic_query and not db_answer:
            db_intent = "db_general"
            db_answer = (
                "Data questions are supported. I can answer totals, status breakdowns, top categories, "
                "recent complaints, and priority summary from available complaint/user data."
            )

        simulation_id = None
        record = None
        simulation_action = "none"
        # Chatbot runs in Rasa/domain mode; ABM simulation remains in simulation_service.
        needs_abm = False
        abm_intent = None

        if query_scope == "website" and record is None and website_answer:
            return RasaChatResponse(
                answer=website_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"website:{website_intent}"] if website_intent else [],
                    "profile_intent": None,
                    "db_intent": None,
                    "db_source": complaint_source,
                    "website_intent": website_intent,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if query_scope == "profile" and record is None and profile_answer:
            return RasaChatResponse(
                answer=profile_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"profile:{profile_intent}"] if profile_intent else [],
                    "profile_intent": profile_intent,
                    "db_intent": None,
                    "db_source": complaint_source,
                    "website_intent": None,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if query_scope == "database" and record is None and db_answer:
            return RasaChatResponse(
                answer=db_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"db:{db_intent}"] if db_intent else [],
                    "profile_intent": profile_intent,
                    "db_intent": db_intent,
                    "db_source": complaint_source,
                    "website_intent": website_intent,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if record is None and db_answer and (db_analytic_query or (not profile_answer and not website_answer)):
            return RasaChatResponse(
                answer=db_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"db:{db_intent}"] if db_intent else [],
                    "profile_intent": profile_intent,
                    "db_intent": db_intent,
                    "db_source": complaint_source,
                    "website_intent": website_intent,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if record is None and profile_answer:
            return RasaChatResponse(
                answer=profile_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"profile:{profile_intent}"] if profile_intent else [],
                    "profile_intent": profile_intent,
                    "db_intent": None,
                    "db_source": complaint_source,
                    "website_intent": None,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if record is None and website_answer:
            return RasaChatResponse(
                answer=website_answer,
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [f"website:{website_intent}"] if website_intent else [],
                    "profile_intent": None,
                    "db_intent": None,
                    "db_source": complaint_source,
                    "website_intent": website_intent,
                    "abm_intent": None,
                    "simulation_action": "none",
                    "query_scope": query_scope,
                },
            )

        if record is None:
            return RasaChatResponse(
                answer="I could not find a domain-specific answer for that question.",
                simulation_id=None,
                metrics=None,
                metadata={
                    "source": "fallback",
                    "fallback_reason": reason,
                    "matched_intents": [],
                    "query_scope": query_scope,
                },
            )

        results = record.get("results", {})
        summary = results.get("mean_final", {})
        abm_answer = build_chat_answer(message, results)

        if query_scope == "website" and website_answer and not needs_abm:
            answer = website_answer
        elif query_scope == "profile" and profile_answer and not needs_abm:
            answer = profile_answer
        elif query_scope == "database" and db_answer and not needs_abm:
            answer = db_answer
        elif db_answer and needs_abm and (db_analytic_query or (not profile_answer and not website_answer)):
            answer = f"{db_answer}\n\nSimulation insight: {abm_answer}"
        elif profile_answer and needs_abm:
            answer = f"{profile_answer}\n\nSimulation insight: {abm_answer}"
        elif website_answer and needs_abm:
            answer = f"{website_answer}\n\nSimulation insight: {abm_answer}"
        elif db_answer and not needs_abm and (db_analytic_query or (not profile_answer and not website_answer)):
            answer = db_answer
        elif profile_answer and not needs_abm and not (profile_intent == "profile_general" and website_answer):
            answer = profile_answer
        elif website_answer and not needs_abm:
            answer = website_answer
        elif website_answer and wants_website_help and not needs_abm:
            answer = website_answer
        else:
            answer = abm_answer

        matched_intents = []
        if profile_intent:
            matched_intents.append(f"profile:{profile_intent}")
        if db_intent:
            matched_intents.append(f"db:{db_intent}")
        if website_intent:
            matched_intents.append(f"website:{website_intent}")
        if needs_abm:
            matched_intents.append(f"abm:{abm_intent}")

        return RasaChatResponse(
            answer=answer,
            simulation_id=simulation_id,
            metrics={
                "unemployment_rate": float(summary.get("unemployment_rate", 0.0)),
                "avg_income": float(summary.get("avg_income", 0.0)),
                "migration_count": float(summary.get("migration_count", 0.0)),
                "rent_index": float(summary.get("rent_index", 0.0)),
            },
            metadata={
                "source": "fallback",
                "fallback_reason": reason,
                "matched_intents": matched_intents,
                "profile_intent": profile_intent,
                "db_intent": db_intent,
                "db_source": complaint_source,
                "website_intent": website_intent,
                "abm_intent": abm_intent if needs_abm else None,
                "simulation_action": simulation_action,
                "query_scope": query_scope,
            },
        )

    sender_id = payload.sender_id or str((payload.profile or {}).get("id") or "anonymous")

    if _looks_domain_query():
        return _build_fallback_response("domain_query_direct")

    rasa_answer, rasa_meta = query_rasa(
        message=message,
        sender_id=sender_id,
        profile=payload.profile,
        auth_token=payload.auth_token,
    )

    if rasa_answer:
        if _looks_domain_query() and _looks_generic_rasa(rasa_answer):
            return _build_fallback_response("rasa_generic_for_domain_query")
        return RasaChatResponse(
            answer=rasa_answer,
            simulation_id=None,
            metrics=None,
            metadata={
                "source": "rasa",
                "matched_intents": ["rasa:handled"],
                **rasa_meta,
            },
        )

    return _build_fallback_response("rasa_unavailable")
