"""Simple natural language helper for ABM chatbot replies."""

from __future__ import annotations


def build_chat_answer(message: str, aggregated: dict) -> str:
    """Return a concise response based on user query and simulation summary."""
    lowered = (message or "").lower()
    mean_final = aggregated.get("mean_final", {})
    n_steps = aggregated.get("n_steps", 0)

    unemployment = float(mean_final.get("unemployment_rate", 0.0))
    avg_income = float(mean_final.get("avg_income", 0.0))
    migration_count = float(mean_final.get("migration_count", 0.0))
    rent_index = float(mean_final.get("rent_index", 0.0))

    if "unemployment" in lowered:
        return f"Unemployment is {unemployment * 100:.1f}% after {n_steps} steps."

    if "income" in lowered or "salary" in lowered:
        return f"Average income is {avg_income:.2f} after {n_steps} steps."

    if "migration" in lowered or "move" in lowered:
        return f"Average migration count is {migration_count:.2f} households after {n_steps} steps."

    if "rent" in lowered or "housing" in lowered:
        return f"Rent index is {rent_index:.2f} after {n_steps} steps."

    return (
        "ABM summary: "
        f"unemployment {unemployment * 100:.1f}%, "
        f"average income {avg_income:.2f}, "
        f"migration {migration_count:.2f}, "
        f"rent index {rent_index:.2f} after {n_steps} steps."
    )
