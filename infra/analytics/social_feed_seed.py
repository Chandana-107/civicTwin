# social_feed_seed.py
from infra.db import get_connection
from faker import Faker
import random

fake = Faker()

def random_location():
    lat = random.uniform(12.8, 13.2)
    lng = random.uniform(77.4, 77.8)
    return lng, lat

def seed_social_feed(count=120):
    conn = get_connection()
    cur = conn.cursor()

    sources = ["twitter", "facebook", "instagram", "reddit", "news"]
    sentiments = ["positive", "neutral", "negative"]

    for _ in range(count):
        source = random.choice(sources)
        source_id = fake.uuid4()
        post_text = fake.sentence(nb_words=15)
        author = fake.name()

        sentiment = random.choice(sentiments)
        sentiment_score = round(random.uniform(-1, 1), 2)

        lng, lat = random_location()

        posted_at = fake.date_time_between(start_date='-20d', end_date='now')
        created_at = posted_at

        cur.execute("""
            INSERT INTO social_feed
            (source, source_id, text, author, sentiment, sentiment_score,
             location_geometry, posted_at, created_at)
            VALUES (
                %s, %s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s
            );
        """, (
            source, source_id, post_text, author,
            sentiment, sentiment_score,
            lng, lat,
            posted_at, created_at
        ))

    conn.commit()
    cur.close()
    conn.close()
    print("✔ Seeded social feed posts!")


if __name__ == "__main__":
    seed_social_feed()