# infra/ingest_social.py
import requests
import uuid
from datetime import datetime, UTC
import random

BACKEND_INGEST_URL = "http://localhost:3000/social_ingest/ingest"  # adjust if server port differs

SOURCES = ['twitter', 'facebook', 'instagram', 'local_forum']
NEGATIVE_EXAMPLES = [
    "The garbage in my area hasn't been collected for days.",
    "There is no water again today at my house.",
    "Huge potholes on Main Street, dangerous for scooters!",
    "The streetlight hasn't worked in weeks and it's unsafe at night.",
    "Garbage trucks are noisy and come at 3am waking everyone."
]
POSITIVE_EXAMPLES = [
    "Appreciation to the workers who cleaned the park today.",
    "Road repair on 7th street was fast and efficient.",
    "Thank you for quick response to the water outage!",
    "New park benches are great, kids love them.",
    "Community center reopened and looks awesome."
]

def make_post(text, source=None):
    return {
        "id": str(uuid.uuid4()),
        "source": source or random.choice(SOURCES),
        "source_id": str(uuid.uuid4())[:12],
        "text": text,
        "author": "synthetic_user",
        "posted_at": datetime.now(UTC).isoformat()
    }

def generate_posts(n=20, negative_ratio=0.3):
    posts = []
    for i in range(n):
        if random.random() < negative_ratio:
            text = random.choice(NEGATIVE_EXAMPLES)
        else:
            text = random.choice(POSITIVE_EXAMPLES)
        posts.append(make_post(text))
    return posts

def main():
    posts = generate_posts(n=50, negative_ratio=0.35)
    resp = requests.post(BACKEND_INGEST_URL, json={"posts": posts})
    print("Status:", resp.status_code, resp.text)

if __name__ == "__main__":
    main()
