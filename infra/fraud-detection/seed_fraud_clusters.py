# seed_fraud_clusters.py
from infra.db import get_connection
from faker import Faker
import random
import json
from datetime import datetime, timedelta

fake = Faker("en_IN")

def seed_fraud_clusters(count=20):
    conn = get_connection()
    cur = conn.cursor()

    # Fetch tenders (used as "nodes" in clusters)
    cur.execute("SELECT id FROM tenders;")
    tenders = [t[0] for t in cur.fetchall()]

    if not tenders:
        print("No tenders found. Seed tenders first!")
        return

    for _ in range(count):

        # Pick 3–10 tender nodes per cluster
        node_count = random.randint(3, 10)
        cluster_nodes = random.sample(tenders, min(node_count, len(tenders)))

        suspiciousness_score = round(random.uniform(0, 1), 3)
        total_amount = round(random.uniform(100000, 100000000), 2)  # 1 lakh – 10 crore
        edge_density = round(random.uniform(0.1, 1.0), 3)

        evidence = {
            "pattern": fake.sentence(),
            "indicators": [fake.word() for _ in range(random.randint(3, 7))],
            "risk_factor": round(random.uniform(0, 1), 3),
            "comments": fake.paragraph()
        }

        cur.execute("""
            INSERT INTO fraud_clusters (
                cluster_nodes, suspiciousness_score, total_amount,
                edge_density, evidence
            )
            VALUES (%s::jsonb, %s, %s, %s, %s::jsonb);
        """, (
            json.dumps(cluster_nodes),
            suspiciousness_score,
            total_amount,
            edge_density,
            json.dumps(evidence)
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} fraud clusters!")


if __name__ == "__main__":
    seed_fraud_clusters(30)
