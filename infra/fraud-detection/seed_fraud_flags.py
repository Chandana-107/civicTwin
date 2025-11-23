# seed_fraud_flags.py
from infra.db import get_connection
from faker import Faker
import random
import json
from datetime import datetime, timedelta

fake = Faker()

RULES = [
    "repeat_winner",
    "price_outlier",
    "suspicious_beneficiary",
    "duplicate_phone",
    "high_risk_contractor",
    "rapid_award_cycle"
]

STATUSES = ["pending", "investigating", "confirmed", "dismissed"]

def random_datetime(days=365):
    """Generate a random timestamp within last 'days' days."""
    return datetime.now() - timedelta(days=random.randint(0, days))

def seed_fraud_flags(count=40):
    conn = get_connection()
    cur = conn.cursor()

    # fetch required foreign keys
    cur.execute("SELECT id FROM tenders;")
    tenders = [t[0] for t in cur.fetchall()]

    cur.execute("SELECT id FROM users;")
    users = [u[0] for u in cur.fetchall()]

    if not tenders:
        print("No tenders found. Seed tenders first!")
        return

    for _ in range(count):
        tender_id = random.choice(tenders)
        rule = random.choice(RULES)
        score = round(random.uniform(0, 1), 3)

        # evidence JSON structure
        evidence = {
            "description": fake.sentence(),
            "analysis": fake.paragraph(),
            "related_documents": [fake.file_name() for _ in range(random.randint(1, 3))],
            "risk_factor": round(random.uniform(0, 1), 3)
        }

        status = random.choice(STATUSES)

        reviewed_by = None
        reviewed_at = None

        # if not pending, assign a reviewer
        if status != "pending" and users:
            reviewed_by = random.choice(users)
            reviewed_at = random_datetime()

        cur.execute("""
            INSERT INTO fraud_flags (
                tender_id, rule, score, evidence,
                status, reviewed_by, reviewed_at
            )
            VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s);
        """, (
            tender_id,
            rule,
            score,
            json.dumps(evidence),
            status,
            reviewed_by,
            reviewed_at
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} fraud flags!")


if __name__ == "__main__":
    seed_fraud_flags(60)
