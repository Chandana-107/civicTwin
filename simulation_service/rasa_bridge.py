"""Rasa REST webhook bridge utilities."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _normalize_rasa_messages(messages: list[dict]) -> str:
    """Convert Rasa REST messages into a readable plain-text response."""
    lines: list[str] = []

    for message in messages:
        text = message.get("text")
        if text:
            lines.append(str(text))

        buttons = message.get("buttons")
        if isinstance(buttons, list) and buttons:
            options = [str(btn.get("title") or btn.get("payload") or "Option") for btn in buttons]
            lines.append("Options: " + ", ".join(options))

        image = message.get("image")
        if image:
            lines.append(f"Image: {image}")

        custom = message.get("custom")
        if isinstance(custom, dict):
            custom_text = custom.get("text")
            if custom_text:
                lines.append(str(custom_text))

    return "\n".join(lines).strip()


def query_rasa(
    message: str,
    sender_id: str,
    profile: Optional[Dict[str, Any]] = None,
    auth_token: Optional[str] = None,
    timeout_seconds: int = 3,
) -> Tuple[Optional[str], Dict[str, Any]]:
    """Send message to Rasa REST webhook and return text response + metadata."""
    rasa_url = os.getenv("RASA_REST_URL", "http://localhost:5005/webhooks/rest/webhook")

    payload = {
        "sender": sender_id,
        "message": message,
        "metadata": {
            "profile": profile or {},
            "has_auth_token": bool(auth_token),
        },
    }

    req = Request(
        rasa_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            messages = parsed if isinstance(parsed, list) else []
            answer = _normalize_rasa_messages(messages)

            if not answer:
                return None, {"rasa_status": "empty_response", "rasa_url": rasa_url}

            return answer, {
                "rasa_status": "ok",
                "rasa_url": rasa_url,
                "rasa_message_count": len(messages),
            }
    except (HTTPError, URLError, TimeoutError) as exc:
        return None, {
            "rasa_status": "unavailable",
            "rasa_url": rasa_url,
            "rasa_error": str(exc),
        }
    except Exception as exc:
        return None, {
            "rasa_status": "error",
            "rasa_url": rasa_url,
            "rasa_error": str(exc),
        }
