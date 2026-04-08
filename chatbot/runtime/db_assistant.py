"""Database-driven answer builder for chatbot questions."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any, Dict, Optional, Tuple


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def _fmt_date(date_str: str) -> str:
    if not date_str:
        return "unknown"
    try:
        dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y")
    except Exception:
        return str(date_str)


def _personal_scope(message: str) -> bool:
    lowered = (message or "").lower()
    return _contains_any(
        lowered,
        [
            "my",
            "i have",
            "i filed",
            "i raised",
            "by me",
            "mine",
            "my complaints",
        ],
    )


def _filter_rows_for_scope(message: str, profile: Optional[Dict[str, Any]], complaints: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    if not _personal_scope(message) or not profile:
        return complaints

    profile_id = profile.get("id")
    if profile_id is None:
        return complaints
    return [row for row in complaints if row.get("user_id") == profile_id]


def answer_db_question(
    message: str,
    profile: Optional[Dict[str, Any]],
    complaints: list[Dict[str, Any]],
    users: Optional[list[Dict[str, Any]]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Return (intent, answer) for DB-driven questions using available rows."""
    lowered = (message or "").lower().strip()
    if not lowered:
        return None, None

    explicit_db_terms = [
        "database", "data", "records", "analytics", "stats", "summary", "count", "total", "how many",
        "top", "recent", "latest", "priority", "resolved", "closed", "in progress", "open complaints",
    ]
    website_profile_terms = [
        "website", "page", "pages", "route", "dashboard", "login", "signup", "otp",
        "profile", "account", "admin profile", "citizen profile", "my profile",
    ]

    if _contains_any(lowered, website_profile_terms) and not _contains_any(lowered, explicit_db_terms):
        return None, None

    db_words = [
        "database",
        "data",
        "records",
        "how many",
        "count",
        "total",
        "open",
        "in_progress",
        "resolved",
        "closed",
        "category",
        "recent",
        "latest",
        "priority",
    ]

    if not _contains_any(lowered, db_words):
        return None, None

    scoped_rows = _filter_rows_for_scope(lowered, profile, complaints or [])
    role = str((profile or {}).get("role") or "citizen").lower()

    if _contains_any(lowered, ["how many users", "total users", "number of users", "users count"]):
        if users is None:
            return "db_users_unavailable", "I cannot access user-count data right now."
        return "db_users_total", f"Total users in database: {len(users)}."

    if not scoped_rows:
        if _contains_any(lowered, ["complaint", "count", "total", "status", "category", "priority"]):
            scope_label = "your profile" if _personal_scope(lowered) else "the current view"
            return "db_no_rows", f"I could not find complaint records for {scope_label}."
        return None, None

    statuses = Counter(str(row.get("status") or "open").lower() for row in scoped_rows)
    categories = Counter(str(row.get("category") or "uncategorized").lower() for row in scoped_rows)

    if _contains_any(lowered, ["how many complaints", "complaints count", "total complaints", "number of complaints"]):
        return "db_complaints_total", f"Total complaints in scope: {len(scoped_rows)}."

    if _contains_any(lowered, ["open complaints", "how many open", "count open"]):
        return "db_status_open", f"Open complaints: {statuses.get('open', 0)}."

    if _contains_any(lowered, ["in progress", "in_progress", "ongoing"]):
        return "db_status_in_progress", f"In-progress complaints: {statuses.get('in_progress', 0)}."

    if _contains_any(lowered, ["resolved", "how many resolved"]):
        return "db_status_resolved", f"Resolved complaints: {statuses.get('resolved', 0)}."

    if _contains_any(lowered, ["closed", "how many closed"]):
        return "db_status_closed", f"Closed complaints: {statuses.get('closed', 0)}."

    if _contains_any(lowered, ["status summary", "status breakdown", "status wise"]):
        summary = ", ".join(f"{key}: {value}" for key, value in sorted(statuses.items()))
        return "db_status_summary", f"Complaint status summary: {summary}."

    if _contains_any(lowered, ["category summary", "category wise", "top category", "most common category"]):
        top_category, top_count = categories.most_common(1)[0]
        summary = ", ".join(f"{key}: {value}" for key, value in categories.most_common(6))
        return "db_category_summary", (
            f"Top category is '{top_category}' with {top_count} complaints. "
            f"Category summary: {summary}."
        )

    if _contains_any(lowered, ["recent complaints", "latest complaints", "last complaints"]):
        top_rows = sorted(
            scoped_rows,
            key=lambda row: str(row.get("created_at") or ""),
            reverse=True,
        )[:5]
        lines = []
        for idx, row in enumerate(top_rows, start=1):
            lines.append(
                f"{idx}. {row.get('title', 'Untitled')} "
                f"(ID: {row.get('id', '?')}, Status: {str(row.get('status') or 'open').upper()}, Date: {_fmt_date(row.get('created_at'))})"
            )
        return "db_recent_complaints", "Recent complaints:\n" + "\n".join(lines)

    if _contains_any(lowered, ["priority", "high priority", "urgent"]):
        def _priority_value(row: Dict[str, Any]) -> float:
            try:
                return float(row.get("priority") or 0.0)
            except Exception:
                return 0.0

        high_priority = [row for row in scoped_rows if _priority_value(row) >= 0.7]
        avg_priority = sum(_priority_value(row) for row in scoped_rows) / max(1, len(scoped_rows))
        return "db_priority_summary", (
            f"Average priority score: {avg_priority:.2f}. "
            f"High-priority complaints (>= 0.70): {len(high_priority)}."
        )

    summary = ", ".join(f"{key}: {value}" for key, value in sorted(statuses.items()))
    return "db_generic_summary", (
        f"Database complaint snapshot: total {len(scoped_rows)} complaints, status breakdown: {summary}."
    )
