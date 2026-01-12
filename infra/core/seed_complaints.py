# seed_complaints.py
from infra.db import get_connection
from faker import Faker
import random

fake = Faker("en_IN")

def random_location():
    # Bengaluru bounding box from your PDF
    lat = random.uniform(12.8, 13.2)
    lng = random.uniform(77.4, 77.8)
    return lng, lat

def seed_complaints(count=50):
    conn = get_connection()
    cur = conn.cursor()

    # Get user IDs
    cur.execute("SELECT id FROM users;")
    users = [row[0] for row in cur.fetchall()]

    categories = ["road", "water", "electricity", "garbage", "public-safety"]

    for _ in range(count):
        user_id = random.choice(users)
        title = fake.sentence()
        text = fake.paragraph()
        category = random.choice(categories)
        priority = round(random.random(), 2)
        sentiment = random.choice(["positive", "neutral", "negative"])
        sentiment_score = round(random.uniform(-1, 1), 2)

        lng, lat = random_location()
        status = random.choice(["open", "in_progress", "resolved"])
        address = fake.address()

        cur.execute("""
            INSERT INTO complaints (
                user_id, title, text, category, priority,
                sentiment, sentiment_score, location_geometry,
                location_address, status, consent_given, consent_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, TRUE, NOW()
            );
        """, (user_id, title, text, category, priority,
              sentiment, sentiment_score, lng, lat,
              address, status))

    cur.close()
    conn.close()
    print(f"Seeded {count} complaints!")


if __name__ == "__main__":
    seed_complaints(100)
