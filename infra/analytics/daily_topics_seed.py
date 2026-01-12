# daily_topics_seed.py
from infra.db import get_connection
from faker import Faker
import random

fake = Faker("en_IN")

def seed_daily_topics(days=30, per_day=5):
    conn = get_connection()
    cur = conn.cursor()

    topics = [
        "water leakage", "traffic jam", "road damage",
        "garbage overflow", "power outage",
        "street light fault", "pollution problem",
        "noise complaint", "illegal parking"
    ]

    categories = ["water", "electricity", "traffic", "sanitation", "general"]

    for _ in range(days):
        date_obj = fake.date_between(start_date='-30d', end_date='today')

        for _ in range(per_day):
            topic = random.choice(topics)
            category = random.choice(categories)
            score = round(random.uniform(0.1, 1.0), 2)
            occurrences = random.randint(1, 40)
            created_at = fake.date_time_between(start_date='-10d', end_date='now')

            try:
                cur.execute("""
                    INSERT INTO daily_topics
                    (date, topic, category, score, occurrences, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s);
                """, (date_obj, topic, category, score, occurrences, created_at))
            except:
                conn.rollback()

    conn.commit()
    cur.close()
    conn.close()
    print("✔ Seeded daily topics!")


if __name__ == "__main__":
    seed_daily_topics()