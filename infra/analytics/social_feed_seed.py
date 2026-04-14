# social_feed_seed.py
from infra.db import get_connection
import random
import uuid
from datetime import datetime, timedelta

INDIAN_LOCALITIES = [
    "Indiranagar", "Koramangala", "Whitefield", "HSR Layout", "Jayanagar",
    "Banashankari", "Electronic City", "Marathahalli", "JP Nagar", "BTM Layout"
]

INDIAN_AUTHORS = [
    "Aarav Sharma", "Priya Nair", "Rohan Verma", "Neha Reddy", "Karan Mehta",
    "Ananya Iyer", "Siddharth Rao", "Meera Joshi", "Aditya Kulkarni", "Pooja Gupta"
]

POSITIVE_TEMPLATES = [
    "Water supply was on time in {area} today. Good coordination by the civic team.",
    "Road patchwork near {area} market was completed quickly. Commute feels smoother now.",
    "Street lights in {area} are finally working again. The lane feels much safer at night.",
    "Garbage collection in {area} has improved this week. Streets look cleaner than before.",
    "Drain cleaning in {area} before rainfall was a smart move. No waterlogging seen today."
]

NEUTRAL_TEMPLATES = [
    "Moderate traffic near {area} signal this evening. Movement was slow but manageable.",
    "Water pressure in {area} was average today. Not great, not bad.",
    "Garbage pickup in {area} happened later than usual, but the service was completed.",
    "Road repair work is ongoing around {area}. Temporary diversions are in place.",
    "Public park maintenance in {area} is underway. Work seems to be in progress."
]

NEGATIVE_TEMPLATES = [
    "Potholes near {area} main road are getting worse and causing traffic delays.",
    "Frequent power cuts in {area} since last night. Residents need a stable supply.",
    "Waste collection was missed in {area} again today. The area is starting to smell.",
    "Heavy waterlogging reported near {area} after a short rain. Drainage needs urgent fixing.",
    "Street lights in parts of {area} are off for two nights now. Safety is a concern."
]

HASHTAGS = ["#CivicIssues", "#Bengaluru", "#PublicServices", "#UrbanLife", "#CityUpdate"]

def random_location():
    lat = random.uniform(12.8, 13.2)
    lng = random.uniform(77.4, 77.8)
    return lng, lat


def build_post_text(sentiment):
    area = random.choice(INDIAN_LOCALITIES)

    if sentiment == "positive":
        template = random.choice(POSITIVE_TEMPLATES)
    elif sentiment == "negative":
        template = random.choice(NEGATIVE_TEMPLATES)
    else:
        template = random.choice(NEUTRAL_TEMPLATES)

    text = template.format(area=area)
    tag_count = random.choice([1, 2])
    tags = " ".join(random.sample(HASHTAGS, k=tag_count))
    return f"{text} {tags}"

def seed_social_feed(count=120):
    conn = get_connection()
    cur = conn.cursor()

    sources = ["twitter", "facebook", "instagram", "reddit", "news"]
    sentiments = ["positive", "neutral", "negative"]

    for _ in range(count):
        source = random.choice(sources)
        source_id = str(uuid.uuid4())
        sentiment = random.choice(sentiments)
        post_text = build_post_text(sentiment)
        author = random.choice(INDIAN_AUTHORS)
        sentiment_score = round(random.uniform(-1, 1), 2)

        lng, lat = random_location()

        now = datetime.now()
        posted_at = now - timedelta(
            days=random.randint(0, 20),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )
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