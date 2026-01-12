# seed_labels.py
from infra.db import get_connection
from faker import Faker
import random

fake = Faker("en_IN")

def seed_labels(count=30):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM complaints;")
    complaints = [c[0] for c in cur.fetchall()]

    cur.execute("SELECT id FROM users WHERE role='admin';")
    admins = [a[0] for a in cur.fetchall()]

    for _ in range(count):
        complaint_id = random.choice(complaints)
        labeled_by = random.choice(admins)
        category = random.choice(["road", "water", "electricity", "garbage", "public-safety"])
        priority = round(random.random(), 2)
        notes = fake.sentence()

        cur.execute("""
            INSERT INTO labels (complaint_id, labeled_by, category, priority, notes)
            VALUES (%s, %s, %s, %s, %s);
        """, (complaint_id, labeled_by, category, priority, notes))

    cur.close()
    conn.close()
    print(f"Seeded {count} labels!")


if __name__ == "__main__":
    seed_labels(40)
