"""Rule-based website assistant responses for CivicTwin chatbot."""

from __future__ import annotations

from typing import Optional, Tuple


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def answer_website_question_with_intent(message: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (intent, answer) for website-focused questions."""
    lowered = (message or "").lower().strip()
    if not lowered:
        return None, None

    if _contains_any(lowered, ["hello", "hi", "hey", "help", "what can you do"]):
        return "greeting_help", (
            "I can help with both CivicTwin website questions and ABM simulation analysis. "
            "Ask about login/signup, citizen and admin dashboards, complaint tracking, fraud/sentiment pages, "
            "or ask me to run simulation scenarios and explain unemployment, income, migration, and rent trends."
        )

    if _contains_any(lowered, ["my complaints", "my complaint", "track complaint", "complaint status"]):
        return "my_complaints_page", (
            "My Complaints page is for citizens to track submitted complaints. "
            "It typically shows complaint id, category, status, and timeline/progress so users can monitor resolution."
        )

    if _contains_any(lowered, ["my profile", "profile page", "account page", "personal profile"]):
        return "user_profile", (
            "User profile/account context is role-based in CivicTwin. "
            "For citizens, profile usage focuses on complaint filing history and tracking. "
            "For admins, profile usage focuses on monitoring and governance workflows across dashboards."
        )

    if _contains_any(lowered, ["citizen profile", "citizen account", "citizen user"]):
        return "citizen_profile", (
            "Citizen profile capabilities include accessing citizen dashboard, filing new complaints, "
            "tracking submitted complaints, and viewing social/sentiment insights available to citizens."
        )

    if _contains_any(lowered, ["admin profile", "admin account", "administrator profile"]):
        return "admin_profile", (
            "Admin profile capabilities include complaint triage and oversight, complaint map monitoring, "
            "fraud and sentiment dashboard access, and running policy/simulation analysis workflows."
        )

    if _contains_any(lowered, ["profile security", "account security", "change password", "reset password"]):
        return "profile_security", (
            "Account security is handled through authentication flows such as login, OTP verification, and forgot-password "
            "recovery. Protected routes require a valid authenticated session token."
        )

    if _contains_any(lowered, ["file complaint", "new complaint", "register complaint"]):
        return "file_complaint_page", (
            "File Complaint page is where citizens submit a new grievance with details like category, description, "
            "location, and optional evidence attachments."
        )

    if _contains_any(lowered, ["social page", "social feed", "sentiment page", "social sentiment"]):
        return "social_sentiment_page", (
            "Social/Sentiment pages summarize public opinion signals and trends from social data, helping users and admins "
            "understand mood, recurring concerns, and emerging discussion topics."
        )

    if _contains_any(lowered, ["admin dashboard", "admin page", "admin panel"]):
        return "admin_dashboard", (
            "Admin dashboard gives an operational overview with access to complaint management, map view, fraud insights, "
            "sentiment monitoring, and simulation tools."
        )

    if _contains_any(lowered, ["citizen dashboard", "citizen page", "citizen panel"]):
        return "citizen_dashboard", (
            "Citizen dashboard is the main user workspace for filing complaints, tracking personal complaints, "
            "and viewing social/sentiment information."
        )

    if _contains_any(lowered, ["role", "access", "permission", "admin", "citizen"]):
        return "roles_access", (
            "Role access is protected by route guards: citizens can access citizen pages, admins can access admin pages, "
            "and some routes allow both. Login authentication token controls session access."
        )

    if _contains_any(lowered, ["login", "signup", "otp", "forgot password", "auth"]):
        return "authentication", (
            "Authentication flow includes signup, login, OTP verification, and forgot-password support. "
            "Protected pages require a valid token and will redirect unauthenticated users to login."
        )

    if _contains_any(lowered, ["complaint", "file complaint", "my complaint", "complaints"]):
        return "complaint_workflow", (
            "Citizens can file complaints and track them in My Complaints. "
            "Admins can manage complaints through list, detail view, and map-based monitoring pages."
        )

    if _contains_any(lowered, ["route", "page", "where", "navigation", "screen"]):
        return "routes_navigation", (
            "Main website routes include login/signup/OTP flows, citizen dashboard pages (file complaint, my complaints, social), "
            "and admin pages (dashboard, complaints list/detail, complaint map, fraud dashboard, sentiment dashboard, simulation)."
        )

    if _contains_any(lowered, ["fraud", "tender", "graph"]):
        return "fraud_features", (
            "CivicTwin includes fraud analysis features, including graph-based fraud checks and dashboard insights for admin users."
        )

    if _contains_any(lowered, ["sentiment", "social", "topic", "analytics"]):
        return "sentiment_features", (
            "The platform provides social/sentiment intelligence pages to monitor public mood and emerging discussion trends."
        )

    if _contains_any(lowered, ["simulate", "simulation", "abm", "mesa", "model"]):
        return "simulation_features", (
            "The simulation module uses a Mesa ABM with workers, firms, households, and government policy agents. "
            "You can run scenarios and review unemployment, income, migration, and rent outcomes over time."
        )

    if _contains_any(lowered, ["api", "endpoint", "backend"]):
        return "api_endpoints", (
            "Key simulation service endpoints are /simulate and /results/{id} for the legacy flow, "
            "/abm/simulate and /abm/results/{id} for Mesa ABM, and /chat for conversational insights."
        )

    if _contains_any(lowered, ["what is civictwin", "about website", "project overview"]):
        return "project_overview", (
            "CivicTwin is a civic governance platform with complaint workflows, admin monitoring dashboards, fraud and sentiment analysis, "
            "and a simulation assistant powered by Mesa ABM."
        )

    return None, None


def answer_website_question(message: str) -> str | None:
    """Compatibility wrapper returning only the answer string."""
    _, answer = answer_website_question_with_intent(message)
    return answer


def is_website_query(message: str) -> bool:
    """Detect whether a message is likely asking about website/product behavior."""
    lowered = (message or "").lower()
    website_terms = [
        "website",
        "page",
        "route",
        "dashboard",
        "login",
        "signup",
        "otp",
        "auth",
        "complaint",
        "admin",
        "citizen",
        "fraud",
        "sentiment",
        "topic",
        "api",
        "endpoint",
        "feature",
    ]
    return _contains_any(lowered, website_terms)
