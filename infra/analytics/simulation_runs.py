# simulation_runs.py
from infra.db import get_connection
from faker import Faker
import random
import json
from datetime import timedelta

fake = Faker()

def seed_simulation_runs(count=80):
    conn = get_connection()
    cur = conn.cursor()

    # Fetch users
    cur.execute("SELECT id FROM users;")
    users = [row[0] for row in cur.fetchall()]

    statuses = ["queued", "running", "completed", "failed"]

    for _ in range(count):
        user_id = random.choice(users)
        status = random.choice(statuses)

        params = {
            "agent_count": random.randint(50, 300),
            "speed": round(random.uniform(0.5, 3.0), 2),
            "iterations": random.randint(20, 150),
            "environment": random.choice(["urban", "rural", "mixed"])
        }

        if status == "completed":
            result = {
                "avg_wait_time": round(random.uniform(1.0, 10.0), 2),
                "efficiency_score": round(random.uniform(0.1, 1.0), 2)
            }
            error_message = None
            duration = round(random.uniform(2, 25), 2)

        elif status == "failed":
            result = None
            error_message = fake.sentence()
            duration = round(random.uniform(1, 8), 2)

        else:  
            result = None
            error_message = None
            duration = None

        created_at = fake.date_time_between(start_date='-15d', end_date='now')
        started_at = created_at + timedelta(seconds=random.randint(1, 15)) if status in ["running", "completed", "failed"] else None
        completed_at = started_at + timedelta(seconds=duration) if status == "completed" else None

        cur.execute("""
            INSERT INTO simulation_runs
            (user_id, params, status, result, error_message,
             duration_seconds, created_at, started_at, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            user_id,
            json.dumps(params),                        # FIX
            status,
            json.dumps(result) if result else None,    # FIX
            error_message,
            duration,
            created_at,
            started_at,
            completed_at
        ))

    conn.commit()
    cur.close()
    conn.close()
    print("✔ Seeded simulation runs!")


if __name__ == "__main__":
    seed_simulation_runs()