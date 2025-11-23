# seed_complaint_notes.py
from infra.db import get_connection
from faker import Faker
import random

fake = Faker()

def seed_complaint_notes(count=40):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM complaints;")
    complaints = [row[0] for row in cur.fetchall()]

    cur.execute("SELECT id FROM users;")
    users = [row[0] for row in cur.fetchall()]

    types = ["comment", "status_change", "assignment"]

    for _ in range(count):
        complaint_id = random.choice(complaints)
        user_id = random.choice(users)
        note_type = random.choice(types)
        text = fake.sentence()

        cur.execute("""
            INSERT INTO complaint_notes (complaint_id, user_id, note_type, text, metadata)
            VALUES (%s, %s, %s, %s, '{}'::jsonb);
        """, (complaint_id, user_id, note_type, text))

    cur.close()
    conn.close()
    print(f"Seeded {count} complaint notes!")


if __name__ == "__main__":
    seed_complaint_notes(60)
