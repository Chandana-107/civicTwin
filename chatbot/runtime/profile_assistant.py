"""Profile-aware helper responses for CivicTwin chatbot."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def _format_date(date_str: str) -> str:
    if not date_str:
        return "unknown date"
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y")
    except Exception:
        return str(date_str)


def answer_profile_question(
    message: str,
    profile: Optional[dict],
    complaint_context: Optional[list[dict]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Return (intent, answer) for profile-specific user questions."""
    lowered = (message or "").lower().strip()
    complaint_context = complaint_context or []

    asks_personal = _contains_any(
        lowered,
        [
            "my profile",
            "my account",
            "my role",
            "my complaints",
            "i have filed",
            "i filed",
            "i have raised",
            "i raised",
            "that i have raised",
            "raised by me",
            "submitted by me",
            "what did i file",
            "my email",
            "my name",
        ],
    )

    if not asks_personal:
        return None, None

    if not profile:
        return "profile_missing", (
            "I cannot access your personal profile in this request. Please login again and then ask profile-based questions."
        )

    name = profile.get("name") or "User"
    role = str(profile.get("role") or "citizen").lower()
    email = profile.get("email") or "not available"

    if _contains_any(lowered, ["my role", "which role", "am i admin", "am i citizen"]):
        return "profile_role", f"{name}, your current role is '{role}'."

    if _contains_any(lowered, ["my email", "my name", "my account"]):
        return "profile_account", f"Profile summary: name {name}, role {role}, email {email}."

    if _contains_any(
        lowered,
        [
            "my complaints",
            "i have filed",
            "i filed",
            "i have raised",
            "i raised",
            "that i have raised",
            "raised by me",
            "submitted by me",
            "what did i file",
        ],
    ):
        own_complaints = complaint_context
        if role != "admin":
            profile_id = profile.get("id")
            if profile_id is not None:
                own_complaints = [c for c in complaint_context if c.get("user_id") == profile_id]

        if not own_complaints:
            return "profile_my_complaints_empty", (
                "I could not fetch your complaint list right now. "
                "Please check that the main backend API is running, then ask again."
            )

        top_items = own_complaints[:5]
        lines = []
        status_counts: dict[str, int] = {}

        for idx, item in enumerate(top_items, start=1):
            cid = item.get("id", "?")
            title = item.get("title", "Untitled complaint")
            status = str(item.get("status") or "open").upper()
            created = _format_date(item.get("created_at"))
            status_counts[status] = status_counts.get(status, 0) + 1
            lines.append(
                f"{idx}. Complaint ID: {cid}\n"
                f"   Title: {title}\n"
                f"   Status: {status}\n"
                f"   Date: {created}"
            )

        status_summary = ", ".join(
            f"{key}: {value}" for key, value in sorted(status_counts.items(), key=lambda pair: pair[0])
        )

        answer = (
            f"Profile: {name}\n"
            f"Total complaints linked to your profile: {len(own_complaints)}\n"
            f"Status summary (latest {len(top_items)}): {status_summary}\n\n"
            f"Latest complaints:\n\n" + "\n\n".join(lines)
        )
        return "profile_my_complaints", answer

    return None, None
